"use client";

import { useAbacusDisplay } from "@soroban/abacus-react";
import { useEffect, useRef } from "react";
import {
  useAbacusSettings,
  useUpdateAbacusSettings,
} from "@/hooks/useAbacusSettings";

/**
 * Syncs abacus settings between API and localStorage
 *
 * On mount: loads settings from API into localStorage
 * On localStorage change: saves changes to API
 *
 * This component should be rendered once at the app root level.
 */
export function AbacusSettingsSync() {
  const { config, updateConfig } = useAbacusDisplay();
  const { data: apiSettings, isLoading } = useAbacusSettings();
  const { mutate: updateApiSettings } = useUpdateAbacusSettings();
  const isInitializedRef = useRef(false);
  const lastSyncedConfigRef = useRef<string | null>(null);

  // On mount: load settings from API into context (which will trigger localStorage save)
  useEffect(() => {
    if (!isLoading && apiSettings && !isInitializedRef.current) {
      // Only update if API settings differ from current config
      const apiConfigJson = JSON.stringify(apiSettings);
      const currentConfigJson = JSON.stringify(config);

      if (apiConfigJson !== currentConfigJson) {
        console.log("💾 Loading abacus settings from API");
        updateConfig(apiSettings);
        lastSyncedConfigRef.current = apiConfigJson;
      }

      isInitializedRef.current = true;
    }
  }, [apiSettings, isLoading, config, updateConfig]);

  // On config change: save to API (but skip the initial load to avoid race conditions)
  useEffect(() => {
    if (!isInitializedRef.current) return;

    const configJson = JSON.stringify(config);

    // Only sync if config has changed since last sync
    if (configJson !== lastSyncedConfigRef.current) {
      console.log("🔄 Syncing abacus settings to API");

      // Only sync abacus-react config fields, not app-specific fields like nativeAbacusNumbers
      const abacusReactFields = {
        colorScheme: config.colorScheme,
        beadShape: config.beadShape,
        colorPalette: config.colorPalette,
        hideInactiveBeads: config.hideInactiveBeads,
        coloredNumerals: config.coloredNumerals,
        scaleFactor: config.scaleFactor,
        showNumbers: config.showNumbers,
        animated: config.animated,
        interactive: config.interactive,
        gestures: config.gestures,
        soundEnabled: config.soundEnabled,
        soundVolume: config.soundVolume,
      };

      updateApiSettings(abacusReactFields);
      lastSyncedConfigRef.current = configJson;
    }
  }, [config, updateApiSettings]);

  return null;
}
