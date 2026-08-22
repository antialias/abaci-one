/**
 * Compatibility export for existing Abaci domain modules. The implementation
 * now lives in @tidepool/karaoke-player so FPV and Abaci share one alignment
 * model and one set of timing edge-case fixes.
 */
export {
  buildSyncedLyricsModel,
  findActiveLocation,
} from "@tidepool/karaoke-player";
export type {
  ActiveLyricLocation,
  RawAlignment,
  SongLyricsSection,
  SyncedLine,
  SyncedLyricsModel,
  SyncedSection,
  SyncedWord,
} from "@tidepool/karaoke-player";
