// Replace OWNER/REPO with your GitHub owner/repo before publishing.
// The /releases/latest/download/<asset> redirect always points at the most
// recent release, so the button never goes stale after each version bump.
const GH_OWNER = "archiekerr26";
const GH_REPO = "test-mac-app";
const DMG_NAME = "FocusPad.dmg";
const DOWNLOAD_URL = `https://github.com/${GH_OWNER}/${GH_REPO}/releases/latest/download/${DMG_NAME}`;
const RELEASES_URL = `https://github.com/${GH_OWNER}/${GH_REPO}/releases`;

const features = [
  {
    title: "Focus Timer",
    body: "Pomodoro-style countdown with native macOS notifications when a session ends.",
  },
  {
    title: "Quick Notes",
    body: "A frictionless scratchpad that saves locally. No accounts, no clutter.",
  },
  {
    title: "Auto-Updates",
    body: "Ships new versions through GitHub Releases. The app updates itself in the background.",
  },
];

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <section className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1 text-xs font-medium text-neutral-700 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          v1.0.0 · macOS
        </div>
        <h1 className="mt-6 text-5xl font-semibold tracking-tight md:text-7xl">
          A tiny focus timer
          <br />
          <span className="text-neutral-500">that lives in your menu bar.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
          FocusPad is a small, fast desktop app for focus sessions and quick notes.
          Built native for macOS. Ships with auto-updates.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3">
          <a
            href={DOWNLOAD_URL}
            className="group inline-flex items-center gap-3 rounded-2xl bg-black px-7 py-4 text-base font-medium text-white shadow-lg shadow-black/10 transition hover:translate-y-[-1px] hover:shadow-xl"
          >
            <span aria-hidden></span>
            Download for Mac
            <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs">.dmg</span>
          </a>
          <a
            href={RELEASES_URL}
            className="text-sm text-neutral-500 underline-offset-4 hover:underline"
          >
            View all releases
          </a>
        </div>
      </section>

      <section className="mt-24 grid gap-5 md:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm shadow-black/[0.02]"
          >
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-24 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm leading-relaxed text-amber-900">
        <h2 className="text-base font-semibold">Local testing notes</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          <li>
            The Download button points at{" "}
            <code className="rounded bg-white/70 px-1.5 py-0.5">
              github.com/OWNER/REPO/releases/latest/download/FocusPad.dmg
            </code>
            . Replace <code>OWNER/REPO</code> in <code>apps/web/src/app/page.tsx</code> with your repo.
          </li>
          <li>
            Until your first release exists, the link will 404. Build the DMG locally with{" "}
            <code className="rounded bg-white/70 px-1.5 py-0.5">npm run desktop:dist</code> or
            tag a release to publish through GitHub Actions.
          </li>
          <li>
            The build is unsigned. After installing, right-click the app → Open the first time to
            bypass Gatekeeper. See the README for the full workaround.
          </li>
        </ol>
      </section>

      <footer className="mt-24 border-t border-black/5 pt-8 text-center text-xs text-neutral-500">
        FocusPad · Test project for verifying Mac downloads and auto-updates.
      </footer>
    </main>
  );
}
