"""Soroban Templates - Python Interface

Provides clean access to Typst templates for soroban abacus flashcard generation
in Python environments. All templates are shared between Node.js and Python
interfaces for consistency.

This module provides absolute paths to template files that can be used directly
with typst CLI, Python typst bindings, or any other Typst-compatible tools.

Author: Soroban Flashcards Team
Version: 0.1.0

Example:
    Basic usage with the Python typst library:

    >>> from soroban_templates import FLASHCARDS_TEMPLATE
    >>> import typst
    >>> content = typst.compile_file(FLASHCARDS_TEMPLATE, {"number": 1234})

    Direct file access:

    >>> with open(FLASHCARDS_TEMPLATE, 'r') as f:
    ...     template_content = f.read()
"""

from pathlib import Path
from typing import Final

# Get the directory containing this file (packages/templates/)
_TEMPLATES_DIR: Final[Path] = Path(__file__).parent.absolute()

# Template path constants
FLASHCARDS_TEMPLATE: Final[str] = str(_TEMPLATES_DIR / "flashcards.typ")
"""Absolute path to the main flashcards Typst template.

This template provides the complete `draw-soroban()` function with full
feature support including:
- Multiple bead shapes (diamond, circle, square)
- Color schemes (monochrome, place-value, heaven-earth, alternating)
- Interactive bead annotations for web integration
- Customizable dimensions and styling options

The template is designed to work with both CLI compilation and programmatic
usage through Python typst bindings.

Type: str (absolute file path)

Example:
    >>> from soroban_templates import FLASHCARDS_TEMPLATE
    >>> with open(FLASHCARDS_TEMPLATE, 'r') as f:
    ...     template_content = f.read()
    >>> assert 'draw-soroban' in template_content
"""

SINGLE_CARD_TEMPLATE: Final[str] = str(_TEMPLATES_DIR / "single-card.typ")
"""Absolute path to the single-card Typst template.

This template is optimized for generating individual flashcards and provides
the `generate-single-card()` function with:
- Front/back side generation (soroban vs numeral)
- PNG export optimization with transparent backgrounds
- Custom dimensions and font configuration
- Reduced file size compared to full flashcards template

Ideal for batch generation of individual cards or when memory usage is a concern.

Type: str (absolute file path)

Example:
    >>> from soroban_templates import SINGLE_CARD_TEMPLATE
    >>> import subprocess
    >>> cmd = ['typst', 'compile', '--input', 'number=123',
    ...        SINGLE_CARD_TEMPLATE, 'output.png']
    >>> subprocess.run(cmd, check=True)
"""

def get_template_path(filename: str) -> str:
    """Get the absolute path to a template file.

    Provides a dynamic way to access template files by name, useful for
    programmatic template selection or when adding new templates.

    Args:
        filename: Name of the template file (e.g., 'flashcards.typ')

    Returns:
        Absolute path to the requested template file

    Raises:
        FileNotFoundError: If the requested template file doesn't exist

    Example:
        >>> from soroban_templates import get_template_path
        >>> path = get_template_path('flashcards.typ')
        >>> assert path.endswith('flashcards.typ')
        >>> assert Path(path).exists()
    """
    template_path = _TEMPLATES_DIR / filename
    if not template_path.exists():
        raise FileNotFoundError(f"Template file '{filename}' not found in {_TEMPLATES_DIR}")
    return str(template_path)

def verify_templates() -> bool:
    """Verify that all expected template files exist and are readable.

    Performs a basic sanity check on the template files to ensure they
    exist and contain expected content. Useful for debugging installation
    or deployment issues.

    Returns:
        True if all templates are verified successfully

    Raises:
        FileNotFoundError: If any template file is missing
        ValueError: If template content appears invalid

    Example:
        >>> from soroban_templates import verify_templates
        >>> assert verify_templates() == True
    """
    templates = [
        (FLASHCARDS_TEMPLATE, 'draw-soroban'),
        (SINGLE_CARD_TEMPLATE, 'generate-single-card')
    ]

    for template_path, expected_function in templates:
        if not Path(template_path).exists():
            raise FileNotFoundError(f"Template not found: {template_path}")

        with open(template_path, 'r', encoding='utf-8') as f:
            content = f.read()

        if expected_function not in content:
            raise ValueError(f"Template {template_path} missing expected function: {expected_function}")

    return True

# Public API
__all__ = [
    "FLASHCARDS_TEMPLATE",
    "SINGLE_CARD_TEMPLATE",
    "get_template_path",
    "verify_templates"
]

# Package metadata
__version__ = "0.1.0"
__author__ = "Soroban Flashcards Team"