/**
 * This build's short commit id (`build-info.json` `git.commitShort`, written by
 * `scripts/generate-build-info.js` before every build), inlined wherever it is
 * imported: the server stamps it on what it stores, and a bundle that imports
 * it carries its own (practice-kinds §8 A23.3: a glitch row names both, so a
 * bundle/server skew is visible). `'unknown'` when the build had no git.
 */

import buildInfo from '@/generated/build-info.json'

export const BUILD_ID: string = buildInfo.git.commitShort ?? 'unknown'
