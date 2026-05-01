import { useEffect, useMemo, useRef, useState } from "react";
import type { AudioState, UpdateStatus } from "../preload/preload";

const initial: AudioState = {
  outputVolume: 0,
  outputMuted: false,
  inputVolume: 0,
  inputMuted: false,
  inputs: [],
  outputs: [],
  defaultInput: "",
  defaultOutput: "",
  activeApp: "",
};

export function App() {
  const [version, setVersion] = useState("");
  const [state, setState] = useState<AudioState>(initial);
  const [notes, setNotes] = useState("");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: "idle" });
  // Track local slider drag so external polls don't yank the thumb.
  const [draggingOutput, setDraggingOutput] = useState(false);
  const [draggingInput, setDraggingInput] = useState(false);
  const [localOutput, setLocalOutput] = useState(0);
  const [localInput, setLocalInput] = useState(0);
  const notesDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void window.mc.getVersion().then(setVersion);
    void window.mc.loadNotes().then((n) => setNotes(n ?? ""));
    const offState = window.mc.onAudioState(setState);
    const offUpdate = window.mc.onUpdateStatus(setUpdateStatus);
    return () => {
      offState();
      offUpdate();
    };
  }, []);

  useEffect(() => {
    if (!draggingOutput) setLocalOutput(state.outputVolume);
  }, [state.outputVolume, draggingOutput]);
  useEffect(() => {
    if (!draggingInput) setLocalInput(state.inputVolume);
  }, [state.inputVolume, draggingInput]);

  useEffect(() => {
    if (notesDebounce.current) clearTimeout(notesDebounce.current);
    notesDebounce.current = setTimeout(() => void window.mc.saveNotes(notes), 400);
  }, [notes]);

  const checkForUpdates = async () => {
    setUpdateStatus({ state: "checking" });
    const r = await window.mc.checkForUpdates();
    if (!r.ok) setUpdateStatus({ state: "error", message: r.reason ?? "Unknown error" });
  };

  const outputVolDisplay = draggingOutput ? localOutput : state.outputVolume;
  const inputVolDisplay = draggingInput ? localInput : state.inputVolume;

  return (
    <div style={styles.shell}>
      <div style={styles.header}>
        <div style={styles.brand}>
          <span style={styles.brandDot} />
          MeetCommand
        </div>
        <button style={styles.iconBtn} onClick={() => window.mc.hidePanel()} title="Hide">
          ✕
        </button>
      </div>

      {state.activeApp && (
        <div style={styles.activeApp} title={state.activeApp}>
          Frontmost: <strong style={{ color: "#e5e7eb" }}>{state.activeApp}</strong>
        </div>
      )}

      <DeviceCard
        label="Microphone"
        icon="🎙"
        muted={state.inputMuted}
        muteLabel={state.inputMuted ? "Muted" : "Live"}
        onToggleMute={() => window.mc.toggleInputMute()}
        volume={inputVolDisplay}
        onVolumeChange={(v) => {
          setLocalInput(v);
          setDraggingInput(true);
        }}
        onVolumeCommit={(v) => {
          setDraggingInput(false);
          void window.mc.setInputVolume(v);
        }}
        currentDevice={state.defaultInput}
        devices={state.inputs}
        onDeviceChange={(name) => void window.mc.setDefaultInput(name)}
      />

      <DeviceCard
        label="Output"
        icon="🔊"
        muted={state.outputMuted}
        muteLabel={state.outputMuted ? "Muted" : "On"}
        onToggleMute={() => window.mc.toggleOutputMute()}
        volume={outputVolDisplay}
        onVolumeChange={(v) => {
          setLocalOutput(v);
          setDraggingOutput(true);
        }}
        onVolumeCommit={(v) => {
          setDraggingOutput(false);
          void window.mc.setOutputVolume(v);
        }}
        currentDevice={state.defaultOutput}
        devices={state.outputs}
        onDeviceChange={(name) => void window.mc.setDefaultOutput(name)}
      />

      <div style={styles.actionsRow}>
        <button style={styles.action} onClick={() => window.mc.openCameraSettings()}>
          Camera settings
        </button>
        <button style={styles.action} onClick={() => window.mc.openSoundSettings()}>
          Sound settings
        </button>
      </div>

      <div style={styles.notesWrap}>
        <label style={styles.notesLabel}>Notes</label>
        <textarea
          style={styles.notes}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Quick notes, autosaved..."
        />
      </div>

      <footer style={styles.footer}>
        <span style={styles.version}>v{version || "…"}</span>
        <UpdateBadge status={updateStatus} onCheck={checkForUpdates} />
      </footer>
    </div>
  );
}

function DeviceCard({
  label,
  icon,
  muted,
  muteLabel,
  onToggleMute,
  volume,
  onVolumeChange,
  onVolumeCommit,
  currentDevice,
  devices,
  onDeviceChange,
}: {
  label: string;
  icon: string;
  muted: boolean;
  muteLabel: string;
  onToggleMute: () => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  onVolumeCommit: (v: number) => void;
  currentDevice: string;
  devices: { id: string; name: string }[];
  onDeviceChange: (name: string) => void;
}) {
  return (
    <div style={styles.deviceCard}>
      <div style={styles.deviceHeader}>
        <span style={styles.deviceTitle}>
          <span style={styles.deviceIcon}>{icon}</span>
          {label}
        </span>
        <button
          onClick={onToggleMute}
          style={{
            ...styles.muteBtn,
            ...(muted ? styles.muteBtnActive : {}),
          }}
        >
          {muteLabel}
        </button>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={volume}
        onChange={(e) => onVolumeChange(parseInt(e.target.value, 10))}
        onMouseUp={(e) => onVolumeCommit(parseInt((e.target as HTMLInputElement).value, 10))}
        onTouchEnd={(e) =>
          onVolumeCommit(parseInt((e.target as HTMLInputElement).value, 10))
        }
        style={styles.slider}
      />

      <select
        value={currentDevice}
        onChange={(e) => onDeviceChange(e.target.value)}
        style={styles.select}
      >
        {devices.length === 0 && <option value="">No devices found</option>}
        {!devices.some((d) => d.name === currentDevice) && currentDevice && (
          <option value={currentDevice}>{currentDevice}</option>
        )}
        {devices.map((d) => (
          <option key={d.id} value={d.name}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function UpdateBadge({
  status,
  onCheck,
}: {
  status: UpdateStatus;
  onCheck: () => void;
}) {
  const text = useMemo(() => {
    switch (status.state) {
      case "checking":
        return "Checking…";
      case "none":
        return "Up to date";
      case "available":
        return `Found v${status.version}`;
      case "downloading":
        return `Downloading ${status.percent}%`;
      case "downloaded":
        return `Restart to install v${status.version}`;
      case "error":
        return `Error: ${status.message}`;
      default:
        return "Check for updates";
    }
  }, [status]);

  if (status.state === "downloaded") {
    return (
      <button
        style={{ ...styles.updateBtn, color: "#4ade80", borderColor: "#4ade80" }}
        onClick={() => void window.mc.installNow()}
      >
        {text}
      </button>
    );
  }
  return (
    <button
      style={{
        ...styles.updateBtn,
        color: status.state === "error" ? "#f87171" : "#9ca3af",
      }}
      onClick={onCheck}
    >
      {text}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    height: "100vh",
    padding: "14px 14px 12px",
    boxSizing: "border-box",
    background: "rgba(20, 20, 22, 0.88)",
    backdropFilter: "blur(24px) saturate(160%)",
    WebkitBackdropFilter: "blur(24px) saturate(160%)",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#f5f5f5",
    overflow: "hidden",
  } as React.CSSProperties,
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    WebkitAppRegion: "drag",
  } as React.CSSProperties,
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    background: "linear-gradient(135deg,#22d3ee,#6366f1)",
  },
  iconBtn: {
    background: "transparent",
    color: "#9ca3af",
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    padding: 4,
    WebkitAppRegion: "no-drag",
  } as React.CSSProperties,
  activeApp: {
    fontSize: 11,
    color: "#9ca3af",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  deviceCard: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: 10,
  },
  deviceHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deviceTitle: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 500,
  },
  deviceIcon: { fontSize: 13 },
  muteBtn: {
    background: "transparent",
    color: "#d1d5db",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "3px 10px",
    borderRadius: 6,
    fontSize: 11,
    cursor: "pointer",
    WebkitAppRegion: "no-drag",
  } as React.CSSProperties,
  muteBtnActive: {
    background: "#f87171",
    color: "#0b0b0c",
    borderColor: "#f87171",
    fontWeight: 600,
  },
  slider: {
    width: "100%",
    accentColor: "#fff",
    WebkitAppRegion: "no-drag",
  } as React.CSSProperties,
  select: {
    width: "100%",
    background: "rgba(0,0,0,0.3)",
    color: "#f5f5f5",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 6,
    padding: "5px 6px",
    fontSize: 11,
    WebkitAppRegion: "no-drag",
  } as React.CSSProperties,
  actionsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  action: {
    background: "rgba(255,255,255,0.06)",
    color: "#f5f5f5",
    border: "1px solid rgba(255,255,255,0.08)",
    padding: "7px 10px",
    borderRadius: 8,
    fontSize: 12,
    cursor: "pointer",
    WebkitAppRegion: "no-drag",
  } as React.CSSProperties,
  notesWrap: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 },
  notesLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#9ca3af",
    marginBottom: 4,
  },
  notes: {
    flex: 1,
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 8,
    color: "#f5f5f5",
    padding: 8,
    resize: "none",
    fontSize: 12,
    lineHeight: 1.5,
    fontFamily: "inherit",
    outline: "none",
    WebkitAppRegion: "no-drag",
  } as React.CSSProperties,
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  version: { fontSize: 11, color: "#6b7280" },
  updateBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 11,
    cursor: "pointer",
    WebkitAppRegion: "no-drag",
  } as React.CSSProperties,
};
