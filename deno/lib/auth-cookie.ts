import { getCookies, setCookie } from "@std/http/cookie";

import { isDev } from "#/lib/env.ts";

const AUTH_SESSION_KEY = "auth_session";
// 1 year in seconds
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

export function getAuthSessionId(headers: Headers): string | undefined {
  return getCookies(headers)[AUTH_SESSION_KEY];
}

export function setAuthSessionCookie(
  headers: Headers,
  sessionId: string,
): void {
  setCookie(headers, {
    name: AUTH_SESSION_KEY,
    value: sessionId,
    httpOnly: true,
    path: "/",
    secure: !isDev,
    maxAge: SESSION_MAX_AGE,
    sameSite: "Lax",
  });
}

export function clearAuthSessionCookie(headers: Headers): void {
  setCookie(headers, {
    name: AUTH_SESSION_KEY,
    value: "",
    httpOnly: true,
    path: "/",
    secure: !isDev,
    maxAge: 0,
    sameSite: "Lax",
  });
}
