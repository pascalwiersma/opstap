/**
 * Kalenderdagen in Nederland (Europe/Amsterdam), gelijk aan Edge Functions
 * en check-in/match-cron in de database.
 */
export const TIMEZONE_NL = 'Europe/Amsterdam';

/** YYYY-MM-DD voor de opgegeven tijd, volgens de muurklok in Nederland. */
export function kalenderdagAmsterdam(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_NL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Vorige kalenderdag in NL t.o.v. `now` (niet: UTC − 24 uur).
 * Geschikt voor labels zoals "Gisteren" bij chat-/match-datums.
 */
export function gisterenKalenderdagAmsterdam(now: Date = new Date()): string {
  const vandaag = kalenderdagAmsterdam(now);
  let t = now.getTime();
  for (let i = 0; i < 48; i++) {
    t -= 3600000;
    const d = kalenderdagAmsterdam(new Date(t));
    if (d !== vandaag) return d;
  }
  return vandaag;
}
