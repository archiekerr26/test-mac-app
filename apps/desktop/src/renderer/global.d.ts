import type { MeetCommandAPI } from "../preload/preload";

declare global {
  interface Window {
    mc: MeetCommandAPI;
  }
}

export {};
