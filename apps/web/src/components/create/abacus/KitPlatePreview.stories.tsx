// Abacus Studio — KitPlatePreview stories (Gitea #32).
//
// Every state of the bed picture, staged without a printer, a WASM export or a
// mesh. The GEOMETRY IS REAL: `packKitPlate` needs only footprint numbers and a
// bed, not triangles, so each story runs the actual packer over the actual
// module dimensions (mid 15.5 mm, end 26 mm, 100.5 mm deep at scale 1) and draws
// what it answers. Hand-typed placements would drift from the packer the first
// time a heuristic changed and nobody would notice — the picture would simply
// stop being a picture of anything.
//
// The refusals are staged the same way: the packer is asked for something
// impossible and its own KitPlateFitError copy is what renders, so the words in
// Storybook are the words a user gets.

import type { Meta, StoryObj } from '@storybook/react'
import { BAMBU_256_BED } from './abacus-3mf-assembly'
import {
  KitPlateFitError,
  type KitPlateLayout,
  kitPlateInstances,
  type ModuleBasis,
  packKitPlate,
} from './abacus-kit-plate'
import { defaultParams, type FilamentMap, type Params } from './abacus-model'
import type { ModuleKind } from './abacus-module-kit'
import { KitPlatePreview } from './KitPlatePreview'

const params = (over: Partial<Params> = {}): Params => ({
  ...defaultParams,
  seam_mode: 'modular',
  feet_mode: 'adhesive',
  ...over,
})

const fm: FilamentMap = {
  slots: ['#c9a26e', '#f5f5f5', '#111111', '#2e86ab'],
  frame: 0,
  markerWhite: 1,
  markerBlack: 2,
  beadRoles: [3, 1],
  markerContrast: 21,
}

/** Measured module footprints at scale 1 — what `moduleBasis` reports off the
 *  real renders, restated here so a story needs no geometry pipeline. */
const bases: Record<ModuleKind, ModuleBasis> = {
  left: { kind: 'left', minX: 0, minY: 0, wMm: 26, hMm: 100.5 },
  mid: { kind: 'mid', minX: 0, minY: 0, wMm: 15.5, hMm: 100.5 },
  right: { kind: 'right', minX: 0, minY: 0, wMm: 26, hMm: 100.5 },
}

function pack(args: {
  cols?: number
  bed?: typeof BAMBU_256_BED
  supportsAtSlice?: boolean
  filaments?: number
}): { layout: KitPlateLayout | null; refusal: KitPlatePreviewRefusal | null } {
  const p = params({ cols: args.cols ?? 13 })
  try {
    return {
      layout: packKitPlate({
        instances: kitPlateInstances(p, fm),
        bases,
        bed: args.bed ?? BAMBU_256_BED,
        supportsAtSlice: args.supportsAtSlice ?? false,
        filaments: args.filaments ?? 3,
      }),
      refusal: null,
    }
  } catch (err) {
    if (err instanceof KitPlateFitError) {
      return {
        layout: null,
        refusal: { headline: err.headline, remediation: err.remediation, modules: err.modules },
      }
    }
    throw err
  }
}

type KitPlatePreviewRefusal = {
  headline: string
  remediation: string
  modules: readonly string[]
}

const meta: Meta<typeof KitPlatePreview> = {
  title: 'AbacusStudio/KitPlatePreview',
  component: KitPlatePreview,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // the studio's dark print panel; the preview's palette assumes it
      <div
        style={{
          width: 340,
          padding: 12,
          borderRadius: 12,
          background: 'rgba(17,24,39,0.95)',
          color: 'rgba(226,232,240,0.95)',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontSize: 12,
        }}
      >
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof KitPlatePreview>

/** The shipped case: 13 columns, three filaments, one 256 bed. */
export const FullKit: Story = {
  args: { ...pack({ filaments: 3 }), filaments: 3 },
}

/** Supports on (printed feet, or the operator's style) widens every gap AND the
 *  tower's clearance ring — the same kit, visibly looser. */
export const SupportsOn: Story = {
  args: { ...pack({ supportsAtSlice: true, filaments: 3 }), filaments: 3 },
}

/** A fourth spool (the routed support interface) buys the tower a deeper
 *  envelope row, and on a full bed that is the difference between fitting and
 *  not. Compare the reserve against FullKit. */
export const FourFilaments: Story = {
  args: { ...pack({ filaments: 4 }), filaments: 4 },
}

/** Few enough modules that the bed is mostly tower and empty space. */
export const SmallKit: Story = {
  args: { ...pack({ cols: 4, filaments: 3 }), filaments: 3 },
}

/** A printer with no declared keep-out — the hatched corner is a property of the
 *  machine, not of the drawing. */
export const NoKeepOut: Story = {
  args: {
    ...pack({ bed: { wMm: 256, dMm: 256 }, filaments: 3 }),
    filaments: 3,
  },
}

/** The honest refusal, in the packer's own words. */
export const WontFit: Story = {
  args: pack({ cols: 13, bed: { wMm: 180, dMm: 180 }, filaments: 3 }),
}

/** Waiting on the module export. */
export const Packing: Story = {
  args: { layout: null, pending: true },
}
