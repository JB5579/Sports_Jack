import { useEffect, useState } from "react";

/**
 * Count down from the server's last figure on this phone's clock. The server sends the
 * lobby and an idle table only when something changes, so the seconds run down here and
 * reset to the server's value whenever a new one arrives.
 */
export function useCountdown(seconds: number | null): number | null {
  const [state, setState] = useState(() => ({ from: seconds, at: Date.now(), now: Date.now() }));
  if (state.from !== seconds) setState({ from: seconds, at: Date.now(), now: Date.now() });
  useEffect(() => {
    const t = setInterval(() => setState((s) => ({ ...s, now: Date.now() })), 1000);
    return () => clearInterval(t);
  }, []);
  if (state.from === null) return null;
  return Math.max(0, Math.round(state.from - (state.now - state.at) / 1000));
}
