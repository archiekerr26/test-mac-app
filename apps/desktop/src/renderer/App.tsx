import { useEffect, useMemo, useRef, useState } from "react";
import type { UpdateStatus } from "../preload/preload";

const NOTES_KEY = "focuspad:notes";
const THEME_KEY = "focuspad:theme";
const DEFAULT_MINUTES = 25;

type Theme = "light" | "dark";

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function App() {
  const [version, setVersion] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_MINUTES * 60);
  const [running, setRunning] = useState(false);
  const [notes, setNotes] = useState("");
  const [theme, setTheme] = useState<Theme>("dark");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: "idle" });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    window.focuspad.getVersion().then(setVersion);
    setNotes(localStorage.getItem(NOTES_KEY) ?? "");
    const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
    const off = window.focuspad.onUpdateStatus(setUpdateStatus);
    return off;
  }, []);

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, notes);
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.body.style.background = theme === "dark" ? "#0b0b0c" : "#f5f5f7";
    document.body.style.color = theme === "dark" ? "#f5f5f5" : "#0b0b0c";
  }, [theme]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          window.focuspad.showNotification(
            "Focus session complete",
            "Nice work. Take a short break."
          );
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const reset = () => {
    setRunning(false);
    setSecondsLeft(DEFAULT_MINUTES * 60);
  };

  const checkForUpdates = async () => {
    setUpdateStatus({ state: "checking" });
    const r = await window.focuspad.checkForUpdates();
    if (!r.ok) setUpdateStatus({ state: "error", message: r.reason ?? "Unknown error" });
  };

  const t = useMemo(() => themes[theme], [theme]);

  return (
    <div style={{ ...styles.shell, background: t.bg, color: t.fg }}>
      <header style={styles.header}>
        <div style={{ ...styles.brand, color: t.fg }}>FocusPad</div>
        <div style={styles.headerRight}>
          <button
            style={{ ...styles.iconBtn, background: t.surface, borderColor: t.border, color: t.fg }}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <div style={{ ...styles.version, color: t.muted }}>v{version || "…"}</div>
        </div>
      </header>

      <section
        style={{ ...styles.timerWrap, background: t.surface, borderColor: t.border }}
      >
        <div style={styles.timer}>{formatTime(secondsLeft)}</div>
        <div style={styles.row}>
          <button
            style={{ ...styles.primaryBtn, background: t.fg, color: t.bg }}
            onClick={() => setRunning((r) => !r)}
          >
            {running ? "Pause" : "Start"}
          </button>
          <button
            style={{ ...styles.ghostBtn, color: t.fg, borderColor: t.border }}
            onClick={reset}
          >
            Reset
          </button>
        </div>
      </section>

      <section style={styles.notesWrap}>
        <label style={{ ...styles.label, color: t.muted }}>Notes</label>
        <textarea
          style={{ ...styles.notes, background: t.surface, borderColor: t.border, color: t.fg }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Jot something down..."
        />
      </section>

      <footer style={styles.footer}>
        <button
          style={{
            ...styles.updateBtn,
            background: t.surface,
            borderColor: t.border,
            color: t.fg,
          }}
          onClick={checkForUpdates}
        >
          Check for Updates
        </button>
        <UpdateBadge status={updateStatus} t={t} />
      </footer>
    </div>
  );
}

function UpdateBadge({ status, t }: { status: UpdateStatus; t: ThemeTokens }) {
  const base: React.CSSProperties = {
    fontSize: 11,
    color: t.muted,
    background: t.surface,
    border: `1px solid ${t.border}`,
    padding: "4px 8px",
    borderRadius: 6,
  };
  if (status.state === "idle") return null;
  if (status.state === "checking") return <span style={base}>Checking…</span>;
  if (status.state === "none") return <span style={base}>Up to date</span>;
  if (status.state === "available") return <span style={base}>Found v{status.version}</span>;
  if (status.state === "downloading")
    return <span style={base}>Downloading {status.percent}%</span>;
  if (status.state === "downloaded")
    return (
      <button
        style={{ ...base, cursor: "pointer", border: "1px solid #4ade80", color: "#4ade80" }}
        onClick={() => window.focuspad.installNow()}
      >
        Restart to install v{status.version}
      </button>
    );
  if (status.state === "error")
    return <span style={{ ...base, color: "#f87171" }}>Error: {status.message}</span>;
  return null;
}

type ThemeTokens = {
  bg: string;
  fg: string;
  muted: string;
  surface: string;
  border: string;
};

const themes: Record<Theme, ThemeTokens> = {
  dark: {
    bg: "#0b0b0c",
    fg: "#f5f5f5",
    muted: "#9ca3af",
    surface: "#141416",
    border: "#1f1f23",
  },
  light: {
    bg: "#f5f5f7",
    fg: "#0b0b0c",
    muted: "#6b7280",
    surface: "#ffffff",
    border: "#e5e5ea",
  },
};

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    padding: "16px 18px 12px",
    boxSizing: "border-box",
    WebkitAppRegion: "drag",
    transition: "background 200ms ease, color 200ms ease",
  } as React.CSSProperties,
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 24,
  },
  headerRight: { display: "flex", alignItems: "center", gap: 8 },
  brand: { fontWeight: 600, fontSize: 14, letterSpacing: 0.3 },
  version: { fontSize: 11 },
  iconBtn: {
    border: "1px solid",
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 11,
    cursor: "pointer",
    WebkitAppRegion: "no-drag",
  } as React.CSSProperties,
  timerWrap: {
    marginTop: 18,
    border: "1px solid",
    borderRadius: 16,
    padding: 22,
    textAlign: "center",
  },
  timer: { fontSize: 56, fontWeight: 200, fontVariantNumeric: "tabular-nums", letterSpacing: -1 },
  row: { display: "flex", gap: 8, justifyContent: "center", marginTop: 14 },
  primaryBtn: {
    border: "none",
    padding: "9px 20px",
    borderRadius: 10,
    fontWeight: 600,
    cursor: "pointer",
    WebkitAppRegion: "no-drag",
  } as React.CSSProperties,
  ghostBtn: {
    background: "transparent",
    border: "1px solid",
    padding: "9px 16px",
    borderRadius: 10,
    cursor: "pointer",
    WebkitAppRegion: "no-drag",
  } as React.CSSProperties,
  notesWrap: { marginTop: 16, flex: 1, display: "flex", flexDirection: "column" },
  label: {
    fontSize: 11,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  notes: {
    flex: 1,
    border: "1px solid",
    borderRadius: 12,
    padding: 12,
    resize: "none",
    fontSize: 13,
    lineHeight: 1.5,
    fontFamily: "inherit",
    outline: "none",
    WebkitAppRegion: "no-drag",
  } as React.CSSProperties,
  footer: {
    marginTop: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  updateBtn: {
    border: "1px solid",
    padding: "6px 12px",
    borderRadius: 8,
    fontSize: 12,
    cursor: "pointer",
    WebkitAppRegion: "no-drag",
  } as React.CSSProperties,
};
