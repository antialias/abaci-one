'use client'

// The packed kit plate, computed for the PREVIEW rather than for a submit
// (Gitea #32).
//
// The layout the studio draws has to be the layout that prints, so this runs the
// real thing: the real module export, the real gate, the real packer, via
// `planKitPlate` — the shared head of `buildKitPlateThreeMf`. It just stops
// before the emit, which is the expensive half and the half a picture doesn't
// need. A cheaper analytic model of the footprints would be a second source of
// truth about where modules land, and the day the two disagreed the preview
// would be lying at exactly the moment it mattered.
//
// Cost control is therefore a caching problem, not a fidelity one:
//   • the query key is the layout's INPUTS, so an unchanged design never
//     re-exports, and `staleTime: Infinity` means it never re-exports on a
//     refocus either;
//   • the inputs are debounced, so dragging a column slider costs one export at
//     the end of the drag rather than one per frame;
//   • `enabled` gates it on the panel actually being open.
//
// A refusal (`KitPlateFitError`) is DATA here, not an error: "this kit needs two
// beds" is the most useful thing the preview can say, and it should say it while
// the user still has the column count in their hand — not after they press
// print. Anything else that throws is a real failure and surfaces as one.

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { bedSizeFromThh } from '@/components/create/abacus/abacus-3mf'
import {
  KitPlateFitError,
  type KitPlateLayout,
  planKitPlate,
} from '@/components/create/abacus/abacus-kit-plate'
import type { FilamentMap, Params } from '@/components/create/abacus/abacus-model'
import type { ModuleExportParts } from '@/components/create/abacus/abacus-module-kit'
import type { ThhBedGeometry, ThhWipeTowerCapability } from '@/lib/abacus/print/filament-wire'
import { abacusPrintKeys } from '@/lib/queryKeys'
import { stableStringify } from '@/lib/stable-stringify'

/** Long enough that a slider drag settles first, short enough that the picture
 *  feels attached to the control that changed it. */
const SETTLE_MS = 400

export interface KitPlateRefusalView {
  readonly headline: string
  readonly remediation: string
  readonly modules: readonly string[]
}

export interface KitPlateLayoutResult {
  /** Where every module and the tower land, or null if there's no plate yet. */
  readonly layout: KitPlateLayout | null
  /** Filaments the plate resolves to — the tower's envelope row. */
  readonly filaments: number | null
  /** We won't ship this plate, and why. Not an error state. */
  readonly refusal: KitPlateRefusalView | null
  /** The export/pack is running. */
  readonly pending: boolean
  /** Something other than a refusal broke — a dead exporter, torn HMR state. */
  readonly error: Error | null
}

export interface UseKitPlateLayoutArgs {
  /** Only compute while the panel is on screen and the design is modular. */
  enabled: boolean
  /** The modular export bundle, one snapshot per call. */
  requestExportModuleParts?: () => Promise<ModuleExportParts>
  params: Params
  filamentMap: FilamentMap
  /** Supports will be on at slice — widens the module gaps and the tower ring,
   *  so it changes the layout and belongs in the key. */
  supportsAtSlice: boolean
  bed?: ThhBedGeometry
  wipeTower?: ThhWipeTowerCapability | null
  /** Filaments the ticket adds that no body carries (the routed support
   *  interface). Sizes the tower reserve, so it changes the layout too. */
  extraFilaments: number
}

/** Hold `value` still until it has stopped changing for `ms`. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return settled
}

export function useKitPlateLayout(args: UseKitPlateLayoutArgs): KitPlateLayoutResult {
  const {
    enabled,
    requestExportModuleParts,
    params,
    filamentMap,
    supportsAtSlice,
    bed,
    wipeTower,
    extraFilaments,
  } = args

  // Everything the arrangement depends on and nothing else. Style keys the
  // slicer clamps, the start policy, the printer's name — none of them move a
  // module, so none of them should cost an export.
  const signature = stableStringify({
    params,
    filamentMap,
    supportsAtSlice,
    bed,
    wipeTower,
    extraFilaments,
  })
  const settled = useSettled(signature, SETTLE_MS)
  // Debouncing the KEY alone would leave the query showing a stale plate as
  // settled truth during the drag. `isFetching` below covers that: the picture
  // dims while the design has moved on from what's drawn.
  const moving = settled !== signature

  const query = useQuery({
    queryKey: abacusPrintKeys.kitPlate(settled),
    enabled: enabled && !!requestExportModuleParts,
    // The inputs ARE the key, so a hit can never be stale — and a plate should
    // not be recomputed because a window regained focus.
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<{
      layout: KitPlateLayout | null
      filaments: number | null
      refusal: KitPlateRefusalView | null
    }> => {
      if (!requestExportModuleParts) throw new Error('no module exporter registered')
      const parts = await requestExportModuleParts()
      try {
        const plan = planKitPlate({
          parts,
          filamentMap,
          supportsAtSlice,
          bed: bedSizeFromThh(bed),
          wipeTower: wipeTower ?? undefined,
          extraFilaments,
        })
        return { layout: plan.layout, filaments: plan.filaments, refusal: null }
      } catch (err) {
        if (err instanceof KitPlateFitError) {
          return {
            layout: null,
            filaments: null,
            refusal: {
              headline: err.headline,
              remediation: err.remediation,
              modules: err.modules,
            },
          }
        }
        throw err
      }
    },
  })

  return {
    layout: query.data?.layout ?? null,
    filaments: query.data?.filaments ?? null,
    refusal: query.data?.refusal ?? null,
    pending: enabled && (query.isFetching || moving),
    error: query.error instanceof Error ? query.error : null,
  }
}
