"use client";

import { useCallback, useEffect, useState } from "react";
import timefmt from "@utils/client/timefmt";

export function useCountdown(key) {
  // Helper to read remaining seconds from localStorage
  const readRemaining = () => {
    if (typeof window === "undefined") return 0; // avoid SSR crash
    const until = Number(localStorage.getItem(key));
    return Number.isFinite(until)
      ? Math.max(0, Math.floor((until - Date.now()) / 1000))
      : 0;
  };

  const [remainingSeconds, setRemainingSeconds] = useState(readRemaining);

  // --- Start countdown (given ms duration)
  const startCountdown = useCallback(
    (ms) => {
      const until = Date.now() + ms;
      localStorage.setItem(key, String(until));
      setRemainingSeconds(Math.ceil(ms / 1000));
    },
    [key],
  );

  // --- Directly set the end timestamp (epoch ms)
  const setUntil = useCallback(
    (epochMs) => {
      localStorage.setItem(key, String(epochMs));
      setRemainingSeconds(
        Math.max(0, Math.ceil((epochMs - Date.now()) / 1000)),
      );
    },
    [key],
  );

  // --- Cancel countdown immediately
  const cancelCountdown = useCallback(() => {
    localStorage.removeItem(key);
    setRemainingSeconds(0);
  }, [key]);

  // --- Internal interval tick
  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const id = setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = prev - 1;
        if (next <= 0) localStorage.removeItem(key);
        return next > 0 ? next : 0;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [remainingSeconds, key]);

  // --- Sync across browser tabs/windows
  useEffect(() => {
    setRemainingSeconds(readRemaining());
  }, [key]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== key) return;
      setRemainingSeconds(readRemaining());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  return {
    remainingSeconds, // numeric remaining seconds
    formattedRemaining: timefmt(remainingSeconds), // formatted "2m 15s"
    isCountingDown: remainingSeconds > 0, // clearer than "active"
    startCountdown, // ms input
    setUntil, // epoch ms input
    cancelCountdown, // manual stop
  };
}
