/**
 * Vendored ISO-3166 alpha-2 calling codes for `<noizu-phone-input>`.
 * In-kit E.164 is `+<dial><national-digits>` — no libphonenumber-js.
 */

export const DEFAULT_COUNTRY = 'US';

export interface DialEntry {
  iso2: string;
  name: string;
  /** Country calling code digits, no leading `+`. */
  dial: string;
  flag: string;
}

export interface ParsedPhone {
  country: string;
  national: string;
  dial: string;
}

/** ITU E.164: 8–15 digits after `+`, first digit 1–9. */
const E164_RE = /^\+[1-9]\d{7,14}$/;

type Row = readonly [iso2: string, dial: string, name: string];

/** Preferred markets first, then remaining ISO-3166 entries A–Z. */
const ROWS: readonly Row[] = [
  ['US', '1', 'United States'],
  ['CA', '1', 'Canada'],
  ['GB', '44', 'United Kingdom'],
  ['AU', '61', 'Australia'],
  ['NZ', '64', 'New Zealand'],
  ['DE', '49', 'Germany'],
  ['FR', '33', 'France'],
  ['JP', '81', 'Japan'],
  ['KR', '82', 'South Korea'],
  ['CN', '86', 'China'],
  ['IN', '91', 'India'],
  ['TH', '66', 'Thailand'],
  ['SG', '65', 'Singapore'],
  ['AE', '971', 'United Arab Emirates'],
  ['BR', '55', 'Brazil'],
  ['MX', '52', 'Mexico'],
  ['AD', '376', 'Andorra'],
  ['AF', '93', 'Afghanistan'],
  ['AG', '1268', 'Antigua and Barbuda'],
  ['AL', '355', 'Albania'],
  ['AM', '374', 'Armenia'],
  ['AO', '244', 'Angola'],
  ['AR', '54', 'Argentina'],
  ['AT', '43', 'Austria'],
  ['AZ', '994', 'Azerbaijan'],
  ['BA', '387', 'Bosnia and Herzegovina'],
  ['BB', '1246', 'Barbados'],
  ['BD', '880', 'Bangladesh'],
  ['BE', '32', 'Belgium'],
  ['BG', '359', 'Bulgaria'],
  ['BH', '973', 'Bahrain'],
  ['BN', '673', 'Brunei'],
  ['BO', '591', 'Bolivia'],
  ['BS', '1242', 'Bahamas'],
  ['BY', '375', 'Belarus'],
  ['BZ', '501', 'Belize'],
  ['CH', '41', 'Switzerland'],
  ['CI', '225', "Côte d'Ivoire"],
  ['CL', '56', 'Chile'],
  ['CM', '237', 'Cameroon'],
  ['CO', '57', 'Colombia'],
  ['CR', '506', 'Costa Rica'],
  ['CY', '357', 'Cyprus'],
  ['CZ', '420', 'Czechia'],
  ['DK', '45', 'Denmark'],
  ['DO', '1809', 'Dominican Republic'],
  ['DZ', '213', 'Algeria'],
  ['EC', '593', 'Ecuador'],
  ['EE', '372', 'Estonia'],
  ['EG', '20', 'Egypt'],
  ['ES', '34', 'Spain'],
  ['ET', '251', 'Ethiopia'],
  ['FI', '358', 'Finland'],
  ['FJ', '679', 'Fiji'],
  ['GE', '995', 'Georgia'],
  ['GH', '233', 'Ghana'],
  ['GR', '30', 'Greece'],
  ['GT', '502', 'Guatemala'],
  ['HK', '852', 'Hong Kong'],
  ['HN', '504', 'Honduras'],
  ['HR', '385', 'Croatia'],
  ['HU', '36', 'Hungary'],
  ['ID', '62', 'Indonesia'],
  ['IE', '353', 'Ireland'],
  ['IL', '972', 'Israel'],
  ['IQ', '964', 'Iraq'],
  ['IR', '98', 'Iran'],
  ['IS', '354', 'Iceland'],
  ['IT', '39', 'Italy'],
  ['JM', '1876', 'Jamaica'],
  ['JO', '962', 'Jordan'],
  ['KE', '254', 'Kenya'],
  ['KH', '855', 'Cambodia'],
  ['KW', '965', 'Kuwait'],
  ['KZ', '7', 'Kazakhstan'],
  ['LA', '856', 'Laos'],
  ['LB', '961', 'Lebanon'],
  ['LK', '94', 'Sri Lanka'],
  ['LT', '370', 'Lithuania'],
  ['LU', '352', 'Luxembourg'],
  ['LV', '371', 'Latvia'],
  ['LY', '218', 'Libya'],
  ['MA', '212', 'Morocco'],
  ['MM', '95', 'Myanmar'],
  ['MO', '853', 'Macau'],
  ['MT', '356', 'Malta'],
  ['MY', '60', 'Malaysia'],
  ['NG', '234', 'Nigeria'],
  ['NL', '31', 'Netherlands'],
  ['NO', '47', 'Norway'],
  ['NP', '977', 'Nepal'],
  ['OM', '968', 'Oman'],
  ['PA', '507', 'Panama'],
  ['PE', '51', 'Peru'],
  ['PH', '63', 'Philippines'],
  ['PK', '92', 'Pakistan'],
  ['PL', '48', 'Poland'],
  ['PT', '351', 'Portugal'],
  ['QA', '974', 'Qatar'],
  ['RO', '40', 'Romania'],
  ['RS', '381', 'Serbia'],
  ['RU', '7', 'Russia'],
  ['SA', '966', 'Saudi Arabia'],
  ['SE', '46', 'Sweden'],
  ['SI', '386', 'Slovenia'],
  ['SK', '421', 'Slovakia'],
  ['SN', '221', 'Senegal'],
  ['TN', '216', 'Tunisia'],
  ['TR', '90', 'Turkey'],
  ['TT', '1868', 'Trinidad and Tobago'],
  ['TW', '886', 'Taiwan'],
  ['TZ', '255', 'Tanzania'],
  ['UA', '380', 'Ukraine'],
  ['UG', '256', 'Uganda'],
  ['UY', '598', 'Uruguay'],
  ['UZ', '998', 'Uzbekistan'],
  ['VE', '58', 'Venezuela'],
  ['VN', '84', 'Vietnam'],
  ['ZA', '27', 'South Africa'],
  ['ZW', '263', 'Zimbabwe'],
];

export function flagEmoji(iso2: string): string {
  const cc = iso2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
}

export const DIAL_CODES: readonly DialEntry[] = ROWS.map(([iso2, dial, name]) => ({
  iso2,
  dial,
  name,
  flag: flagEmoji(iso2),
}));

const BY_ISO = new Map<string, DialEntry>(DIAL_CODES.map((row) => [row.iso2, row]));

export function digitsOnly(raw: string): string {
  return raw.replace(/\D+/g, '');
}

export function lookupCountry(iso2: string): DialEntry {
  const key = iso2.trim().toUpperCase();
  return BY_ISO.get(key) ?? BY_ISO.get(DEFAULT_COUNTRY)!;
}

export function isValidE164(value: string): boolean {
  return E164_RE.test(value);
}

export function toE164(country: string, nationalRaw: string): string {
  const entry = lookupCountry(country);
  const trimmed = nationalRaw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
    const asPlus = trimmed.startsWith('00') ? `+${trimmed.slice(2)}` : trimmed;
    const parsed = parseE164(asPlus, entry.iso2);
    if (parsed?.national) return `+${parsed.dial}${parsed.national}`;
  }
  let national = digitsOnly(trimmed);
  if (!national) return '';
  if (national.startsWith('0') && entry.dial !== '1') {
    national = national.replace(/^0+/, '');
  }
  if (national.startsWith(entry.dial) && national.length - entry.dial.length >= 7) {
    national = national.slice(entry.dial.length);
  }
  if (!national) return '';
  return `+${entry.dial}${national}`;
}

export function parseE164(value: string, fallbackCountry = DEFAULT_COUNTRY): ParsedPhone | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const fallback = lookupCountry(fallbackCountry);
  const digits = digitsOnly(trimmed.startsWith('00') ? trimmed.slice(2) : trimmed);
  if (!digits) return null;

  if (!trimmed.startsWith('+') && !trimmed.startsWith('00')) {
    let national = digits;
    if (national.startsWith('0') && fallback.dial !== '1') {
      national = national.replace(/^0+/, '');
    }
    return {country: fallback.iso2, national, dial: fallback.dial};
  }

  let best: DialEntry | undefined;
  let bestLen = -1;
  for (const entry of DIAL_CODES) {
    if (!digits.startsWith(entry.dial)) continue;
    if (entry.dial.length > bestLen) {
      best = entry;
      bestLen = entry.dial.length;
      continue;
    }
    if (entry.dial.length === bestLen && entry.iso2 === fallback.iso2) {
      best = entry;
    }
  }
  if (!best) {
    return {country: fallback.iso2, national: digits, dial: fallback.dial};
  }
  return {
    country: best.iso2,
    national: digits.slice(best.dial.length),
    dial: best.dial,
  };
}
