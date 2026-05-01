import { useEffect, useRef, useState } from "react";
import type { UpdateStatus } from "../preload/preload";

const NOTES_KEY = "focuspad:notes";
const DEFAULT_MINUTES = 25;

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
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: "idle" });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    window.focuspad.getVersion().then(setVersion);
    setNotes(localStorage.getItem(NOTES_KEY) ?? "");
    const off = window.focuspad.onUpdateStatus(setUpdateStatus);
    return off;
  }, []);

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, notes);
  }, [notes]);

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

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div style={styles.brand}>FocusPad</div>
        <div style={styles.version}>v{version || "…"}</div>
      </header>

      <section style={styles.timerWrap}>
        <div style={styles.timer}>{formatTime(secondsLeft)}</div>
        <div style={styles.row}>
          <button style={styles.primaryBtn} onClick={() => setRunning((r) => !r)}>
            {running ? "Pause" : "Start"}
          </button>
          <button style={styles.ghostBtn} onClick={reset}>
            Reset
          </button>
        </div>
      </section>

      <section style={styles.notesWrap}>
        <label style={styles.label}>Notes</label>
        <textarea
          style={styles.notes}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Jot something down..."
        />
      </section>

      <footer style={styles.footer}>
        <button style={styles.linkBtn} onClick={checkForUpdates}>
          Check for Updates
        </button>
        <UpdateBadge status={updateStatus} />
      </footer>
    </div>
  );
}

function UpdateBadge({ status }: { status: UpdateStatus }) {
  if (status.state === "idle") return null;
  if (status.state === "checking") return <span style={styles.badge}>Checking…</span>;
  if (status.state === "none") return <span style={styles.badge}>Up to date</span>;
  if (status.state === "available")
    return <span style={styles.badge}>Found v{status.version}</span>;
  if (status.state === "downloading")
    return <span style={styles.badge}>Downloading {status.percent}%</span>;
  if (status.state === "downloaded")
    return (
      <button
        style={{ ...styles.badge, cursor: "pointer", border: "1px solid #4ade80", color: "#4ade80" }}
        onClick={() => window.focuspad.installNow()}
      >
        Restart to install v{status.version}
      </button>
    );
  if (status.state === "error")
    return <span style={{ ...styles.badge, color: "#f87171" }}>Error: {status.message}</span>;
  return null;
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    padding: "16px 18px 12px",
    boxSizing: "border-box",
    WebkitAppRegion: "drag",
  } as React.CSSProperties,
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 24,
  },
  brand: { fontWeight: 600, fontSize: 14, letterSpacing: 0.3 },
  version: { fontSize: 11, color: "#888" },
  timerWrap: {
    marginTop: 18,
    background: "#141416",
    border: "1px solid #1f1f23",
    borderRadius: 16,
    padding: 22,
    textAlign: "center",
  },
  timer: { fontSize: 56, fontWeight: 200, fontVariantNumeric: "tabular-nums", letterSpacing: -1 },
  row: { display: "flex", gap: 8, justifyContent: "center", marginTop: 14 },
  primaryBtn: {
    background: "#fff",
    color: "#0b0b0c",
    border: "none",
    padding: "9px 20px",
    borderRadius: 10,
    fontWeight: 600,
    cursor: "pointer",
    WebkitAppRegion: "no-drag",
  } as React.CSSProperties,
  ghostBtn: {
    background: "transparent",
    color: "#ccc",
    border: "1px solid #2a2a2f",
    padding: "9px 16px",
    borderRadius: 10,
    cursor: "pointer",
    WebkitAppRegion: "no-drag",
  } as React.CSSProperties,
  notesWrap: { marginTop: 16, flex: 1, display: "flex", flexDirection: "column" },
  label: { fontSize: 11, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 },
  notes: {
    flex: 1,
    background: "#141416",
    border: "1px solid #1f1f23",
    borderRadius: 12,
    color: "#f5f5f5",
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
  },
  linkBtn: {
    background: "transparent",
    border: "none",
    color: "#9ca3af",
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
    WebkitAppRegion: "no-drag",
  } as React.CSSProperties,
  badge: {
    fontSize: 11,
    color: "#9ca3af",
    background: "#141416",
    border: "1px solid #1f1f23",
    padding: "4px 8px",
    borderRadius: 6,
  },
};
