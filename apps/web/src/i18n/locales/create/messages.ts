import de from "./de.json";
import en from "./en.json";
import es from "./es.json";
import goh from "./goh.json";
import hi from "./hi.json";
import ja from "./ja.json";
import la from "./la.json";

export const createMessages = {
  en: en.create,
  de: de.create,
  ja: ja.create,
  hi: hi.create,
  es: es.create,
  la: la.create,
  goh: goh.create,
} as const;
