/** Leeftijd in hele jaren op ref-datum (default: vandaag). */
export function leeftijdUitGeboortedatum(geboorte: Date, ref: Date = new Date()): number {
  let age = ref.getFullYear() - geboorte.getFullYear();
  const maandDiff = ref.getMonth() - geboorte.getMonth();
  if (maandDiff < 0 || (maandDiff === 0 && ref.getDate() < geboorte.getDate())) {
    age -= 1;
  }
  return age;
}

export function formatGeboorteDb(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseGeboorteDb(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

export const MIN_ONBOARDING_LEEFTIJD = 13;
export const MAX_ONBOARDING_LEEFTIJD = 120;

/** Geldige kalenderdatums voor de picker (min ≈ 120 jaar, max ≈ 13 jaar geleden). */
export function grenzenGeboortedatum(): { min: Date; max: Date } {
  const max = new Date();
  max.setHours(12, 0, 0, 0);
  max.setFullYear(max.getFullYear() - MIN_ONBOARDING_LEEFTIJD);
  const min = new Date();
  min.setHours(12, 0, 0, 0);
  min.setFullYear(min.getFullYear() - MAX_ONBOARDING_LEEFTIJD);
  return { min, max };
}

export function validatieGeboortedatum(
  d: Date,
): { ok: true; age: number } | { ok: false; message: string } {
  const eindeDag = new Date();
  eindeDag.setHours(23, 59, 59, 999);
  if (d.getTime() > eindeDag.getTime()) {
    return { ok: false, message: 'Geboortedatum kan niet in de toekomst liggen.' };
  }
  const age = leeftijdUitGeboortedatum(d);
  if (age < MIN_ONBOARDING_LEEFTIJD) {
    return { ok: false, message: `Je moet minimaal ${MIN_ONBOARDING_LEEFTIJD} jaar zijn.` };
  }
  if (age > MAX_ONBOARDING_LEEFTIJD) {
    return { ok: false, message: 'Geboortedatum lijkt ongeldig. Controleer het jaartal.' };
  }
  return { ok: true, age };
}

export function formatGeboorteNl(d: Date): string {
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function defaultGeboorteDatum(): Date {
  const { max } = grenzenGeboortedatum();
  const d = new Date(max);
  d.setFullYear(d.getFullYear() - 12);
  return d;
}
