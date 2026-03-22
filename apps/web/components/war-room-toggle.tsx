"use client";

import { useEffect, useState } from "react";

const WAR_ROOM_KEY = "reliai:war-room";

export function WarRoomToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(WAR_ROOM_KEY);
    setEnabled(stored === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(WAR_ROOM_KEY, enabled ? "1" : "0");
    document.body.classList.toggle("war-room", enabled);
  }, [enabled]);

  return (
    <button
      type="button"
      onClick={() => setEnabled((prev) => !prev)}
      className="war-room-toggle flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs text-steel"
    >
      <span className="text-[10px] uppercase tracking-[0.2em] text-steel">War room</span>
      <span className={`text-xs font-medium ${enabled ? "text-ink" : "text-steel"}`}>
        {enabled ? "On" : "Off"}
      </span>
    </button>
  );
}
