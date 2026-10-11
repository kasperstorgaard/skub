import { deleteCookie, getCookies, setCookie } from "@std/http/cookie";

import { isDev } from "#/lib/env.ts";

const USER_ID_KEY = "user_id";
// 5 years in seconds
const USER_ID_DURATION = 60 * 60 * 24 * 365 * 5;

export function getUserIdCookie(headers: Headers): string | undefined {
  return getCookies(headers)[USER_ID_KEY];
}

export function setUserIdCookie(headers: Headers, userId: string): void {
  setCookie(headers, {
    name: USER_ID_KEY,
    value: userId,
    httpOnly: true,
    path: "/",
    secure: !isDev,
    maxAge: USER_ID_DURATION,
    sameSite: "Lax",
  });
}

export function clearUserIdCookie(headers: Headers): void {
  deleteCookie(headers, USER_ID_KEY, { path: "/" });
}
