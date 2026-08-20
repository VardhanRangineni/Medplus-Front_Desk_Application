export const LOOKUP_DEBOUNCE_MS = 650;

export const HRMS_MIN_ID_LENGTH = 6;

export const MOBILE_LOOKUP_LENGTH = 10;

export function cancelDebouncedLookup(generationRef, timerRef) {
  generationRef.current += 1;
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

export function scheduleDebouncedLookup(generationRef, timerRef, fn, delay = LOOKUP_DEBOUNCE_MS) {
  if (timerRef.current) clearTimeout(timerRef.current);
  const generation = ++generationRef.current;
  timerRef.current = setTimeout(async () => {
    if (generation !== generationRef.current) return;
    await fn();
  }, delay);
  return generation;
}

export function isLookupStale(generation, generationRef) {
  return generation !== generationRef.current;
}
