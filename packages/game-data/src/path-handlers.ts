/** Explicit implementation IDs, not game coefficients or inferred mechanics. */
export const supportedPathHandlerIds = [
  'weighted-hit-v1',
  'combat-events-v1',
] as const;
export function unsupportedPathHandlers(ids: readonly string[] = []) {
  return ids.filter(
    (id) => !supportedPathHandlerIds.some((known) => known === id),
  );
}
