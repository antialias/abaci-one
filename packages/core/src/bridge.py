#!/usr/bin/env python3
"""
Python bridge for Node.js integration
Provides a clean function interface instead of CLI
"""

import json
import sys
import base64
import tempfile
import os
import glob
from pathlib import Path
import subprocess

# Import our existing functions
from generate import parse_range, generate_typst_file, generate_single_card_typst

def generate_flashcards_json(config_json):
    """
    Generate flashcards from JSON config
    Returns base64 encoded PDF
    """
    config = json.loads(config_json)
    
    # Parse numbers
    numbers = parse_range(
        config.get('range', '0-9'),
        config.get('step', 1)
    )
    
    # Handle shuffle
    if config.get('shuffle', False):
        import random
        if 'seed' in config:
            random.seed(config['seed'])
        random.shuffle(numbers)
    
    # Build Typst config
    typst_config = {
        'cards_per_page': config.get('cardsPerPage', 6),
        'paper_size': config.get('paperSize', 'us-letter'),
        'orientation': config.get('orientation', 'portrait'),
        'margins': config.get('margins', {
            'top': '0.5in',
            'bottom': '0.5in',
            'left': '0.5in',
            'right': '0.5in'
        }),
        'gutter': config.get('gutter', '5mm'),
        'show_cut_marks': config.get('showCutMarks', False),
        'show_registration': config.get('showRegistration', False),
        'font_family': config.get('fontFamily', 'DejaVu Sans'),
        'font_size': config.get('fontSize', '48pt'),
        'columns': config.get('columns', 'auto'),
        'show_empty_columns': config.get('showEmptyColumns', False),
        'hide_inactive_beads': config.get('hideInactiveBeads', False),
        'bead_shape': config.get('beadShape', 'diamond'),
        'color_scheme': config.get('colorScheme', 'monochrome'),
        'colored_numerals': config.get('coloredNumerals', False),
        'scale_factor': config.get('scaleFactor', 0.9),
    }
    
    # Generate in core package directory to match main generator behavior
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        # Generate Typst file - same setup as main generate.py
        core_package_root = Path(__file__).parent.parent  # packages/core directory

        # Create temp files in core package root, not temp directory
        temp_typst = core_package_root / f'temp_flashcards_{os.getpid()}.typ'
        temp_pdf = core_package_root / f'temp_flashcards_{os.getpid()}.pdf'
        
        # Convert Python list to Typst array syntax (same as main generate.py)
        if numbers:
            numbers_str = '(' + ', '.join(str(n) for n in numbers) + ',)'
        else:
            numbers_str = '()'

        # Create temp Typst with relative imports (works when run from core package root)
        typst_content = f'''
#import "templates/flashcards.typ": generate-flashcards

#generate-flashcards(
  {numbers_str},
  cards-per-page: {typst_config['cards_per_page']},
  paper-size: "{typst_config['paper_size']}",
  orientation: "{typst_config['orientation']}",
  margins: (
    top: {typst_config['margins'].get('top', '0.5in')},
    bottom: {typst_config['margins'].get('bottom', '0.5in')},
    left: {typst_config['margins'].get('left', '0.5in')},
    right: {typst_config['margins'].get('right', '0.5in')}
  ),
  gutter: {typst_config['gutter']},
  show-cut-marks: {str(typst_config['show_cut_marks']).lower()},
  show-registration: {str(typst_config['show_registration']).lower()},
  font-family: "{typst_config['font_family']}",
  font-size: {typst_config['font_size']},
  columns: {typst_config['columns']},
  show-empty-columns: {str(typst_config['show_empty_columns']).lower()},
  hide-inactive-beads: {str(typst_config['hide_inactive_beads']).lower()},
  bead-shape: "{typst_config['bead_shape']}",
  color-scheme: "{typst_config['color_scheme']}",
  colored-numerals: {str(typst_config['colored_numerals']).lower()},
  scale-factor: {typst_config['scale_factor']}
)
'''
        
        with open(temp_typst, 'w') as f:
            f.write(typst_content)
        
        # Get format preference
        output_format = config.get('format', 'pdf').lower()
        temp_svg = None

        try:
            if output_format == 'svg':
                # Generate SVG using Typst with page template for multi-page support
                temp_svg = core_package_root / f'temp_flashcards_{os.getpid()}_{{p}}.svg'
                result = subprocess.run(
                    ['typst', 'compile', str(temp_typst), str(temp_svg), '--format', 'svg'],
                    capture_output=True,
                    text=True,
                    cwd=str(core_package_root)
                )

                if result.returncode != 0:
                    return json.dumps({
                        'error': f'Typst SVG compilation failed: {result.stderr}'
                    })

                # Read SVG content - find the first generated page
                svg_pattern = core_package_root / f'temp_flashcards_{os.getpid()}_*.svg'
                import glob
                svg_files = glob.glob(str(svg_pattern))

                if not svg_files:
                    return json.dumps({
                        'error': 'No SVG files were generated'
                    })

                # Read the first SVG file (page 1)
                svg_file = Path(svg_files[0])
                with open(svg_file, 'r', encoding='utf-8') as f:
                    svg_content = f.read()

                # Clean up all generated SVG files
                for svg_path in svg_files:
                    Path(svg_path).unlink()

                result_data = {
                    'pdf': svg_content,  # Keep field name for compatibility
                    'count': len(numbers),
                    'numbers': numbers[:100]
                }
            else:
                # Generate PDF (default)
                result = subprocess.run(
                    ['typst', 'compile', str(temp_typst), str(temp_pdf)],
                    capture_output=True,
                    text=True,
                    cwd=str(core_package_root)
                )

                if result.returncode != 0:
                    return json.dumps({
                        'error': f'Typst compilation failed: {result.stderr}'
                    })

                # Read and encode PDF
                with open(temp_pdf, 'rb') as f:
                    pdf_bytes = f.read()

                result_data = {
                    'pdf': base64.b64encode(pdf_bytes).decode('utf-8'),
                    'count': len(numbers),
                    'numbers': numbers[:100]  # Limit preview
                }
        finally:
            # Clean up temp files
            for temp_file in [temp_typst, temp_pdf, temp_svg if output_format == 'svg' else None]:
                if temp_file and temp_file.exists():
                    temp_file.unlink()

        return json.dumps(result_data)

def generate_single_card_json(config_json):
    """
    Generate a single card SVG from JSON config
    Specifically for preview - always returns front side (abacus)
    """
    config = json.loads(config_json)

    # Extract the single number
    number = config.get('number')
    if number is None:
        return json.dumps({'error': 'Missing number parameter'})

    # Build Typst config
    typst_config = {
        'bead_shape': config.get('beadShape', 'diamond'),
        'color_scheme': config.get('colorScheme', 'monochrome'),
        'color_palette': config.get('colorPalette', 'default'),
        'colored_numerals': config.get('coloredNumerals', False),
        'hide_inactive_beads': config.get('hideInactiveBeads', False),
        'show_empty_columns': config.get('showEmptyColumns', False),
        'columns': config.get('columns', 'auto'),
        'transparent': config.get('transparent', False),
        'card_width': config.get('cardWidth', '3.5in'),
        'card_height': config.get('cardHeight', '2.5in'),
        'font_size': config.get('fontSize', '48pt'),
        'font_family': config.get('fontFamily', 'DejaVu Sans'),
        'scale_factor': config.get('scaleFactor', 1.0),
    }

    # Generate in core package directory
    core_package_root = Path(__file__).parent.parent
    temp_typst = core_package_root / f'temp_single_{number}_{os.getpid()}.typ'
    temp_svg = core_package_root / f'temp_single_{number}_{os.getpid()}.svg'

    try:
        # Create single card content directly with correct template path
        typst_content = f'''
#import "templates/single-card.typ": generate-single-card

#generate-single-card(
  {number},
  side: "front",
  bead-shape: "{typst_config['bead_shape']}",
  color-scheme: "{typst_config['color_scheme']}",
  color-palette: "{typst_config['color_palette']}",
  colored-numerals: {str(typst_config['colored_numerals']).lower()},
  hide-inactive-beads: {str(typst_config['hide_inactive_beads']).lower()},
  show-empty-columns: {str(typst_config['show_empty_columns']).lower()},
  columns: {typst_config['columns']},
  transparent: {str(typst_config['transparent']).lower()},
  width: {typst_config['card_width']},
  height: {typst_config['card_height']},
  font-size: {typst_config['font_size']},
  font-family: "{typst_config['font_family']}",
  scale-factor: {typst_config['scale_factor']}
)
'''

        with open(temp_typst, 'w') as f:
            f.write(typst_content)

        # Generate SVG
        result = subprocess.run(
            ['typst', 'compile', str(temp_typst), str(temp_svg), '--format', 'svg'],
            capture_output=True,
            text=True,
            cwd=str(core_package_root)
        )

        if result.returncode != 0:
            return json.dumps({
                'error': f'Typst SVG compilation failed: {result.stderr}'
            })

        # Read SVG content
        if not temp_svg.exists():
            return json.dumps({
                'error': 'SVG file was not generated'
            })

        with open(temp_svg, 'r', encoding='utf-8') as f:
            svg_content = f.read()

        return json.dumps({
            'pdf': svg_content,  # Keep field name for compatibility
            'count': 1,
            'numbers': [number]
        })

    except Exception as e:
        return json.dumps({'error': f'Single card generation failed: {str(e)}'})
    finally:
        # Clean up temp files
        for temp_file in [temp_typst, temp_svg]:
            if temp_file and temp_file.exists():
                temp_file.unlink()

if __name__ == '__main__':
    # Read JSON from stdin, write JSON to stdout
    # This allows clean function-like communication
    for line in sys.stdin:
        try:
            config = json.loads(line.strip())

            # Check if this is a single-card generation request
            if config.get('mode') == 'single-card':
                result = generate_single_card_json(line.strip())
            else:
                result = generate_flashcards_json(line.strip())

            print(result)
            sys.stdout.flush()
        except Exception as e:
            print(json.dumps({'error': str(e)}))
            sys.stdout.flush()