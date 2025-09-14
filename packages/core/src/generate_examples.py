#!/usr/bin/env python3
"""
Generate example PNG images for the README
Converts PDFs to PNGs using ImageMagick or Ghostscript
"""

import subprocess
import os
from pathlib import Path
import tempfile

def generate_examples():
    """Generate various example images (SVG for single cards, PNG for grids)"""
    examples = [
        # Single card examples - use SVG
        {
            'name': 'basic-7',
            'format': 'svg',
            'args': ['--range', '7-7', '--format', 'svg', '--no-separate'],
            'desc': 'Number 7 on soroban'
        },
        {
            'name': 'basic-123',
            'format': 'svg', 
            'args': ['--range', '123-123', '--format', 'svg', '--no-separate'],
            'desc': 'Number 123 on soroban'
        },
        
        # Color schemes - use SVG
        {
            'name': 'place-value-456',
            'format': 'svg',
            'args': ['--range', '456-456', '--format', 'svg', '--color-scheme', 'place-value', '--colored-numerals', '--no-separate'],
            'desc': 'Place-value coloring'
        },
        {
            'name': 'heaven-earth-78',
            'format': 'svg',
            'args': ['--range', '78-78', '--format', 'svg', '--color-scheme', 'heaven-earth', '--colored-numerals', '--no-separate'],
            'desc': 'Heaven-earth coloring'
        },
        
        # Bead shapes - use SVG
        {
            'name': 'diamond-25',
            'format': 'svg',
            'args': ['--range', '25-25', '--format', 'svg', '--bead-shape', 'diamond', '--no-separate'],
            'desc': 'Diamond beads (realistic)'
        },
        {
            'name': 'circle-25',
            'format': 'svg',
            'args': ['--range', '25-25', '--format', 'svg', '--bead-shape', 'circle', '--no-separate'],
            'desc': 'Circle beads'
        },
        {
            'name': 'square-25',
            'format': 'svg',
            'args': ['--range', '25-25', '--format', 'svg', '--bead-shape', 'square', '--no-separate'],
            'desc': 'Square beads'
        },
        
        # Hide inactive - use SVG
        {
            'name': 'minimal-42',
            'format': 'svg',
            'args': ['--range', '42-42', '--format', 'svg', '--hide-inactive-beads', '--no-separate'],
            'desc': 'Hidden inactive beads'
        },
        
        # Grid layouts - use PDF→PNG
        {
            'name': 'grid-6',
            'format': 'pdf',
            'args': ['--range', '0-5', '--cards-per-page', '6'],
            'desc': '6 cards per page'
        },
        {
            'name': 'grid-12',
            'format': 'pdf',
            'args': ['--range', '0-11', '--cards-per-page', '12'],
            'desc': '12 cards per page'
        },
        
        # Skip counting - use PDF→PNG
        {
            'name': 'skip-5s',
            'format': 'pdf',
            'args': ['--range', '0-30', '--step', '5', '--cards-per-page', '6'],
            'desc': 'Counting by 5s'
        },
        
        # Cutting guides - use PDF→PNG
        {
            'name': 'cutting-guides',
            'format': 'pdf',
            'args': ['--range', '10-15', '--cards-per-page', '6', '--cut-marks'],
            'desc': 'With cutting guides'
        },
        
        # Additional cutting example
        {
            'name': 'cutting-registration',
            'format': 'pdf', 
            'args': ['--range', '10-15', '--cards-per-page', '6', '--cut-marks', '--registration'],
            'desc': 'With cutting guides and registration marks'
        },
    ]
    
    return examples

def pdf_to_png(pdf_path, png_path, dpi=150, page=1):
    """Convert PDF to PNG using various methods"""
    
    # Method 1: Try pdftoppm (usually available on Unix systems)
    try:
        result = subprocess.run([
            'pdftoppm',
            '-png',
            '-f', str(page),
            '-l', str(page),
            '-r', str(dpi),
            '-singlefile',
            pdf_path,
            png_path.replace('.png', '')
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            # pdftoppm adds -1.png suffix, rename it
            temp_file = png_path.replace('.png', '-1.png')
            if os.path.exists(temp_file):
                os.rename(temp_file, png_path)
            return True
    except FileNotFoundError:
        pass
    
    # Method 2: Try ImageMagick convert
    try:
        result = subprocess.run([
            'convert',
            '-density', str(dpi),
            f'{pdf_path}[{page-1}]',  # ImageMagick uses 0-based indexing
            '-trim',
            '-bordercolor', 'white',
            '-border', '20x20',
            png_path
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            return True
    except FileNotFoundError:
        pass
    
    # Method 3: Try Ghostscript directly
    try:
        result = subprocess.run([
            'gs',
            '-dNOPAUSE',
            '-dBATCH',
            '-sDEVICE=png16m',
            f'-r{dpi}',
            f'-dFirstPage={page}',
            f'-dLastPage={page}',
            f'-sOutputFile={png_path}',
            pdf_path
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            return True
    except FileNotFoundError:
        pass
    
    # Method 4: Try sips (macOS)
    try:
        # First convert PDF to temporary format
        with tempfile.NamedTemporaryFile(suffix='.png') as tmp:
            result = subprocess.run([
                'sips',
                '-s', 'format', 'png',
                '--out', tmp.name,
                pdf_path
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                # Copy to final location
                subprocess.run(['cp', tmp.name, png_path])
                return True
    except FileNotFoundError:
        pass
    
    return False


def copy_svg_files(svg_dir, output_dir, example_name):
    """Copy SVG files from the generated directory to examples"""
    svg_dir = Path(svg_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    copied_files = []
    
    # Look for front and back SVG files
    front_file = svg_dir / f'card_000_front.svg'
    back_file = svg_dir / f'card_000_back.svg'
    
    if front_file.exists():
        dest = output_dir / f'{example_name}_front.svg'
        import shutil
        shutil.copy2(front_file, dest)
        copied_files.append(dest)
        print(f"    ✓ Generated {dest.name}")
    
    if back_file.exists():
        dest = output_dir / f'{example_name}_back.svg'
        import shutil
        shutil.copy2(back_file, dest)
        copied_files.append(dest)
        print(f"    ✓ Generated {dest.name}")
    
    return copied_files


def main():
    """Generate example images for README"""
    
    # Create output directories
    project_root = Path(__file__).parent.parent
    images_dir = project_root / 'docs' / 'images'
    images_dir.mkdir(parents=True, exist_ok=True)
    
    temp_dir = project_root / 'out' / 'examples'
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    # Create SVG output directory
    svg_dir = images_dir / 'svg'
    svg_dir.mkdir(parents=True, exist_ok=True)
    
    examples = generate_examples()
    
    # Check if we have a PDF to PNG converter available
    converters = []
    for cmd in ['pdftoppm', 'convert', 'gs']:
        if subprocess.run(['which', cmd], capture_output=True).returncode == 0:
            converters.append(cmd)
    
    if not converters:
        print("ERROR: No PDF to PNG converter found. Please install one of:")
        print("  - poppler-utils (for pdftoppm)")
        print("  - imagemagick (for convert)")
        print("  - ghostscript (for gs)")
        print("\nOn Ubuntu/Debian: sudo apt-get install poppler-utils")
        print("On macOS: brew install poppler")
        return 1
    
    print(f"Using PDF converters: {', '.join(converters)}")
    print("Generating example images...")
    
    failed = []
    for example in examples:
        print(f"  - {example['name']}: {example['desc']}")
        
        if example['format'] == 'svg':
            # Generate SVG directly
            svg_temp_dir = temp_dir / f"{example['name']}_svg"
            cmd = [
                'python3',
                str(project_root / 'src' / 'generate.py'),
                '--output', str(svg_temp_dir)
            ] + example['args']
            
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(project_root))
            
            if result.returncode != 0:
                print(f"    ERROR generating SVG: {result.stderr}")
                failed.append(example['name'])
                continue
                
            # Copy SVG files to final destination
            copied = copy_svg_files(svg_temp_dir, svg_dir, example['name'])
            if not copied:
                print(f"    ✗ No SVG files found")
                failed.append(example['name'])
                
        else:
            # Generate PDF and convert to PNG
            pdf_path = temp_dir / f"{example['name']}.pdf"
            cmd = [
                'python3',
                str(project_root / 'src' / 'generate.py'),
                '--output', str(pdf_path)
            ] + example['args']
            
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(project_root))
            
            if result.returncode != 0:
                print(f"    ERROR generating PDF: {result.stderr}")
                continue
            
            # Convert front page to PNG
            front_png = images_dir / f"{example['name']}-front.png"
            if pdf_to_png(str(pdf_path), str(front_png), dpi=150, page=1):
                print(f"    ✓ Generated {front_png.name}")
            else:
                print(f"    ✗ Failed to convert {front_png.name}")
                failed.append(example['name'])
            
            # For single cards, also generate back page
            if '--cards-per-page' in example['args'] and example['args'][example['args'].index('--cards-per-page') + 1] == '1':
                back_png = images_dir / f"{example['name']}-back.png"
                if pdf_to_png(str(pdf_path), str(back_png), dpi=150, page=2):
                    print(f"    ✓ Generated {back_png.name}")
    
    if failed:
        print(f"\n✗ Failed to generate {len(failed)} images: {', '.join(failed)}")
        return 1
    else:
        print(f"\n✓ Successfully generated all {len(examples)} examples in docs/images/")
        return 0

if __name__ == '__main__':
    import sys
    sys.exit(main())