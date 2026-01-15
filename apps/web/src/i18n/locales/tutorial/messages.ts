import de from "./de.json";
import en from "./en.json";
import es from "./es.json";
import goh from "./goh.json";
import hi from "./hi.json";
import ja from "./ja.json";
import la from "./la.json";

export const tutorialMessages = {
  en: en.tutorial,
  de: de.tutorial,
  ja: ja.tutorial,
  hi: hi.tutorial,
  es: es.tutorial,
  la: la.tutorial,
  goh: goh.tutorial,
} as const;
