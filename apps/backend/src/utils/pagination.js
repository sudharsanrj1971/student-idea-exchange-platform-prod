/**
 * Calculates the DB offset for pagination.
 */
export function getOffset(page = 1, limit = 20) {
  const p = Math.max(1, parseInt(page));
  const l = Math.max(1, parseInt(limit));
  return (p - 1) * l;
}
