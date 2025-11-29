# Know Your World

A geography quiz game where players identify countries, states, and territories on unlabeled maps.

## Features

### Game Modes

- **Cooperative**: Work together as a team to find all regions
- **Race**: Compete to click regions first
- **Turn-Based**: Take turns finding locations

### Maps

- **World Map**: 256 countries and territories
  - Filter by continent: Africa, Asia, Europe, North America, South America, Oceania, Antarctica
- **USA States**: 51 states (50 states + DC)

### Difficulty Levels

Configurable per map with customizable difficulty tiers:

- **World Map**: Easy (capitals only), Medium, Hard (all countries), Expert (including tiny territories)
- **USA States**: Easy (large states), Hard (all states including small ones)

### Study Mode

Optional study period before gameplay:

- Skip (no study time)
- 30 seconds (quick review)
- 1 minute (study time)
- 2 minutes (deep study)

During study, all regions are labeled so players can memorize locations.

## Precision Controls for Tiny Regions

One of the most innovative features is the **automatic precision control system** that makes it possible to click on extremely small regions like Gibraltar (0.08px) and Jersey (0.82px).

### Features:

- **Adaptive cursor dampening**: Automatically slows cursor movement (3-25% speed) when over tiny regions
- **Auto super-zoom**: Zooms up to 60x after hovering 500ms over sub-pixel regions
- **Quick-escape**: Fast mouse movement instantly cancels precision features
- **Crosshair accuracy**: Magnifier crosshairs accurately show which region will be selected

**📖 See [PRECISION_CONTROLS.md](./PRECISION_CONTROLS.md) for complete documentation**

## Visual Features

### Excluded Region Visualization

Regions filtered out by difficulty settings are pre-labeled on the map in gray, showing which regions are not included in the current game.

### Enhanced Contrast

- Unfound regions: 70% opacity (increased from 30% for better visibility)
- Found regions: 100% opacity with player avatar pattern
- Excluded regions: Gray fill with label

### Adaptive Zoom Magnifier

Shows a magnified view (8-60x) when hovering over crowded or tiny regions:

- Automatically calculates optimal zoom based on region density and size
- Smooth spring animations for position and opacity
- Crosshairs show exact cursor position
- Dashed box on main map shows magnified area

### Smart Label Positioning

Uses D3 force simulation to position region labels without overlaps:

- Regular regions: Labels at center
- Small regions: Labels with arrow pointers
- Washington DC: Special positioning to avoid blocking other states
- Collision detection prevents label overlaps

## Technical Architecture

### Component Structure

```
know-your-world/
├── components/
│   ├── GameComponent.tsx         # Main game container
│   ├── SetupPhase.tsx            # Game configuration screen
│   ├── StudyPhase.tsx            # Optional study mode
│   ├── PlayingPhase.tsx          # Active gameplay
│   ├── ResultsPhase.tsx          # Game completion screen
│   ├── MapRenderer.tsx           # SVG map rendering + precision controls
│   ├── ContinentSelector.tsx    # Interactive world map continent filter
│   └── MapRenderer.stories.tsx  # Storybook stories
├── Provider.tsx                   # React Context provider
├── Validator.ts                   # Server-side game logic
├── index.ts                       # Game definition export
├── types.ts                       # TypeScript interfaces
├── maps.ts                        # Map data (World, USA)
├── continents.ts                  # Continent definitions
├── mapColors.ts                   # Color utilities
└── README.md                      # This file
```

### State Management

Uses React Context (`KnowYourWorldProvider`) for client-side state:

- Game phase (setup, study, playing, results)
- Selected map and continent
- Game mode and difficulty
- Current prompt and regions found
- Guess history and player metadata

### Server Validation

All game moves are validated server-side in `Validator.ts`:

- Verifies region IDs are valid
- Checks if region was already found
- Tracks which player found each region
- Handles turn order (turn-based mode)
- Generates random prompts

### Map Data

Maps are sourced from `@svg-maps/world` and `@svg-maps/usa` with enhancements:

- Pre-calculated bounding boxes for each region
- Center coordinates for labels
- Continent metadata (world map only)
- Difficulty tier assignments

## Configuration

Game configuration is persisted in arcade room settings:

```typescript
interface KnowYourWorldConfig {
  selectedMap: "world" | "usa";
  gameMode: "cooperative" | "race" | "turn-based";
  difficulty: string; // Difficulty level ID (varies per map)
  studyDuration: 0 | 30 | 60 | 120; // seconds
  selectedContinent: "all" | ContinentId; // world map only
}
```

## Development

### Adding New Maps

1. Install or create SVG map data package
2. Add map data to `maps.ts`:
   ```typescript
   export const MAP_DATA = {
     'new-map': {
       name: 'New Map',
       regions: [...],
       viewBox: '0 0 1000 1000',
       // ...
     }
   }
   ```
3. Add difficulty configuration
4. Update type definitions

### Customizing Difficulty

Edit `maps.ts` to add custom difficulty tiers:

```typescript
difficultyConfig: {
  levels: [
    { id: 'easy', label: 'Easy', emoji: '😊', description: 'Large regions only' },
    { id: 'hard', label: 'Hard', emoji: '🤔', description: 'All regions' },
  ],
  tiers: {
    easy: { minWidth: 15, minHeight: 15, minArea: 200 },
    hard: { minWidth: 0, minHeight: 0, minArea: 0 },
  }
}
```

### Testing

Use Storybook to test map rendering:

```bash
npm run storybook
```

Navigate to "Arcade Games / Know Your World / Map Renderer"

## Troubleshooting

### Tiny regions not clickable

- Check browser zoom level (100% recommended)
- Ensure precision controls are working (look for crosshair cursor)
- Check console for debug logs

### Labels overlapping

- Adjust force simulation parameters in `MapRenderer.tsx`:
  - `centeringStrength`: How strongly labels pull toward region centers
  - `collisionPadding`: Minimum space between labels
  - `simulationIterations`: More iterations = better layout

### Performance issues

- Reduce map size (filter by continent)
- Lower difficulty (fewer regions)
- Disable label arrows in force tuning parameters

## Related Documentation

- [Precision Controls](./PRECISION_CONTROLS.md) - Cursor dampening and super zoom
- [Game SDK](../../lib/arcade/README.md) - How arcade games are structured
- [Arcade System](../../app/arcade/README.md) - Overall arcade architecture

## Credits

- Map data: [@svg-maps/world](https://www.npmjs.com/package/@svg-maps/world), [@svg-maps/usa](https://www.npmjs.com/package/@svg-maps/usa)
- Label positioning: [D3 Force](https://d3js.org/d3-force)
- Animations: [React Spring](https://www.react-spring.dev/)
