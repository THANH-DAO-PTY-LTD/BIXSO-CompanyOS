import { useEffect, useState } from 'react';
import { getFlowVisualStandard } from '@/lib/spFlowApi';

export const DEFAULT_VISUAL_STANDARD = Object.freeze({
  column_gap: 220,
  lane_gap: 142,
  connector_width: 2.8,
  active_connector_width: 3.6,
  arrow_size: 10,
  motion_enabled: true,
  motion_seconds: 1.1,
});

let cached = null;
let pending = null;

export default function useFlowVisualStandard(override) {
  const [standard, setStandard] = useState(() => override || cached || DEFAULT_VISUAL_STANDARD);
  useEffect(() => {
    if (override) { setStandard(override); return undefined; }
    if (cached) { setStandard(cached); return undefined; }
    if (!pending) {
      pending = getFlowVisualStandard()
        .then((value) => { cached = { ...DEFAULT_VISUAL_STANDARD, ...(value || {}) }; return cached; })
        .catch(() => DEFAULT_VISUAL_STANDARD)
        .finally(() => { pending = null; });
    }
    let live = true;
    pending.then((value) => { if (live) setStandard(value); });
    return () => { live = false; };
  }, [override]);
  return standard;
}
