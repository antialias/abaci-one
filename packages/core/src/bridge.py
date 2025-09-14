#!/usr/bin/env python3
"""
Python bridge for Node.js integration
Provides a clean function interface instead of CLI
"""

import json
import sys
import base64
import tempfile
from pathlib import Path
import subprocess

# Import our existing functions
from generate import parse_range, generate_typst_file

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
    
    # Generate PDF in temp directory
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        temp_typst = tmpdir_path / 'flashcards.typ'
        temp_pdf = tmpdir_path / 'flashcards.pdf'
        
        # Generate Typst file
        project_root = Path(__file__).parent.parent
        
        # Create temp Typst with correct imports
        typst_content = f'''
#import "{project_root}/templates/flashcards.typ": generate-flashcards

#generate-flashcards(
  {numbers},
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
        
        # Compile with Typst
        result = subprocess.run(
            ['typst', 'compile', str(temp_typst), str(temp_pdf)],
            capture_output=True,
            text=True,
            cwd=str(project_root)
        )
        
        if result.returncode != 0:
            return json.dumps({
                'error': f'Typst compilation failed: {result.stderr}'
            })
        
        # Read and encode PDF
        with open(temp_pdf, 'rb') as f:
            pdf_bytes = f.read()
        
        return json.dumps({
            'pdf': base64.b64encode(pdf_bytes).decode('utf-8'),
            'count': len(numbers),
            'numbers': numbers[:100]  # Limit preview
        })

if __name__ == '__main__':
    # Read JSON from stdin, write JSON to stdout
    # This allows clean function-like communication
    for line in sys.stdin:
        try:
            result = generate_flashcards_json(line.strip())
            print(result)
            sys.stdout.flush()
        except Exception as e:
            print(json.dumps({'error': str(e)}))
            sys.stdout.flush()