# Testing

This directory contains automated tests for the Soroban flashcard generator.

## Test Structure

- `test_config.py` - Configuration loading and parsing tests
- `test_generation.py` - Core generation logic tests
- `test_visual.py` - Visual regression tests using image comparison
- `conftest.py` - Pytest fixtures and configuration
- `references/` - Reference images for visual regression tests

## Running Tests

### Quick Start

```bash
make pytest-fast    # Run unit tests (fast)
make pytest-visual  # Run visual regression tests
make pytest         # Run all tests
make pytest-cov     # Run with coverage report
```

### Direct pytest usage

```bash
# All tests
python3 -m pytest tests/ -v

# Skip slow tests
python3 -m pytest tests/ -v -m "not slow"

# Visual tests only
python3 -m pytest tests/test_visual.py -v

# With coverage
python3 -m pytest tests/ -v --cov=src
```

## Visual Testing

The visual tests generate flashcard images and compare them against reference images using perceptual hashing. This catches visual regressions while allowing for minor differences.

### Updating References

When you make intentional visual changes, manually delete the old reference images in `tests/references/` and run the visual tests. They will automatically create new reference images on first run.

### How Visual Tests Work

1. Generate test images (PNG format, small size for speed)
2. Compare against reference images using `imagehash` library
3. Allow small differences (hash distance < 5) for anti-aliasing variations
4. Fail if images differ significantly, indicating a regression

### Test Philosophy

- **Fast unit tests** for logic and configuration
- **Visual regression tests** for output verification
- **Integration tests** marked as `@pytest.mark.slow`
- **Meaningful failures** with clear error messages
- **Easy maintenance** when the app evolves

## Adding Tests

When adding features:

1. Add unit tests in relevant `test_*.py` file
2. Add visual tests if output changes
3. Update references if visual changes are intentional
4. Use appropriate markers (`@pytest.mark.slow`, etc.)

## CI Integration

Tests are designed to run in CI environments:

- Skip tests requiring typst if not installed
- Use smaller images and lower DPI for speed
- Store reference images in version control
- Clear pass/fail criteria
