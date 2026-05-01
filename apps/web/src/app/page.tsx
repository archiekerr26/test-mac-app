const GH_OWNER = "archiekerr26";
const GH_REPO = "test-mac-app";
const DMG_NAME = "MeetCommand.dmg";
const DOWNLOAD_URL = `https://github.com/${GH_OWNER}/${GH_REPO}/releases/latest/download/${DMG_NAME}`;
const RELEASES_URL = `https://github.com/${GH_OWNER}/${GH_REPO}/releases`;

const features = [
  {
    title: "Mute mic from the menu bar",
    body: "One click. Restores your previous level on unmute. Works regardless of which app is using the mic.",
  },
  {
    title: "Output volume + mute",
    body: "A slider and toggle for system output, with the same one-click feel as Apple's Sound menu — but always there.",
  },
  {
    title: "Switch input device",
    body: "Pick MacBook Pro Mic, AirPods, or any plugged-in USB mic from a dropdown. CoreAudio under the hood.",
  },
  {
    title: "Switch output device",
    body: "Move your audio between speakers, AirPods, external displays, virtual devices — without opening Sound Settings.",
  },
  {
    title: "Quick notes",
    body: "A scratchpad inside the menu bar panel. Autosaves locally between launches.",
  },
  {
    title: "Auto-updates",
    body: "Ships new versions through GitHub Releases. The app updates itself in the background.",
  },
];

type ReleaseMeta = { version: string | null; sizeMB: string | null };

async function fetchLatestRelease(): Promise<ReleaseMeta> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases/latest`,
      {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return { version: null, sizeMB: null };
    const data = (await res.json()) as {
      tag_name?: string;
      assets?: { name: string; size: number }[];
    };
    const dmg = data.assets?.find((a) => a.name === DMG_NAME);
    return {
      version: data.tag_name ?? null,
      sizeMB: dmg ? (dmg.size / 1024 / 1024).toFixed(0) : null,
    };
  } catch {
    return { version: null, sizeMB: null };
  }
}

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.466 2.227-1.226 3.014-.81.84-2.124 1.493-3.21 1.4-.13-1.13.43-2.296 1.18-3.066.84-.86 2.27-1.488 3.256-1.348zM20.5 17.276c-.553 1.27-.82 1.83-1.524 2.95-.99 1.563-2.39 3.51-4.117 3.527-1.535.014-1.93-.99-4.013-.978-2.084.014-2.518 1-4.054.978-1.728-.018-3.052-1.78-4.043-3.343C.04 15.27-.43 9.92 1.4 7.073c1.295-2.022 3.34-3.205 5.262-3.205 1.96 0 3.193 1.07 4.812 1.07 1.572 0 2.527-1.07 4.793-1.07 1.715 0 3.534.93 4.83 2.534-4.245 2.32-3.555 8.36.402 10.874z" />
    </svg>
  );
}

export default async function Page() {
  const release = await fetchLatestRelease();
  const subline = [
    "Apple Silicon",
    release.version,
    release.sizeMB ? `${release.sizeMB} MB` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <section className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-medium text-neutral-700 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {release.version ?? "v1.0.0"} · macOS · Menu bar
        </div>
        <h1 className="mt-6 text-5xl font-semibold tracking-tight md:text-7xl">
          Mic, volume, devices.
          <br />
          <span className="text-neutral-500">One click in your menu bar.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
          MeetCommand is a tiny macOS menu bar control surface for your audio.
          Mute the mic, change input or output device, push the system volume
          around — without opening System Settings.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3">
          <a
            href={DOWNLOAD_URL}
            className="group inline-flex items-center gap-3 rounded-2xl bg-black px-6 py-3.5 text-left text-white shadow-lg shadow-black/10 transition hover:translate-y-[-1px] hover:shadow-xl"
          >
            <AppleLogo />
            <span className="flex flex-col leading-tight">
              <span className="text-base font-semibold">Download for Mac</span>
              <span className="text-xs font-normal text-neutral-400">{subline}</span>
            </span>
          </a>
          <a
            href={RELEASES_URL}
            className="text-sm text-neutral-500 underline-offset-4 hover:underline"
          >
            View all releases
          </a>
          <p className="mt-2 max-w-md text-xs text-neutral-500">
            Experimental local-first Mac utility. Unsigned build — see the README
            for the one-line workaround on first launch.
          </p>
        </div>
      </section>

      <section className="mt-24">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">What it does</h2>
          <span className="text-xs text-neutral-500">Lives in the macOS menu bar</span>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm shadow-black/[0.02]"
            >
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-24 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm leading-relaxed text-amber-900">
        <h2 className="text-base font-semibold">Heads up</h2>
        <ul className="mt-3 space-y-1 pl-5 list-disc">
          <li>
            Camera on/off isn&apos;t togglable system-wide on macOS — each app
            decides for itself. The panel surfaces a one-click jump to{" "}
            <em>System Settings → Privacy → Camera</em> instead.
          </li>
          <li>
            Volume + mute go through AppleScript. Device switching uses a tiny
            Swift helper that talks to CoreAudio. Both are bundled inside the
            app, no extra installs needed.
          </li>
          <li>
            The build is unsigned. After first install run{" "}
            <code className="rounded bg-white/70 px-1.5 py-0.5">
              xattr -dr com.apple.quarantine /Applications/MeetCommand.app
            </code>{" "}
            to bypass Gatekeeper.
          </li>
        </ul>
      </section>

      <footer className="mt-24 border-t border-black/5 pt-8 text-center text-xs text-neutral-500">
        MeetCommand · Experimental Mac utility · Built on Electron + GitHub Releases
        auto-update.
      </footer>
    </main>
  );
}
