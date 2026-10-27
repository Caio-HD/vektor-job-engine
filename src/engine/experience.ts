const MAX_PLAUSIBLE_YEARS = 20;

// A range only requires its lower end: "2-4 years" reads as "2 years".
const YEAR_RANGE = /\b(\d{1,2})\s*(?:-|–|to|a)\s*\d{1,2}(\s*\+?\s*(?:years?|yrs?|anos)\b)/gi;

// "5+ years", "5 or more years", "at least 5 years", "minimum of 5 years".
const EN_PATTERNS: RegExp[] = [
  /\b(?:at least|minimum(?: of)?|min\.?)\s+(\d{1,2})\+?\s*(?:years?|yrs?)\b/gi,
  /\b(\d{1,2})\s*\+\s*(?:years?|yrs?)\b/gi,
  /\b(\d{1,2})\s+or\s+more\s+(?:years?|yrs?)\b/gi,
  /\b(\d{1,2})\s+(?:years?|yrs?)\s+(?:of\s+)?(?:\w+\s+){0,4}experience\b/gi,
];

// "5 anos de experiência", "mínimo de 5 anos", "experiência de 5+ anos".
const PT_PATTERNS: RegExp[] = [
  /(?:m[ií]nimo de|pelo menos|no m[ií]nimo)\s+(\d{1,2})\+?\s*anos\b/gi,
  /\b(\d{1,2})\s*\+?\s*anos\s+(?:de\s+)?(?:\S+\s+){0,4}experi[eê]ncia/gi,
  /experi[eê]ncia\s+(?:\S+\s+){0,4}(\d{1,2})\s*\+?\s*anos\b/gi,
];

/**
 * Highest number of years of experience a posting asks for, or null when it
 * states none. Postings that split requirements per skill ("React 3+ years,
 * Node 5+ years") are only reachable by meeting every one, so the highest
 * figure is the one that decides.
 */
export function requiredYearsOfExperience(text: string): number | null {
  if (!text) return null;
  const normalized = text.replace(YEAR_RANGE, '$1$2');
  let highest: number | null = null;
  for (const pattern of [...EN_PATTERNS, ...PT_PATTERNS]) {
    for (const match of normalized.matchAll(pattern)) {
      const years = Number(match[1]);
      if (years > 0 && years <= MAX_PLAUSIBLE_YEARS && (highest === null || years > highest)) {
        highest = years;
      }
    }
  }
  return highest;
}
