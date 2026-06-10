"use client";

import { useEffect, useState } from "react";
import { Clock, X } from "lucide-react";
import { API_URL } from "@/lib/api";

const DISMISS_KEY = "ohshift_cold_start_banner_dismissed";

function shouldShowBanner() {
  return API_URL.includes("onrender.com");
}

export function ColdStartBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!shouldShowBanner()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div
      role="status"
      className="relative z-[100] border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-950 dark:text-amber-100"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3 sm:items-center">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 sm:mt-0" />
        <p className="flex-1 leading-snug">
          <span className="font-medium">Heads up:</span> Our API runs on
          Render&apos;s free tier and may take up to a minute to wake up after
          idle time. If login or loading feels slow, wait a moment and try
          again.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md p-1 text-amber-700/70 transition-colors hover:bg-amber-500/15 hover:text-amber-900 dark:text-amber-300/70 dark:hover:text-amber-50"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
