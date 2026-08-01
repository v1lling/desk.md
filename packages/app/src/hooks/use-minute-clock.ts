import { useEffect, useState } from "react";
import { todayISO } from "@desk/core";

/** A low-frequency app clock for UI that changes at minute/day boundaries. */
export function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const update = () => setNow(new Date());
    const delay = 60_000 - (Date.now() % 60_000) + 20;
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      update();
      interval = setInterval(update, 60_000);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  return {
    now,
    today: todayISO(),
    minute: now.getHours() * 60 + now.getMinutes(),
  };
}
