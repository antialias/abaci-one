/**
 * Rithmomachia translations aggregated by locale
 * Co-located with the game code
 */

// Import existing locale files
import enGuide from "./i18n/locales/en.json";
import deGuide from "./i18n/locales/de.json";
import jaGuide from "./i18n/locales/ja.json";
import hiGuide from "./i18n/locales/hi.json";
import esGuide from "./i18n/locales/es.json";
import laGuide from "./i18n/locales/la.json";
import gohGuide from "./i18n/locales/goh.json";

export const rithmomachiaMessages = {
  en: { rithmomachia: enGuide },
  de: { rithmomachia: deGuide },
  ja: { rithmomachia: jaGuide },
  hi: { rithmomachia: hiGuide },
  es: { rithmomachia: esGuide },
  la: { rithmomachia: laGuide },
  goh: { rithmomachia: gohGuide },
} as const;
