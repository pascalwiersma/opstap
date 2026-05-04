/** Inchecken voor "vanavond" alleen tussen 08:00 en 22:00, Nederlandse tijd. */

import { kalenderdagAmsterdam, TIMEZONE_NL } from './nlDate';

const TZ = TIMEZONE_NL;

const START_MIN = 8 * 60;
/** Eind van het venster: tot 22:00 (22:00 zelf is gesloten) */
const END_MIN = 22 * 60;

/** Kalenderdatum vandaag in Amsterdam als YYYY-MM-DD */
export function vandaagAmsterdam(now: Date = new Date()): string {
  return kalenderdagAmsterdam(now);
}

/** Minuten sinds middernacht in Amsterdam (0–1439) */
function minutenNuAmsterdam(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return hour * 60 + minute;
}

export type CheckInVenster = 'open' | 'voor_8' | 'na_22';

export function checkInVensterStatus(now: Date = new Date()): CheckInVenster {
  const m = minutenNuAmsterdam(now);
  if (m >= START_MIN && m < END_MIN) return 'open';
  if (m < START_MIN) return 'voor_8';
  return 'na_22';
}

export function isCheckInVensterOpen(now: Date = new Date()): boolean {
  return checkInVensterStatus(now) === 'open';
}

export function checkInVensterTeksten(): { titel: string; uitleg: string } {
  const s = checkInVensterStatus();
  if (s === 'open') {
    return { titel: '', uitleg: '' };
  }
  if (s === 'voor_8') {
    return {
      titel: 'Nog even geduld',
      uitleg: 'Je kunt vanaf 08:00 inchecken dat je vanavond uitgaat in Groningen.',
    };
  }
  return {
    titel: 'Inchecken gesloten',
    uitleg:
      'Inchecken voor vanavond sluit om 22:00. Je kunt morgen om 08:00 weer inchecken voor de volgende avond.',
  };
}

// ── Avond: 22:00 = groepen, 23:00 = definitief (Europe/Amsterdam) ─────────────

export type AvondFase = 'voor_22' | 'tussen_22_23' | 'na_23';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function amsterdamPartsAtUtc(ms: number): { date: string; hour: number; minute: number; second: number } {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(ms))) {
    if (p.type !== 'literal') o[p.type] = p.value;
  }
  return {
    date: `${o.year}-${o.month}-${o.day}`,
    hour: parseInt(o.hour ?? '0', 10),
    minute: parseInt(o.minute ?? '0', 10),
    second: parseInt(o.second ?? '0', 10),
  };
}

/** Streng vóór deze lokale kloktijd op deze kalenderdag (Amsterdam). */
function isAmsterdamVoorKlok(ms: number, datumYmd: string, uur: number, minuut: number): boolean {
  const p = amsterdamPartsAtUtc(ms);
  const a = `${p.date}T${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`;
  const grens = `${datumYmd}T${pad2(uur)}:${pad2(minuut)}:00`;
  return a < grens;
}

/** Eerste UTC-moment waarop Amsterdam deze muurklok bereikt (22:00 = start van dat minuut‑slot). */
export function utcMsAmsterdamKlok(datumYmd: string, uur: number, minuut: number): number {
  let lo = 0;
  let hi = 4102444800000;
  for (let i = 0; i < 56; i++) {
    const mid = (lo + hi) / 2;
    if (isAmsterdamVoorKlok(mid, datumYmd, uur, minuut)) lo = mid;
    else hi = mid;
  }
  return Math.ceil(hi);
}

export function avondFase(now: Date = new Date()): AvondFase {
  const d = vandaagAmsterdam(now);
  const t = now.getTime();
  const t22 = utcMsAmsterdamKlok(d, 22, 0);
  const t23 = utcMsAmsterdamKlok(d, 23, 0);
  if (t < t22) return 'voor_22';
  if (t < t23) return 'tussen_22_23';
  return 'na_23';
}

/** Milliseconden tot een vaste kloktijd vandaag (Amsterdam); 0 als die tijd al geweest is. */
export function msTotAmsterdamKlokVandaag(uur: number, minuut: number, nu: Date = new Date()): number {
  const d = vandaagAmsterdam(nu);
  const grens = utcMsAmsterdamKlok(d, uur, minuut);
  return Math.max(0, grens - nu.getTime());
}

/** Leesbare afteller voor timers (compact). */
export function formatAftellen(ms: number): string {
  if (ms <= 0) return '0:00';
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}u ${m.toString().padStart(2, '0')}m`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
