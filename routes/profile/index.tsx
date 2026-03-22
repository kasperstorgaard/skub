import clsx from "clsx/lite";

import { Header } from "#/components/header.tsx";
import { EnvelopeSimple, Icon } from "#/components/icons.tsx";
import { Main } from "#/components/main.tsx";
import { Panel } from "#/components/panel.tsx";
import { define } from "#/core.ts";
import { setUser } from "#/db/user.ts";
import { THEMES } from "#/lib/themes.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const form = await ctx.req.formData();

    const name = form.get("name")?.toString().trim();
    if (name) await setUser(ctx.state.userId, { name });

    const theme = form.get("theme")?.toString();
    if (theme) await setUser(ctx.state.userId, { theme });

    return new Response(null, {
      status: 303,
      headers: { Location: "/profile" },
    });
  },
});

export default define.page<typeof handler>(function ProfilePage(props) {
  const url = new URL(props.req.url);
  const { user } = props.state;

  const savedName = user?.name ?? null;
  const darkThemes = THEMES.filter((t) => t.mode === "dark");
  const lightThemes = THEMES.filter((t) => t.mode === "light");
  const activeTheme = user.theme ?? "skub";

  return (
    <>
      <Main className="max-lg:row-span-full">
        <Header url={url} back={{ href: "/" }} hideProfile />

        <div className="flex flex-col gap-fl-4 mt-fl-2">
          <h1 className="text-6">
            Profile
          </h1>

          <section className="flex flex-col gap-fl-2 md:gap-fl-1">
            {user.email
              ? (
                <>
                  <div className="flex items-center gap-fl-2">
                    <span>{user.email}</span>
                    <a href="/auth/logout">
                      Log out
                    </a>
                  </div>

                  {
                    /*
                    TODO: personal stats section
                    - solved / total puzzles (e.g. "12 of 73 solved")
                    - optimal solves count (trophy icon + count)
                    - solved puzzles list with best move counts
                    Data: listUserSolutions already fetched on archive page — same query works here.
                    Note: these stats are only shown when logged in (email present), which ties
                    naturally into the "sync your progress" login pitch for anonymous users.
                  */
                  }
                </>
              )
              : (
                <div className="flex flex-col gap-fl-2 p-fl-3 border border-surface-4 rounded-2">
                  <div className="flex flex-col gap-fl-1">
                    <h2 className="text-text-1 leading-flat">
                      Sync your progress
                    </h2>
                    <p className="text-text-2">
                      Log in to keep your solved puzzles and best scores across
                      all your devices.
                    </p>
                  </div>
                  <div>
                    <a href="/auth/login?return_to=/profile" className="btn">
                      <Icon icon={EnvelopeSimple} />
                      Log in with email
                    </a>
                  </div>
                </div>
              )}

            <form method="post" action="/profile">
              <div className="flex flex-col gap-1 place-content-end">
                <label for="name" className="text-text-2 text-3 font-5">
                  Username
                </label>

                <div className="flex items-stretch">
                  <input
                    name="name"
                    id="name"
                    value={savedName ?? undefined}
                    placeholder="Set a username"
                    className={clsx(
                      "min-w-0 px-fl-1 py-1",
                      "border border-r-0 border-surface-4 bg-surface-2 rounded-r-none",
                    )}
                  />
                  <button
                    type="submit"
                    className="btn shrink-0 rounded-l-none!"
                  >
                    {savedName ? "Update" : "Save"}
                  </button>
                </div>
              </div>
            </form>
          </section>

          <hr className="m-0 p-0" />

          {/* Theme */}
          <section className="flex flex-col gap-fl-2">
            <h2 className="flex flex-col gap-0.5 text-5">Theme</h2>

            <form
              method="post"
              action="/profile"
              className="flex flex-col gap-fl-3"
            >
              <ThemeGroup
                label="Dark"
                themes={darkThemes}
                active={activeTheme}
              />
              <ThemeGroup
                label="Light"
                themes={lightThemes}
                active={activeTheme}
              />
            </form>
          </section>
        </div>
      </Main>
      <Panel />
    </>
  );
});

type ThemeGroupProps = {
  label: string;
  themes: typeof THEMES;
  active: string;
};

function ThemeGroup({ label, themes, active }: ThemeGroupProps) {
  return (
    <div className="flex flex-col gap-fl-1">
      <p className="text-text-2 font-5 text-3">
        {label}
      </p>
      <div className="flex gap-x-fl-1 gap-y-2 flex-wrap">
        {themes.map((theme) => (
          <button
            key={theme.key}
            type="submit"
            name="theme"
            value={theme.key}
            className="btn"
            autofocus={theme.key === active ? true : undefined}
          >
            <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
              <circle cx="6" cy="7" r="6" fill={theme.surface} />
              <circle cx="14" cy="7" r="6" fill={theme.brand} />
            </svg>
            {theme.label}
          </button>
        ))}
      </div>
    </div>
  );
}
