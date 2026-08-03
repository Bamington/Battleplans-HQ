/**
 * useDebouncedSave.ts — local edits that write themselves a beat after typing
 * stops, and never on the way out the door.
 *
 * Every prose field in BattlePack is a <RichTextEditor>, which reports a change
 * on each keystroke and has no natural commit point. Blur is not one either: a
 * rich text editor loses focus for ordinary reasons — reaching for the bold
 * button, tabbing away mid-thought — and when the organiser switches category
 * without clicking out, blur never comes at all.
 *
 * So: debounce, plus a flush when the component unmounts. Switching category
 * unmounts the form before the debounce would have fired, and losing a sentence
 * to that would be indefensible.
 *
 * This lives in a hook because two forms need the same behaviour — Event Basics
 * for its description, and SectionForm for every section category — and a
 * second hand-rolled copy is how the two quietly stop agreeing about when a
 * write happens.
 */

import { useEffect, useRef, useState } from 'react';

export type SaveState = 'idle' | 'saving' | 'error';

export interface DebouncedSave<T> {
  value: T;
  setValue: (next: T) => void;
  state: SaveState;
}

export function useDebouncedSave<T>(
  /** The value as the database holds it. */
  stored: T,
  save: (value: T) => Promise<void> | void,
  delayMs = 1000,
): DebouncedSave<T> {
  const [value, setValueState] = useState<T>(stored);
  const [state, setState] = useState<SaveState>('idle');

  // Refs so the unmount flush sees the latest of both without re-subscribing.
  const latest = useRef(value);
  const dirty  = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  // Structural comparison rather than reference: callers pass fresh objects on
  // every render, so `stored` is a new identity each time even when unchanged.
  const storedKey = JSON.stringify(stored);
  const valueKey  = JSON.stringify(value);

  // Re-sync from the source of record — but never over the top of someone
  // mid-sentence, which is what a reload landing between keystrokes would do.
  useEffect(() => {
    if (dirty.current) return;
    setValueState(stored);
    latest.current = stored;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedKey]);

  const setValue = (next: T) => {
    dirty.current = true;
    latest.current = next;
    setValueState(next);
  };

  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(async () => {
      setState('saving');
      try {
        await saveRef.current(latest.current);
        dirty.current = false;
        setState('idle');
      } catch {
        setState('error');
      }
    }, delayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKey, delayMs]);

  useEffect(() => () => {
    if (dirty.current) void saveRef.current(latest.current);
  }, []);

  return { value, setValue, state };
}
