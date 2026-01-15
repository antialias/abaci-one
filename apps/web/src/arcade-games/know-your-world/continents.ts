/**
 * Continent mappings for world countries
 * Maps ISO 3166-1 alpha-2 country codes to continents
 */

export type ContinentId =
  | 'africa'
  | 'asia'
  | 'europe'
  | 'north-america'
  | 'south-america'
  | 'oceania'
  | 'antarctica'

export interface Continent {
  id: ContinentId
  name: string
  emoji: string
}

export const CONTINENTS: Continent[] = [
  { id: 'africa', name: 'Africa', emoji: '🌍' },
  { id: 'asia', name: 'Asia', emoji: '🌏' },
  { id: 'europe', name: 'Europe', emoji: '🇪🇺' },
  { id: 'north-america', name: 'North America', emoji: '🌎' },
  { id: 'south-america', name: 'South America', emoji: '🌎' },
  { id: 'oceania', name: 'Oceania', emoji: '🌏' },
  { id: 'antarctica', name: 'Antarctica', emoji: '🇦🇶' },
]

/**
 * Map of country codes to continents
 * Based on ISO 3166-1 alpha-2 codes from @svg-maps/world
 */
export const COUNTRY_TO_CONTINENT: Record<string, ContinentId> = {
  // Africa
  dz: 'africa', // Algeria
  ao: 'africa', // Angola
  bj: 'africa', // Benin
  bw: 'africa', // Botswana
  bf: 'africa', // Burkina Faso
  bi: 'africa', // Burundi
  cm: 'africa', // Cameroon
  cv: 'africa', // Cape Verde
  cf: 'africa', // Central African Republic
  td: 'africa', // Chad
  km: 'africa', // Comoros
  cg: 'africa', // Congo (Brazzaville)
  cd: 'africa', // Congo (Kinshasa)
  ci: 'africa', // Côte d'Ivoire
  dj: 'africa', // Djibouti
  eg: 'africa', // Egypt
  gq: 'africa', // Equatorial Guinea
  er: 'africa', // Eritrea
  sz: 'africa', // Eswatini
  et: 'africa', // Ethiopia
  ga: 'africa', // Gabon
  gm: 'africa', // Gambia
  gh: 'africa', // Ghana
  gn: 'africa', // Guinea
  gw: 'africa', // Guinea-Bissau
  ke: 'africa', // Kenya
  ls: 'africa', // Lesotho
  lr: 'africa', // Liberia
  ly: 'africa', // Libya
  mg: 'africa', // Madagascar
  mw: 'africa', // Malawi
  ml: 'africa', // Mali
  mr: 'africa', // Mauritania
  mu: 'africa', // Mauritius
  yt: 'africa', // Mayotte
  ma: 'africa', // Morocco
  mz: 'africa', // Mozambique
  na: 'africa', // Namibia
  ne: 'africa', // Niger
  ng: 'africa', // Nigeria
  re: 'africa', // Réunion
  rw: 'africa', // Rwanda
  st: 'africa', // São Tomé and Príncipe
  sn: 'africa', // Senegal
  sc: 'africa', // Seychelles
  sl: 'africa', // Sierra Leone
  so: 'africa', // Somalia
  za: 'africa', // South Africa
  ss: 'africa', // South Sudan
  sd: 'africa', // Sudan
  tz: 'africa', // Tanzania
  tg: 'africa', // Togo
  tn: 'africa', // Tunisia
  ug: 'africa', // Uganda
  eh: 'africa', // Western Sahara
  zm: 'africa', // Zambia
  zw: 'africa', // Zimbabwe

  // Asia
  af: 'asia', // Afghanistan
  am: 'asia', // Armenia
  az: 'asia', // Azerbaijan
  bh: 'asia', // Bahrain
  bd: 'asia', // Bangladesh
  bt: 'asia', // Bhutan
  bn: 'asia', // Brunei
  kh: 'asia', // Cambodia
  cn: 'asia', // China
  cx: 'asia', // Christmas Island
  cc: 'asia', // Cocos Islands
  ge: 'asia', // Georgia
  hk: 'asia', // Hong Kong
  in: 'asia', // India
  id: 'asia', // Indonesia
  ir: 'asia', // Iran
  iq: 'asia', // Iraq
  il: 'asia', // Israel
  jp: 'asia', // Japan
  jo: 'asia', // Jordan
  kz: 'asia', // Kazakhstan
  kp: 'asia', // North Korea
  kr: 'asia', // South Korea
  kw: 'asia', // Kuwait
  kg: 'asia', // Kyrgyzstan
  la: 'asia', // Laos
  lb: 'asia', // Lebanon
  mo: 'asia', // Macau
  my: 'asia', // Malaysia
  mv: 'asia', // Maldives
  mn: 'asia', // Mongolia
  mm: 'asia', // Myanmar
  np: 'asia', // Nepal
  om: 'asia', // Oman
  pk: 'asia', // Pakistan
  ps: 'asia', // Palestine
  ph: 'asia', // Philippines
  qa: 'asia', // Qatar
  sa: 'asia', // Saudi Arabia
  sg: 'asia', // Singapore
  lk: 'asia', // Sri Lanka
  sy: 'asia', // Syria
  tw: 'asia', // Taiwan
  tj: 'asia', // Tajikistan
  th: 'asia', // Thailand
  tl: 'asia', // Timor-Leste
  tr: 'asia', // Turkey (transcontinental, but primarily Asian)
  tm: 'asia', // Turkmenistan
  ae: 'asia', // United Arab Emirates
  uz: 'asia', // Uzbekistan
  vn: 'asia', // Vietnam
  ye: 'asia', // Yemen

  // Europe
  ax: 'europe', // Åland Islands
  al: 'europe', // Albania
  ad: 'europe', // Andorra
  at: 'europe', // Austria
  by: 'europe', // Belarus
  be: 'europe', // Belgium
  ba: 'europe', // Bosnia and Herzegovina
  bg: 'europe', // Bulgaria
  hr: 'europe', // Croatia
  cy: 'europe', // Cyprus
  cz: 'europe', // Czech Republic
  dk: 'europe', // Denmark
  ee: 'europe', // Estonia
  fo: 'europe', // Faroe Islands
  fi: 'europe', // Finland
  fr: 'europe', // France
  de: 'europe', // Germany
  gi: 'europe', // Gibraltar
  gr: 'europe', // Greece
  gg: 'europe', // Guernsey
  hu: 'europe', // Hungary
  is: 'europe', // Iceland
  ie: 'europe', // Ireland
  im: 'europe', // Isle of Man
  it: 'europe', // Italy
  je: 'europe', // Jersey
  xk: 'europe', // Kosovo
  lv: 'europe', // Latvia
  li: 'europe', // Liechtenstein
  lt: 'europe', // Lithuania
  lu: 'europe', // Luxembourg
  mk: 'europe', // North Macedonia
  mt: 'europe', // Malta
  md: 'europe', // Moldova
  mc: 'europe', // Monaco
  me: 'europe', // Montenegro
  nl: 'europe', // Netherlands
  no: 'europe', // Norway
  pl: 'europe', // Poland
  pt: 'europe', // Portugal
  ro: 'europe', // Romania
  ru: 'europe', // Russia (transcontinental, but primarily European for map purposes)
  sm: 'europe', // San Marino
  rs: 'europe', // Serbia
  sk: 'europe', // Slovakia
  si: 'europe', // Slovenia
  es: 'europe', // Spain
  sj: 'europe', // Svalbard and Jan Mayen
  se: 'europe', // Sweden
  ch: 'europe', // Switzerland
  ua: 'europe', // Ukraine
  gb: 'europe', // United Kingdom
  va: 'europe', // Vatican City

  // North America
  ai: 'north-america', // Anguilla
  ag: 'north-america', // Antigua and Barbuda
  aw: 'north-america', // Aruba
  bs: 'north-america', // Bahamas
  bb: 'north-america', // Barbados
  bz: 'north-america', // Belize
  bm: 'north-america', // Bermuda
  bq: 'north-america', // Caribbean Netherlands
  vg: 'north-america', // British Virgin Islands
  ca: 'north-america', // Canada
  ky: 'north-america', // Cayman Islands
  cr: 'north-america', // Costa Rica
  cu: 'north-america', // Cuba
  cw: 'north-america', // Curaçao
  dm: 'north-america', // Dominica
  do: 'north-america', // Dominican Republic
  sv: 'north-america', // El Salvador
  gl: 'north-america', // Greenland
  gd: 'north-america', // Grenada
  gp: 'north-america', // Guadeloupe
  gt: 'north-america', // Guatemala
  ht: 'north-america', // Haiti
  hn: 'north-america', // Honduras
  jm: 'north-america', // Jamaica
  mq: 'north-america', // Martinique
  mx: 'north-america', // Mexico
  ms: 'north-america', // Montserrat
  ni: 'north-america', // Nicaragua
  pa: 'north-america', // Panama
  pm: 'north-america', // Saint Pierre and Miquelon
  kn: 'north-america', // Saint Kitts and Nevis
  lc: 'north-america', // Saint Lucia
  vc: 'north-america', // Saint Vincent and the Grenadines
  sx: 'north-america', // Sint Maarten
  tt: 'north-america', // Trinidad and Tobago
  tc: 'north-america', // Turks and Caicos Islands
  us: 'north-america', // United States
  vi: 'north-america', // U.S. Virgin Islands

  // South America
  ar: 'south-america', // Argentina
  bo: 'south-america', // Bolivia
  br: 'south-america', // Brazil
  cl: 'south-america', // Chile
  co: 'south-america', // Colombia
  ec: 'south-america', // Ecuador
  fk: 'south-america', // Falkland Islands
  gf: 'south-america', // French Guiana
  gy: 'south-america', // Guyana
  py: 'south-america', // Paraguay
  pe: 'south-america', // Peru
  sr: 'south-america', // Suriname
  uy: 'south-america', // Uruguay
  ve: 'south-america', // Venezuela

  // Oceania
  as: 'oceania', // American Samoa
  au: 'oceania', // Australia
  ck: 'oceania', // Cook Islands
  fj: 'oceania', // Fiji
  pf: 'oceania', // French Polynesia
  gu: 'oceania', // Guam
  ki: 'oceania', // Kiribati
  mh: 'oceania', // Marshall Islands
  fm: 'oceania', // Micronesia
  nr: 'oceania', // Nauru
  nc: 'oceania', // New Caledonia
  nz: 'oceania', // New Zealand
  nu: 'oceania', // Niue
  nf: 'oceania', // Norfolk Island
  mp: 'oceania', // Northern Mariana Islands
  pw: 'oceania', // Palau
  pg: 'oceania', // Papua New Guinea
  pn: 'oceania', // Pitcairn Islands
  ws: 'oceania', // Samoa
  sb: 'oceania', // Solomon Islands
  tk: 'oceania', // Tokelau
  to: 'oceania', // Tonga
  tv: 'oceania', // Tuvalu
  vu: 'oceania', // Vanuatu
  wf: 'oceania', // Wallis and Futuna

  // Antarctica
  aq: 'antarctica', // Antarctica
  bv: 'antarctica', // Bouvet Island
  tf: 'antarctica', // French Southern Territories
  hm: 'antarctica', // Heard Island and McDonald Islands
  gs: 'antarctica', // South Georgia and the South Sandwich Islands
}

/**
 * Get continent for a country code
 */
export function getContinentForCountry(countryCode: string): ContinentId | null {
  return COUNTRY_TO_CONTINENT[countryCode.toLowerCase()] || null
}

/**
 * Get all country codes for a continent
 */
export function getCountriesInContinent(continentId: ContinentId): string[] {
  return Object.entries(COUNTRY_TO_CONTINENT)
    .filter(([_, continent]) => continent === continentId)
    .map(([countryCode]) => countryCode)
}
