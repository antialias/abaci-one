// Abacus Studio — FilamentPlanPanel stories (gh#163).
//
// The panel is presentational, so every state the material UX can reach is
// demonstrable here with fabricated AMS snapshots — including the ones that are
// awkward to stage with real spools (weld splits, temperature ties). The
// catalogs below are modeled on the production failure that motivated gh#163:
// four PLA spools plus one PETG whose color matches the heaven bead exactly.

import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import type { FilamentCatalog, FilamentSpool } from './abacus-catalog'
import { catalogFromParams } from './abacus-catalog'
import { toAbacusDesign } from './abacus-design'
import { beadRoleColors, defaultParams, type Params } from './abacus-model'
import { FilamentPlanPanel } from './FilamentPlanPanel'

// ---- fixtures ----------------------------------------------------------------
// Mirrors the engine test fixtures (abacus-plan.test.ts materialFixtures): a
// heaven-earth design whose two bead colors give auto-snap real work to do.

const params: Params = {
  ...defaultParams,
  color_scheme: 'heaven-earth',
  color_palette: 'default',
  filament_count: 8,
}
const design = toAbacusDesign(params, '')
const [heavenHex, earthHex] = beadRoleColors(params.color_scheme, params.color_palette)

const spool = (id: string, name: string, hex: string, material: string): FilamentSpool => ({
  id,
  name,
  hex,
  material,
})
const thh = (spools: FilamentSpool[]): FilamentCatalog => ({
  source: 'thh-ams',
  fetchedAt: '2026-07-21T00:00:00Z',
  spools,
})

// The prod-failure shape: every role has a great PLA home, but the lone PETG
// matches the heaven bead just as well — the old color-only snapper could land
// on it and split the plate across temperatures.
const prodEchoCatalog = thh([
  spool('s-black', 'Bambu Lab PLA Basic Black', '#101010', 'PLA'),
  spool('s-white', 'Bambu Lab PLA Basic Jade White', '#F2F2F2', 'PLA'),
  spool('s-heaven', 'Bambu Lab PLA Matte Mandarin', heavenHex, 'PLA'),
  spool('s-earth', 'Bambu Lab PLA Matte Ice Blue', earthHex, 'PLA'),
  spool('s-petg', 'Bambu Lab PETG HF Translucent', heavenHex, 'PETG'),
])

// prodEcho plus a breakaway support spool sitting at near-white — exactly where
// a color-only snapper would want to put the white ArUco marker.
const supportCatalog = thh([
  ...prodEchoCatalog.spools,
  spool('s-sup', 'Bambu Lab Support for PLA', '#FEFEFE', 'PLA-S'),
])

// A bare black + white plate: no spool comes close to either bead color, so both
// beads snap onto a far-off filament and each earns a corner fleck in the strip,
// while the black frame + markers still print true (the fleck's silent case).
const limitedCatalog = thh([
  spool('s-black', 'Bambu Lab PLA Basic Black', '#101010', 'PLA'),
  spool('s-white', 'Bambu Lab PLA Basic Jade White', '#F2F2F2', 'PLA'),
])

// ---- harness -------------------------------------------------------------------
// The panel is controlled (the studio owns `overrides` so its recolor pipeline
// sees the same pins); stories own that state with a plain useState.

type HarnessProps = {
  catalog: FilamentCatalog
  initialOverrides?: Record<string, string>
  defaultMappingOpen?: boolean
  defaultOpenRole?: string | null
}

function Harness({ catalog, initialOverrides, defaultMappingOpen, defaultOpenRole }: HarnessProps) {
  const [overrides, setOverrides] = useState<Record<string, string>>(initialOverrides ?? {})
  return (
    <FilamentPlanPanel
      design={design}
      catalog={catalog}
      overrides={overrides}
      onOverridesChange={setOverrides}
      defaultMappingOpen={defaultMappingOpen}
      defaultOpenRole={defaultOpenRole}
    />
  )
}

const meta: Meta<typeof FilamentPlanPanel> = {
  title: 'AbacusStudio/FilamentPlanPanel',
  component: FilamentPlanPanel,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // the studio's dark sidebar; the panel's palette assumes this ground
      <div
        style={{
          width: 360,
          minHeight: 460,
          padding: 16,
          borderRadius: 12,
          background: '#111827',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof FilamentPlanPanel>

/**
 * Layer 0, the pit of success: this is the exact catalog shape that failed in
 * production (4× PLA + a PETG that matches the heaven bead perfectly). The
 * anchor-restricted auto-snap keeps every role on the PLA plate — no warnings,
 * nothing pinned, and the PETG is simply not chosen. Open the mapping to see
 * every row on its ✓ best match.
 */
export const PitOfSuccess: Story = {
  render: () => <Harness catalog={prodEchoCatalog} />,
}

/**
 * The reconcile strip, reality-first, both states in one shot. Each swatch's base
 * is the FILAMENT the role prints on; a role only earns a corner fleck of the
 * user's *true* (designed) color when it prints noticeably differently. On this
 * bare black+white plate the bead colors have nowhere true to land, so each prints
 * as black/white with a fleck of its intended color and the caption reads "N
 * colors shift". Compare with PitOfSuccess above, whose exact-match plate leaves
 * the strip fleckless ("prints true"). In the studio, hovering a fleck previews
 * the designed colors on the 3D model; clicking a swatch opens that role's picker.
 */
export const ColorsShiftFleck: Story = {
  render: () => <Harness catalog={limitedCatalog} />,
}

/**
 * Layer 3, a temperature mix answered: the heaven beads are pinned onto the
 * PETG spool, so the plate now splits across PLA and PETG temperatures. The
 * warning names the offender as a chip (intrinsic color → role → spool +
 * material), the chip deep-links into the mapping row, and "↺ Fix — back to
 * auto" drops the pin in one click. Try it — the warning disappears.
 */
export const TempMixPin: Story = {
  render: () => <Harness catalog={prodEchoCatalog} initialOverrides={{ 'bead-0': 's-petg' }} />,
}

/**
 * Support media on a visible part: the white ArUco marker is pinned onto the
 * breakaway support spool (near-white, so a color-only snapper would love it).
 * That's not a temperature problem — Support-for-PLA prints at PLA temps by
 * design — it's a "this part will be chalky and crumble" problem, and the
 * warning says so. Note the amber PLA-S tag on the chip and in the legend.
 */
export const SupportMediaPin: Story = {
  render: () => <Harness catalog={supportCatalog} initialOverrides={{ 'marker-white': 's-sup' }} />,
}

/**
 * A weld split: the frame is pinned onto PETG while the ArUco markers stay PLA.
 * The frame and markers print as one welded piece, so this raises BOTH the
 * mixed-joint warning (delamination at the weld) and the plate-temperature
 * warning — each with its own chips and its own one-click fix.
 */
export const WeldSplitPin: Story = {
  render: () => <Harness catalog={prodEchoCatalog} initialOverrides={{ frame: 's-petg' }} />,
}

/**
 * Layer 2, the grouped picker: a role's picker open on a mixed catalog. The
 * plate's anchor group leads undimmed ("PLA · prints with this plate"); the
 * PETG section follows dimmed ("needs a different plate temperature"), and the
 * breakaway spool sits last under "Support". Dimmed is not disabled — every
 * swatch stays clickable, and an off-anchor pick lights the warning strip
 * instead of being blocked.
 */
export const GroupedPicker: Story = {
  render: () => (
    <Harness catalog={supportCatalog} defaultMappingOpen={true} defaultOpenRole="bead-0" />
  ),
}

/**
 * Layer 1, visibility: every spool here starts with "Bambu Lab", so the mapping
 * rows strip that shared brand prefix and spend their characters on the
 * distinguishing words (full name stays in the tooltip). Material tags ride the
 * rows, and the reconcile strip's caption reports the loaded count ("6 filaments
 * loaded") while its swatches show how the design lands on this plate.
 */
export const BrandPrefixAndMapping: Story = {
  render: () => <Harness catalog={supportCatalog} defaultMappingOpen={true} />,
}

/**
 * The offline fallback for contrast: a params-derived catalog carries colors
 * only (no real material families), so the material UX stays honest by staying
 * out of the way — no tags, no legend clusters, a flat ungrouped picker, and no
 * material warnings. Only the THH AMS snapshot activates the material layers.
 */
export const ColorOnlyCatalog: Story = {
  render: () => (
    <Harness
      catalog={catalogFromParams(params)}
      defaultMappingOpen={true}
      defaultOpenRole="bead-0"
    />
  ),
}
