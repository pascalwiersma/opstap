/** Zelfde semantiek als `utils/nlDate.ts` — kalenderdag in Europe/Amsterdam (YYYY-MM-DD). */

export function kalenderdagAmsterdam(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
