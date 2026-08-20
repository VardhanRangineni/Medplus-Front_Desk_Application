/** Wait until user stops typing before HRMS / person-to-meet lookups. */
export const LOOKUP_DEBOUNCE_MS = 650;

export const HRMS_MIN_ID_LENGTH = 6;

export const MOBILE_LOOKUP_LENGTH = 10;

/**
 * @param {React.MutableRefObject<number>} generationRef
 * @param {React.MutableRefObject<ReturnType<typeof setTimeout>|null>} timerRef
 */
export function cancelDebouncedLookup(generationRef, timerRef) {
  generationRef.current += 1;
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

/**
 * Schedule fn after debounce. Earlier timers + in-flight generations are invalidated.
 *
 * @param {React.MutableRefObject<number>} generationRef
 * @param {React.MutableRefObject<ReturnType<typeof setTimeout>|null>} timerRef
 * @param {() => void|Promise<void>} fn
 * @param {number} [delay]
 * @returns {number} generation token for this scheduled run
 */
export function scheduleDebouncedLookup(generationRef, timerRef, fn, delay = LOOKUP_DEBOUNCE_MS) {
  if (timerRef.current) clearTimeout(timerRef.current);
  const generation = ++generationRef.current;
  timerRef.current = setTimeout(async () => {
    if (generation !== generationRef.current) return;
    await fn();
  }, delay);
  return generation;
}

/** @param {number} generation @param {React.MutableRefObject<number>} generationRef */
export function isLookupStale(generation, generationRef) {
  return generation !== generationRef.current;
}
