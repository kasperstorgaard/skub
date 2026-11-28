import { createRemoteJWKSet, jwtVerify } from "jose";

import { define } from "#/core.ts";
import { claimUserId, consumeOAuthState, setAuthSession } from "#/db/auth.ts";
import { setUser } from "#/db/user.ts";
import { setAuthSessionCookie } from "#/lib/auth-cookie.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const { searchParams } = ctx.url;

    const domain = Deno.env.get("AUTH0_DOMAIN");
    const clientId = Deno.env.get("AUTH0_CLIENT_ID");
    const clientSecret = Deno.env.get("AUTH0_CLIENT_SECRET");

    if (!domain || !clientId || !clientSecret) {
      return new Response("Auth not configured", { status: 503 });
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return new Response("Missing code or state", { status: 400 });
    }

    const oauthState = await consumeOAuthState(state);
    if (!oauthState) {
      return new Response("Invalid or expired state", { status: 401 });
    }

    const { code_verifier, returnTo } = oauthState;

    const issuerUrl = new URL(`https://${domain}`);
    const tokenUrl = new URL("/oauth/token", issuerUrl);
    const redirectUri = new URL("/auth/callback", ctx.url.origin);

    // Exchange code for tokens
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri.href,
        code_verifier,
      }),
    });

    if (!tokenRes.ok) {
      return new Response("Token exchange failed", { status: 502 });
    }

    const tokens = await tokenRes.json();
    const idToken: string = tokens.id_token;

    // We only use the ID token — to extract sub + email and verify the user's
    // identity via JWKS.
    // The access token and refresh token are intentionally discarded:
    // we don't call any Auth0 APIs after login, so there is nothing to keep authorised or to refresh.
    // Our own KV session (no TTL, cleared on explicit logout) is the only ongoing credential.
    // This is valid OIDC usage — we just treat the handshake as a one-time identity check
    // rather than ongoing delegated access.
    const jwksUrl = new URL("/.well-known/jwks.json", issuerUrl);
    const JWKS = createRemoteJWKSet(jwksUrl);

    let sub: string;
    let email: string;

    try {
      const { payload } = await jwtVerify(idToken, JWKS, {
        issuer: issuerUrl.href,
        audience: clientId,
      });
      sub = payload.sub as string;
      email = payload.email as string;
    } catch {
      return new Response("ID token validation failed", { status: 401 });
    }

    if (!sub || !email) {
      return new Response("Missing claims in ID token", { status: 401 });
    }

    // Cross-device merge: atomically claim sub → userId on first login
    // (preserves existing anonymous progress).
    // On subsequent logins the existing userId wins —
    // the mapping can never be overwritten, so history always follows the account.
    const userId = await claimUserId(sub, ctx.state.userId);
    await setUser(userId, { email });

    const sessionId = crypto.randomUUID();
    await setAuthSession(sessionId, { sub, userId });

    const headers = new Headers({ Location: returnTo });
    setAuthSessionCookie(headers, sessionId);

    return new Response(null, { status: 303, headers });
  },
});
