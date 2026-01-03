import de from "./de.json";
import en from "./en.json";
import es from "./es.json";
import goh from "./goh.json";
import hi from "./hi.json";
import ja from "./ja.json";
import la from "./la.json";

export const gamesMessages = {
  en: en.games,
  de: de.games,
  ja: ja.games,
  hi: hi.games,
  es: es.games,
  la: la.games,
  goh: goh.games,
} as const;
