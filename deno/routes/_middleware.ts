import { define } from "#/core.ts";
import { auth } from "#/middleware/auth.ts";
import { tracking } from "#/middleware/tracking.ts";
import { user } from "#/middleware/user.ts";

export const handler = define.middleware([tracking, auth, user]);
