import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Like useState, but the value is persisted to localStorage under `key` and
 * restored on the next mount. Local only — nothing syncs across devices.
 *
 * A stored object is shallow-merged onto `initial`, so adding a field to the
 * shape later still gets a sane default for old saved values. Parse/quota
 * failures fall back to `initial` rather than throwing.
 */
export function useLocalStorageState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  // Keep the very first `initial` for merging; ignore later identity changes.
  const initialRef = useRef(initial);

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return initialRef.current;
      const parsed = JSON.parse(raw);
      const base = initialRef.current;
      // Merge onto the default only for plain objects (not arrays/primitives).
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          && base && typeof base === 'object' && !Array.isArray(base)) {
        return { ...(base as object), ...(parsed as object) } as T;
      }
      return parsed as T;
    } catch {
      return initialRef.current;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota / disabled */ }
  }, [key, value]);

  return [value, setValue];
}
