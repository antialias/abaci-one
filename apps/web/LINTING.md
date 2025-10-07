# Linting & Formatting Setup

This project uses **Biome** for formatting and general linting, with **ESLint** handling React Hooks rules only.

## Tools

- **@biomejs/biome** - Fast formatter + linter + import organizer
- **eslint** + **eslint-plugin-react-hooks** - React Hooks validation only

## Scripts

```bash
# Check formatting and lint (non-destructive)
npm run check

# Lint all files
npm run lint

# Fix lint issues
npm run lint:fix

# Format all files
npm run format

# Check formatting (dry run)
npm run format:check
```

## Configuration Files

- `biome.jsonc` - Biome configuration (format + lint)
- `eslint.config.js` - Minimal ESLint flat config for React Hooks only
- `.gitignore` - Includes patterns for Biome cache

## What Each Tool Does

### Biome
- Code formatting (Prettier-compatible)
- General JavaScript/TypeScript linting
- Import organization (alphabetical, remove unused)
- Dead code detection
- Performance optimizations

### ESLint (React Hooks only)
- `react-hooks/rules-of-hooks` - Ensures hooks are called unconditionally
- `react-hooks/exhaustive-deps` - Warns about incomplete dependency arrays

## IDE Integration

### VS Code
Install the Biome extension:
```
code --install-extension biomejs.biome
```

Add to `.vscode/settings.json`:
```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
```

## CI/CD

Add to your GitHub Actions workflow:

```yaml
- name: Lint
  run: npm run lint

- name: Check formatting
  run: npm run format:check
```

## Migration from ESLint + Prettier

This setup replaces most ESLint and Prettier functionality:
- ✅ Removed `eslint-config-next` inline config from `package.json`
- ✅ No `.eslintrc.js` or `.prettierrc` files needed
- ✅ ESLint now only runs React Hooks rules
- ✅ Biome handles all formatting and general linting

## Why This Setup?

1. **Speed** - Biome is 10-100x faster than ESLint + Prettier
2. **Simplicity** - Single tool for most concerns
3. **Accuracy** - ESLint still catches React-specific issues Biome can't yet handle
4. **Low Maintenance** - Minimal config overlap

## Customization

To add custom lint rules, edit:
- `biome.jsonc` for general rules
- `eslint.config.js` for React Hooks rules
