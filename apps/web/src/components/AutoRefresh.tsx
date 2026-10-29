"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Polls the server component while the WhatsApp link is mid-handshake. */
export function AutoRefresh({ everyMs = 4000, enabled = true }: { everyMs?: number; enabled?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(timer);
  }, [router, everyMs, enabled]);
  return null;
}
