/**
 * regions.ts — turning a country + postcode into something two places can be
 * compared on.
 *
 * A player in Melbourne should not be offered a table in London, and once there
 * are enough shops, not one in Perth either. The unit we compare on is a
 * REGION: a short opaque string that means "close enough to be worth showing".
 *
 *   AU 3065  → 'AU-VIC'      Australian postcodes map cleanly onto states.
 *   GB SW1A  → 'GB'          The UK has no state layer, so the whole country
 *                            is one region for now — with only a handful of
 *                            English shops, splitting them apart would hide
 *                            venues rather than tidy the list.
 *   NZ 6011  → 'NZ'          Same reasoning as the UK.
 *   US 10001 → 'US'          Likewise — and the day there are enough American
 *                            shops for this to be silly, it wants states, not
 *                            a country.
 *
 * Regions are namespaced by country so two countries can never collide, and
 * they are opaque: nothing outside this file should parse one or assume that
 * 'GB' stays a single region. When UK shops are dense enough to be worth
 * grouping, `regionFor` grows a UK branch and every picker follows — which is
 * the whole reason this is derived in code rather than stored in a column.
 *
 * DEGRADING GRACEFULLY IS THE POINT. `regionFor` returns null for anything it
 * cannot place, and `isInRegion` treats a null on EITHER side as a match. A
 * club with no address, a venue an admin has not given a postcode, a user who
 * predates this feature — all of them keep seeing and being seen exactly as
 * before. The filter only ever removes a venue it is confident is far away.
 */

/**
 * The countries a user can pick during onboarding.
 *
 * Alphabetical by name, which is the order the select renders. Only Australia
 * subdivides — see `regionFor`. Adding a country here is what makes venues in
 * it filterable at all: an unlisted country derives no region, and a venue with
 * no region is shown to everybody.
 */
export const COUNTRIES = [
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]['code'];

export function isSupportedCountry(code: string | null | undefined): code is CountryCode {
  return !!code && COUNTRIES.some(c => c.code === code);
}

/** Australian states, by the abbreviation used in a region code. */
export const AU_STATES = {
  ACT: 'Australian Capital Territory',
  NSW: 'New South Wales',
  NT:  'Northern Territory',
  QLD: 'Queensland',
  SA:  'South Australia',
  TAS: 'Tasmania',
  VIC: 'Victoria',
  WA:  'Western Australia',
} as const;

export type AuState = keyof typeof AU_STATES;

/**
 * Australian postcode ranges, in the order they must be tested.
 *
 * ORDER MATTERS. The 2xxx block is not contiguous — the ACT sits inside NSW in
 * two separate slices (2600–2618 and 2900–2920), so the ACT ranges are listed
 * before the NSW ones that surround them and the first match wins. Writing
 * these as one sorted list would quietly hand Canberra to NSW.
 *
 * The 1xxx, 8xxx and 9xxx blocks are PO-box-only ranges for NSW, VIC and QLD
 * respectively; someone typing one is telling us their state just as clearly as
 * a street postcode would.
 */
const AU_RANGES: Array<[from: number, to: number, state: AuState]> = [
  [ 200,  299, 'ACT'],
  [ 800,  999, 'NT' ],
  [1000, 1999, 'NSW'],  // PO boxes
  [2600, 2618, 'ACT'],  // inside the NSW block — must be tested first
  [2900, 2920, 'ACT'],  // likewise
  [2000, 2599, 'NSW'],
  [2619, 2899, 'NSW'],
  [2921, 2999, 'NSW'],
  [3000, 3999, 'VIC'],
  [4000, 4999, 'QLD'],
  [5000, 5999, 'SA' ],
  [6000, 6999, 'WA' ],
  [7000, 7999, 'TAS'],
  [8000, 8999, 'VIC'],  // PO boxes
  [9000, 9999, 'QLD'],  // PO boxes
];

/**
 * Normalise a postcode for storage and comparison.
 *
 * Uppercased, and inner whitespace collapsed away entirely so "SW1A 1AA" and
 * "sw1a1aa" are the same value. Returns null for anything blank.
 */
export function normalisePostcode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, '').toUpperCase();
  return cleaned || null;
}

/** The Australian state a postcode falls in, or null if it isn't one. */
export function auStateFor(postcode: string | null | undefined): AuState | null {
  const cleaned = normalisePostcode(postcode);
  if (!cleaned || !/^\d{4}$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return AU_RANGES.find(([from, to]) => n >= from && n <= to)?.[2] ?? null;
}

/**
 * The region for a country + postcode, or null if it can't be placed.
 *
 * Null is not a failure — see the note at the top of this file. It means "we
 * don't know", and every caller treats that as "show it".
 */
export function regionFor(
  country: string | null | undefined,
  postcode: string | null | undefined,
): string | null {
  if (!country) return null;
  const code = country.trim().toUpperCase();

  if (code === 'AU') {
    const state = auStateFor(postcode);
    return state ? `AU-${state}` : null;
  }

  // Every other supported country is one region. A UK postcode is still
  // required at onboarding — it costs nothing to collect now and is what a
  // finer UK grouping would be built from later — but it does not subdivide.
  if (isSupportedCountry(code)) return code;

  return null;
}

/**
 * Whether a venue in `venueRegion` should be offered to a user in `userRegion`.
 *
 * An unknown on either side matches. The filter exists to remove venues we know
 * are far away, never to hide ones we simply have no information about.
 */
export function isInRegion(
  userRegion: string | null,
  venueRegion: string | null,
): boolean {
  if (!userRegion || !venueRegion) return true;
  return userRegion === venueRegion;
}

/** Anything carrying the two raw columns — a location row or a user profile. */
export interface HasRegion {
  country?: string | null;
  postcode?: string | null;
}

/** `regionFor` applied to a row that carries the columns. */
export function regionOf(row: HasRegion | null | undefined): string | null {
  return row ? regionFor(row.country, row.postcode) : null;
}

/**
 * Keep only the venues worth offering someone in `userRegion`.
 *
 * Callers pair this with a "show all venues" escape hatch rather than using it
 * as a wall: someone travelling interstate, or living either side of a border,
 * still has to be able to book.
 */
export function inRegionOf<T extends HasRegion>(items: T[], userRegion: string | null): T[] {
  if (!userRegion) return items;
  return items.filter(item => isInRegion(userRegion, regionOf(item)));
}

/**
 * A human label for a region code — for admin screens and the "showing venues
 * in X" line. Falls back to the code itself for anything unrecognised.
 */
export function regionLabel(region: string | null): string | null {
  if (!region) return null;
  if (region.startsWith('AU-')) {
    const state = region.slice(3) as AuState;
    return AU_STATES[state] ?? region;
  }
  return COUNTRIES.find(c => c.code === region)?.name ?? region;
}

/**
 * Why a postcode can't be accepted, or null if it's fine.
 *
 * Only validates shapes we actually derive a region from — an Australian
 * postcode must be four digits, or the user would silently end up in no region
 * and be shown every venue on the platform. UK postcodes are checked loosely:
 * the full rules have enough exceptions that a strict pattern would reject real
 * addresses, and nothing downstream depends on the format.
 */
export function validatePostcode(country: string, postcode: string): string | null {
  const cleaned = normalisePostcode(postcode);
  if (!cleaned) return 'Please enter your postcode.';

  if (country === 'AU') {
    if (!/^\d{4}$/.test(cleaned)) return 'An Australian postcode is four digits, e.g. 3065.';
    if (!auStateFor(cleaned)) return 'That is not a postcode we recognise.';
    return null;
  }

  if (country === 'GB') {
    if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(cleaned)) {
      return 'Please enter a full UK postcode, e.g. SW1A 1AA.';
    }
    return null;
  }

  // New Zealand postcodes are four digits, the same shape as Australian ones.
  // They never collide, because a region is namespaced by country before the
  // postcode is looked at — NZ 6011 is 'NZ', not 'AU-WA'.
  if (country === 'NZ') {
    if (!/^\d{4}$/.test(cleaned)) return 'A New Zealand postcode is four digits, e.g. 6011.';
    return null;
  }

  // ZIP, with or without the +4 extension.
  if (country === 'US') {
    if (!/^\d{5}(\d{4})?$/.test(cleaned)) return 'A US ZIP code is five digits, e.g. 10001.';
    return null;
  }

  return null;
}
