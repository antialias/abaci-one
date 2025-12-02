# Know Your World

A geography quiz game where players identify countries, states, and territories on unlabeled maps.

## Documentation

| Document | Description |
|----------|-------------|
| **[Architecture](./docs/ARCHITECTURE.md)** | System overview, data flow, component responsibilities |
| **[Features](./docs/FEATURES.md)** | Complete feature inventory with file references |
| **[Patterns](./docs/PATTERNS.md)** | Code conventions, component limits, testing patterns |
| **[Magnifier Architecture](./docs/MAGNIFIER_ARCHITECTURE.md)** | Deep dive on zoom system |
| **[Precision Controls](./docs/PRECISION_CONTROLS.md)** | Cursor dampening and pointer lock |

### Implementation Details

| Document | Description |
|----------|-------------|
| [Background Music](./docs/implementation/background-music.md) | Music system architecture (Strudel) |
| [Celebration System](./docs/implementation/celebration.md) | Victory animations and types |
| [Give Up Flow](./docs/implementation/give-up.md) | Give up mechanics and re-asking |
| [Map Cropping](./docs/implementation/map-cropping.md) | Viewport fitting algorithm |
| [Strudel Layering](./docs/implementation/strudel-layering.md) | Music layering implementation |

---

## Quick Start

### Game Modes

- **Cooperative**: Work together to find all regions
- **Race**: Compete - first click wins the point
- **Turn-Based**: Take turns finding locations

### Maps

- **World Map**: 256 countries and territories (filterable by continent)
- **USA States**: 51 states (50 + DC)

### Difficulty

Filter by region size: Huge → Large → Medium → Small → Tiny

### Assistance Levels

| Level | Hot/Cold | Hints | Learning Mode |
|-------|----------|-------|---------------|
| Learning | ✓ | ✓ Auto | ✓ Type name |
| Guided | ✓ | ✓ | |
| Helpful | ✓ | On request | |
| Standard | | On request | |
| None | | | |

---

## Key Features

### Precision Controls

Tiny regions (like Gibraltar at 0.08px) are clickable thanks to:
- **Adaptive magnifier**: 8-60x zoom based on region density
- **Cursor dampening**: Slows cursor over tiny regions
- **Pointer lock**: Pixel-precise control mode

### Multiplayer

- Real-time cursor sharing
- Cooperative give-up voting
- Turn order enforcement

### Audio

- Speech synthesis for region names (with optional regional accents)
- Hot/cold audio feedback
- Dynamic background music (regional styles)

---

## Project Structure

```
know-your-world/
├── docs/                    # Documentation (START HERE)
│   ├── ARCHITECTURE.md      # System overview
│   ├── FEATURES.md          # Feature inventory
│   ├── PATTERNS.md          # Code conventions
│   └── implementation/      # Implementation details
│
├── components/              # React components
│   ├── GameComponent.tsx    # Root (phase router)
│   ├── MapRenderer.tsx      # Main game (6285 lines - needs refactoring)
│   └── GameInfoPanel.tsx    # Control panel (2090 lines - needs refactoring)
│
├── hooks/                   # Custom hooks
├── utils/                   # Utility functions
├── music/                   # Music system
│
├── Provider.tsx             # React Context
├── Validator.ts             # Server-side logic
├── types.ts                 # TypeScript interfaces
└── maps.ts                  # Map data
```

---

## Development

### Running Locally

```bash
npm run dev
# Navigate to /arcade/room/{roomId}
```

### Storybook

```bash
npm run storybook
# Navigate to "Arcade Games / Know Your World"
```

### Debug Mode

Add `?debug=1` to any URL to enable debug overlays:
- Bounding boxes
- Zoom info
- Hot/cold enable conditions

---

## Maintenance Notes

### Large Files Needing Refactoring

| File | Lines | Notes |
|------|-------|-------|
| `MapRenderer.tsx` | 6,285 | Extract to feature modules |
| `GameInfoPanel.tsx` | 2,090 | Extract UI sections |

See [PATTERNS.md](./docs/PATTERNS.md) for refactoring guidelines.

### Test Coverage

| Area | Status |
|------|--------|
| Validator | ✓ Good |
| Utils | ✓ Good |
| Components | Partial |
| Hooks | Needs coverage |

---

## Related Documentation

- [Game SDK](../../lib/arcade/README.md) - Arcade game framework
- [Arcade System](../../app/arcade/README.md) - Room/session architecture

## Credits

- Map data: [@svg-maps/world](https://www.npmjs.com/package/@svg-maps/world), [@svg-maps/usa](https://www.npmjs.com/package/@svg-maps/usa)
- Label positioning: [D3 Force](https://d3js.org/d3-force)
- Animations: [React Spring](https://www.react-spring.dev/)
- Music: [Strudel](https://strudel.cc/)
