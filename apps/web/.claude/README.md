# .claude/ Documentation Index

This directory contains Claude Code instructions and project documentation.

## Core Instructions

- **[CLAUDE.md](./CLAUDE.md)** - Main instructions file (loaded every session)

## Procedures (Step-by-Step Workflows)

| Procedure | Trigger | Description |
|-----------|---------|-------------|
| [database-migrations.md](./procedures/database-migrations.md) | Creating/modifying DB schema | Complete Drizzle migration workflow |
| [FLOWCHART_MODIFICATIONS.md](./procedures/FLOWCHART_MODIFICATIONS.md) | Modifying flowcharts | Checkpoint nodes, path enumeration, skipIf |

## Reference (Passive Lookup)

| Doc | Topic |
|-----|-------|
| [panda-css.md](./reference/panda-css.md) | Panda CSS gotchas, dark mode, fixing corrupted styled-system |
| [react-query-mutations.md](./reference/react-query-mutations.md) | React Query mutation patterns, cache invalidation |
| [tensorflow-browser-debugging.md](./reference/tensorflow-browser-debugging.md) | Keras→TensorFlow.js debugging (normalization, quantization) |
| [abacus-react.md](./reference/abacus-react.md) | @soroban/abacus-react usage, SSR patterns |

## Architecture & Design

| Doc | Description |
|-----|-------------|
| [ARCADE_ROOM_ARCHITECTURE.md](./ARCADE_ROOM_ARCHITECTURE.md) | One Room Rule, auto-leave, socket broadcasting |
| [ARCADE_ARCHITECTURE.md](./ARCADE_ARCHITECTURE.md) | Game modes, isolation between modes |
| [ARCADE_ROUTING_ARCHITECTURE.md](./ARCADE_ROUTING_ARCHITECTURE.md) | /arcade page routing |
| [ARCADE_SETUP_PATTERN.md](./ARCADE_SETUP_PATTERN.md) | Standard synchronized setup pattern |
| [PER_PLAYER_STATS_ARCHITECTURE.md](./PER_PLAYER_STATS_ARCHITECTURE.md) | Per-player statistics system |
| [COMPLEXITY_BUDGET_SYSTEM.md](./COMPLEXITY_BUDGET_SYSTEM.md) | Problem difficulty measurement |

## Feature Specifications

| Doc | Feature |
|-----|---------|
| [CARD_SORTING_SPECTATOR_UX.md](./CARD_SORTING_SPECTATOR_UX.md) | Card sorting spectator mode |
| [PLAYING_GUIDE_MODAL_SPEC.md](./PLAYING_GUIDE_MODAL_SPEC.md) | Playing guide modal |
| [TUTORIAL_SYSTEM.md](./TUTORIAL_SYSTEM.md) | Tutorial system |
| [WORKSHEET_CONFIG_PERSISTENCE.md](./WORKSHEET_CONFIG_PERSISTENCE.md) | Worksheet config persistence |
| [WORKSHEET_GRADING_SPEC_V2.md](./WORKSHEET_GRADING_SPEC_V2.md) | Worksheet grading v2 |
| [PROBLEM_GENERATION.md](./PROBLEM_GENERATION.md) | Problem generation system |

## Settings & Configuration

| Doc | Description |
|-----|-------------|
| [GAME_SETTINGS_PERSISTENCE.md](./GAME_SETTINGS_PERSISTENCE.md) | How game settings are stored and synced |
| [GAME_SETTINGS_REFACTORING.md](./GAME_SETTINGS_REFACTORING.md) | Recommended improvements |
| [GAME_THEMES.md](./GAME_THEMES.md) | Standardized color themes |
| [Z_INDEX_MANAGEMENT.md](./Z_INDEX_MANAGEMENT.md) | Z-index hierarchy and constants |
| [UI_STYLE_GUIDE.md](./UI_STYLE_GUIDE.md) | UI styling conventions |

## Operations & Quality

| Doc | Description |
|-----|-------------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment (NAS, compose-updater) |
| [CODE_QUALITY_REGIME.md](./CODE_QUALITY_REGIME.md) | Pre-commit checks, linting |
| [MERGE_CONFLICT_RESOLUTION.md](./MERGE_CONFLICT_RESOLUTION.md) | Git merge conflict strategies |
| [ERROR_HANDLING.md](./ERROR_HANDLING.md) | Arcade error handling system |
| [BLOG_EXAMPLES_PATTERN.md](./BLOG_EXAMPLES_PATTERN.md) | Blog post example generation |
| [ANIMATION_PATTERNS.md](./ANIMATION_PATTERNS.md) | React-spring animation patterns |

## Research & Pedagogy

| Doc | Topic |
|-----|-------|
| [BKT_DESIGN_SPEC.md](./BKT_DESIGN_SPEC.md) | Bayesian Knowledge Tracing spec |
| [PROGRESSION_PEDAGOGY.md](./PROGRESSION_PEDAGOGY.md) | Learning progression design |
| [SIMULATED_STUDENT_MODEL.md](./SIMULATED_STUDENT_MODEL.md) | Simulated student for testing |

## Roadmaps & Planning

| Doc | Scope |
|-----|-------|
| [EDUCATION_ROADMAP.md](./EDUCATION_ROADMAP.md) | Complete education platform roadmap |
| [PLATFORM_INTEGRATION_ROADMAP.md](./PLATFORM_INTEGRATION_ROADMAP.md) | Platform integrations |

## Integration Guides

| Doc | Integration |
|-----|-------------|
| [GOOGLE_CLASSROOM_SETUP.md](./GOOGLE_CLASSROOM_SETUP.md) | Google Classroom API setup |
