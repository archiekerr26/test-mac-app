import type { FocusPadAPI } from "../preload/preload";

declare global {
  interface Window {
    focuspad: FocusPadAPI;
  }
}

export {};
