import { kv } from "#/db/kv.ts";

// ── Session ──────────────────────────────────────────────────────────────────

type AuthSession = { sub: string; userId: string };

export async function getAuthSession(
  sessionId: string,
): Promise<AuthSession | null> {
  const res = await kv.get<AuthSession>(["auth_session", sessionId]);
  return res.value ?? null;
}

export async function setAuthSession(
  sessionId: string,
  session: AuthSession,
): Promise<void> {
  await kv.set(["auth_session", sessionId], session);
}

export async function deleteAuthSession(sessionId: string): Promise<void> {
  await kv.delete(["auth_session", sessionId]);
}

// ── Sub → userId mapping ──────────────────────────────────────────────────────

/**
 * Atomically claims a sub → userId mapping on first login.
 * If the sub is already mapped (returning user), the existing userId wins and
 * is returned — the mapping can never be overwritten.
 * If this is the first login, `userId` is stored and returned.
 */
export async function claimUserId(
  sub: string,
  userId: string,
): Promise<string> {
  const key = ["auth", sub, "userId"];
  const result = await kv.atomic()
    .check({ key, versionstamp: null }) // only write if absent
    .set(key, userId)
    .commit();

  if (result.ok) return userId;

  // Another write won the race — read back the canonical value.
  const existing = await kv.get<string>(key);
  return existing.value!;
}

// ── OAuth state (PKCE handshake, one-time use) ────────────────────────────────

type OAuthState = { code_verifier: string; returnTo: string };

// 10 minutes in milliseconds
const STATE_TTL_MS = 10 * 60 * 1000;

export async function setOAuthState(
  state: string,
  value: OAuthState,
): Promise<void> {
  await kv.set(["oauth_state", state], value, { expireIn: STATE_TTL_MS });
}

/**
 * Atomically consumes the oauth state — one-time use.
 * Returns null if the state is missing, expired, or already consumed.
 */
export async function consumeOAuthState(
  state: string,
): Promise<OAuthState | null> {
  const key = ["oauth_state", state];
  const entry = await kv.get<OAuthState>(key);
  if (!entry.value) return null;

  const result = await kv.atomic()
    .check(entry) // only delete if unchanged since we read it
    .delete(key)
    .commit();

  return result.ok ? entry.value : null;
}
