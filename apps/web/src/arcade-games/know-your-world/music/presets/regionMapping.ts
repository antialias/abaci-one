/**
 * Region to Continental Preset Mapping
 *
 * Maps region IDs (country codes, state codes) to continental music presets.
 */

import type { ContinentalPreset } from './continental'
import { getPreset } from './continental'

/**
 * Map of country ISO codes to continental preset IDs.
 * Based on geographic location and cultural/musical traditions.
 */
const countryToContinentMap: Record<string, string> = {
  // Europe
  ad: 'europe', // Andorra
  al: 'europe', // Albania
  at: 'europe', // Austria
  ba: 'europe', // Bosnia and Herzegovina
  be: 'europe', // Belgium
  bg: 'europe', // Bulgaria
  by: 'europe', // Belarus
  ch: 'europe', // Switzerland
  cy: 'europe', // Cyprus
  cz: 'europe', // Czech Republic
  de: 'europe', // Germany
  dk: 'europe', // Denmark
  ee: 'europe', // Estonia
  es: 'europe', // Spain
  fi: 'europe', // Finland
  fo: 'europe', // Faroe Islands
  fr: 'europe', // France
  gb: 'europe', // United Kingdom
  gr: 'europe', // Greece
  hr: 'europe', // Croatia
  hu: 'europe', // Hungary
  ie: 'europe', // Ireland
  is: 'europe', // Iceland
  it: 'europe', // Italy
  li: 'europe', // Liechtenstein
  lt: 'europe', // Lithuania
  lu: 'europe', // Luxembourg
  lv: 'europe', // Latvia
  mc: 'europe', // Monaco
  md: 'europe', // Moldova
  me: 'europe', // Montenegro
  mk: 'europe', // North Macedonia
  mt: 'europe', // Malta
  nl: 'europe', // Netherlands
  no: 'europe', // Norway
  pl: 'europe', // Poland
  pt: 'europe', // Portugal
  ro: 'europe', // Romania
  rs: 'europe', // Serbia
  ru: 'europe', // Russia (European cultural affinity)
  se: 'europe', // Sweden
  si: 'europe', // Slovenia
  sk: 'europe', // Slovakia
  sm: 'europe', // San Marino
  ua: 'europe', // Ukraine
  va: 'europe', // Vatican City
  xk: 'europe', // Kosovo

  // Africa
  ao: 'africa', // Angola
  bf: 'africa', // Burkina Faso
  bi: 'africa', // Burundi
  bj: 'africa', // Benin
  bw: 'africa', // Botswana
  cd: 'africa', // Democratic Republic of Congo
  cf: 'africa', // Central African Republic
  cg: 'africa', // Congo
  ci: 'africa', // Ivory Coast
  cm: 'africa', // Cameroon
  cv: 'africa', // Cape Verde
  dj: 'africa', // Djibouti
  dz: 'africa', // Algeria
  eg: 'middleEast', // Egypt (culturally Middle Eastern)
  er: 'africa', // Eritrea
  et: 'africa', // Ethiopia
  ga: 'africa', // Gabon
  gh: 'africa', // Ghana
  gm: 'africa', // Gambia
  gn: 'africa', // Guinea
  gq: 'africa', // Equatorial Guinea
  gw: 'africa', // Guinea-Bissau
  ke: 'africa', // Kenya
  km: 'africa', // Comoros
  lr: 'africa', // Liberia
  ls: 'africa', // Lesotho
  ly: 'middleEast', // Libya (culturally North African/Middle Eastern)
  ma: 'middleEast', // Morocco (culturally North African/Middle Eastern)
  mg: 'africa', // Madagascar
  ml: 'africa', // Mali
  mr: 'africa', // Mauritania
  mu: 'africa', // Mauritius
  mw: 'africa', // Malawi
  mz: 'africa', // Mozambique
  na: 'africa', // Namibia
  ne: 'africa', // Niger
  ng: 'africa', // Nigeria
  rw: 'africa', // Rwanda
  sc: 'africa', // Seychelles
  sd: 'africa', // Sudan
  sl: 'africa', // Sierra Leone
  sn: 'africa', // Senegal
  so: 'africa', // Somalia
  ss: 'africa', // South Sudan
  st: 'africa', // Sao Tome and Principe
  sz: 'africa', // Eswatini
  td: 'africa', // Chad
  tg: 'africa', // Togo
  tn: 'middleEast', // Tunisia (culturally North African/Middle Eastern)
  tz: 'africa', // Tanzania
  ug: 'africa', // Uganda
  za: 'africa', // South Africa
  zm: 'africa', // Zambia
  zw: 'africa', // Zimbabwe

  // Middle East
  ae: 'middleEast', // United Arab Emirates
  bh: 'middleEast', // Bahrain
  iq: 'middleEast', // Iraq
  ir: 'middleEast', // Iran
  il: 'middleEast', // Israel
  jo: 'middleEast', // Jordan
  kw: 'middleEast', // Kuwait
  lb: 'middleEast', // Lebanon
  om: 'middleEast', // Oman
  ps: 'middleEast', // Palestine
  qa: 'middleEast', // Qatar
  sa: 'middleEast', // Saudi Arabia
  sy: 'middleEast', // Syria
  tr: 'middleEast', // Turkey (bridge between Europe/Middle East)
  ye: 'middleEast', // Yemen

  // Asia
  af: 'asia', // Afghanistan
  am: 'asia', // Armenia
  az: 'asia', // Azerbaijan
  bd: 'asia', // Bangladesh
  bn: 'asia', // Brunei
  bt: 'asia', // Bhutan
  cn: 'asia', // China
  ge: 'asia', // Georgia
  hk: 'asia', // Hong Kong
  id: 'asia', // Indonesia
  in: 'asia', // India
  jp: 'asia', // Japan
  kg: 'asia', // Kyrgyzstan
  kh: 'asia', // Cambodia
  kp: 'asia', // North Korea
  kr: 'asia', // South Korea
  kz: 'asia', // Kazakhstan
  la: 'asia', // Laos
  lk: 'asia', // Sri Lanka
  mm: 'asia', // Myanmar
  mn: 'asia', // Mongolia
  mo: 'asia', // Macau
  mv: 'asia', // Maldives
  my: 'asia', // Malaysia
  np: 'asia', // Nepal
  ph: 'asia', // Philippines
  pk: 'asia', // Pakistan
  sg: 'asia', // Singapore
  th: 'asia', // Thailand
  tj: 'asia', // Tajikistan
  tl: 'asia', // Timor-Leste
  tm: 'asia', // Turkmenistan
  tw: 'asia', // Taiwan
  uz: 'asia', // Uzbekistan
  vn: 'asia', // Vietnam

  // North America
  ca: 'northAmerica', // Canada
  us: 'northAmerica', // United States
  mx: 'southAmerica', // Mexico (Latin American cultural affinity)
  bz: 'southAmerica', // Belize
  cr: 'southAmerica', // Costa Rica
  cu: 'southAmerica', // Cuba
  dm: 'southAmerica', // Dominica
  do: 'southAmerica', // Dominican Republic
  gd: 'southAmerica', // Grenada
  gt: 'southAmerica', // Guatemala
  hn: 'southAmerica', // Honduras
  ht: 'southAmerica', // Haiti
  jm: 'southAmerica', // Jamaica
  kn: 'southAmerica', // Saint Kitts and Nevis
  lc: 'southAmerica', // Saint Lucia
  ni: 'southAmerica', // Nicaragua
  pa: 'southAmerica', // Panama
  sv: 'southAmerica', // El Salvador
  tt: 'southAmerica', // Trinidad and Tobago
  vc: 'southAmerica', // Saint Vincent and the Grenadines

  // South America
  ar: 'southAmerica', // Argentina
  bo: 'southAmerica', // Bolivia
  br: 'southAmerica', // Brazil
  cl: 'southAmerica', // Chile
  co: 'southAmerica', // Colombia
  ec: 'southAmerica', // Ecuador
  gy: 'southAmerica', // Guyana
  pe: 'southAmerica', // Peru
  py: 'southAmerica', // Paraguay
  sr: 'southAmerica', // Suriname
  uy: 'southAmerica', // Uruguay
  ve: 'southAmerica', // Venezuela

  // Oceania
  au: 'oceania', // Australia
  fj: 'oceania', // Fiji
  fm: 'oceania', // Micronesia
  ki: 'oceania', // Kiribati
  mh: 'oceania', // Marshall Islands
  nc: 'oceania', // New Caledonia
  nr: 'oceania', // Nauru
  nz: 'oceania', // New Zealand
  pf: 'oceania', // French Polynesia
  pg: 'oceania', // Papua New Guinea
  pw: 'oceania', // Palau
  sb: 'oceania', // Solomon Islands
  to: 'oceania', // Tonga
  tv: 'oceania', // Tuvalu
  vu: 'oceania', // Vanuatu
  ws: 'oceania', // Samoa
}

/**
 * Map of US state codes to preset IDs.
 * For USA map, we use regional variations within North America.
 */
const usStateToContinentMap: Record<string, string> = {
  // All US states default to northAmerica
  // Could add regional variations in Phase 3
  al: 'northAmerica',
  ak: 'northAmerica',
  az: 'northAmerica',
  ar: 'northAmerica',
  ca: 'northAmerica',
  co: 'northAmerica',
  ct: 'northAmerica',
  de: 'northAmerica',
  fl: 'northAmerica',
  ga: 'northAmerica',
  hi: 'oceania', // Hawaii has Pacific island character
  id: 'northAmerica',
  il: 'northAmerica',
  in: 'northAmerica',
  ia: 'northAmerica',
  ks: 'northAmerica',
  ky: 'northAmerica',
  la: 'northAmerica',
  me: 'northAmerica',
  md: 'northAmerica',
  ma: 'northAmerica',
  mi: 'northAmerica',
  mn: 'northAmerica',
  ms: 'northAmerica',
  mo: 'northAmerica',
  mt: 'northAmerica',
  ne: 'northAmerica',
  nv: 'northAmerica',
  nh: 'northAmerica',
  nj: 'northAmerica',
  nm: 'northAmerica',
  ny: 'northAmerica',
  nc: 'northAmerica',
  nd: 'northAmerica',
  oh: 'northAmerica',
  ok: 'northAmerica',
  or: 'northAmerica',
  pa: 'northAmerica',
  ri: 'northAmerica',
  sc: 'northAmerica',
  sd: 'northAmerica',
  tn: 'northAmerica',
  tx: 'northAmerica',
  ut: 'northAmerica',
  vt: 'northAmerica',
  va: 'northAmerica',
  wa: 'northAmerica',
  wv: 'northAmerica',
  wi: 'northAmerica',
  wy: 'northAmerica',
  dc: 'northAmerica',
}

/**
 * Get the continental preset for a given region ID and map type.
 *
 * @param regionId - The region identifier (country code or state code)
 * @param mapType - 'world' or 'usa'
 * @returns The continental preset for this region
 */
export function getPresetForRegion(
  regionId: string | null | undefined,
  mapType: 'world' | 'usa'
): ContinentalPreset {
  if (!regionId) {
    return getPreset('default')
  }

  const normalizedId = regionId.toLowerCase()

  if (mapType === 'usa') {
    const presetId = usStateToContinentMap[normalizedId]
    return getPreset(presetId || 'northAmerica')
  }

  const presetId = countryToContinentMap[normalizedId]
  return getPreset(presetId || 'default')
}

/**
 * Get just the preset ID for a region (useful for caching/comparison).
 */
export function getPresetIdForRegion(
  regionId: string | null | undefined,
  mapType: 'world' | 'usa'
): string {
  if (!regionId) {
    return 'default'
  }

  const normalizedId = regionId.toLowerCase()

  if (mapType === 'usa') {
    return usStateToContinentMap[normalizedId] || 'northAmerica'
  }

  return countryToContinentMap[normalizedId] || 'default'
}
