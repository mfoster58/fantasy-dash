/** Who leads: the best value (highest, or lowest when lower is better), ties all leading; nobody with fewer than two values. */
export function leaders(values: (number | null)[], lowerIsBetter = false): boolean[] {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (present.length < 2) return values.map(() => false);
  const best = lowerIsBetter ? Math.min(...present) : Math.max(...present);
  return values.map((v) => v === best);
}
