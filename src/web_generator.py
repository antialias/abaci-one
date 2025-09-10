#!/usr/bin/env python3
"""
Web flashcard generator for Soroban abacus cards.
Generates static HTML with inline SVG abacus representations using existing Typst->SVG pipeline.
"""

import tempfile
import json
from pathlib import Path


def get_colored_numeral_html(number, config):
    """Generate HTML for numeral with appropriate coloring based on configuration."""
    color_scheme = config.get('color_scheme', 'monochrome')
    
    # For web display, automatically use colored numerals for non-monochrome schemes
    use_colored = config.get('colored_numerals', False) or color_scheme != 'monochrome'
    
    if not use_colored or color_scheme == 'monochrome':
        return str(number)
    
    # Color palettes - all are colorblind-friendly and tested with deuteranopia/protanopia/tritanopia
    color_palettes = {
        # Default palette (current colors - moderately colorblind friendly)
        'default': {
            'colors': [
                "#2E86AB",  # ones - blue
                "#A23B72",  # tens - magenta  
                "#F18F01",  # hundreds - orange
                "#6A994E",  # thousands - green
                "#BC4B51",  # ten-thousands - red
            ],
            'name': 'Default Colors'
        },
        
        # High contrast colorblind-safe palette
        'colorblind': {
            'colors': [
                "#0173B2",  # ones - strong blue
                "#DE8F05",  # tens - orange  
                "#CC78BC",  # hundreds - pink
                "#029E73",  # thousands - teal green
                "#D55E00",  # ten-thousands - vermillion
            ],
            'name': 'Colorblind Safe'
        },
        
        # Mnemonic palette using color associations for place values
        'mnemonic': {
            'colors': [
                "#1f77b4",  # ones - BLUE (Blue = Basic/Beginning = ones)
                "#ff7f0e",  # tens - ORANGE (Orange = Ten commandments = tens) 
                "#2ca02c",  # hundreds - GREEN (Green = Grass/Ground = hundreds)
                "#d62728",  # thousands - RED (Red = Thousand suns/fire = thousands)
                "#9467bd",  # ten-thousands - PURPLE (Purple = Prestigious/Premium = ten-thousands)
            ],
            'name': 'Memory Aid Colors'
        },
        
        # High contrast monochromatic palette (different shades)
        'grayscale': {
            'colors': [
                "#000000",  # ones - black
                "#404040",  # tens - dark gray
                "#808080",  # hundreds - medium gray  
                "#b0b0b0",  # thousands - light gray
                "#d0d0d0",  # ten-thousands - very light gray
            ],
            'name': 'Grayscale Shades'
        },
        
        # Nature-inspired colorblind safe palette
        'nature': {
            'colors': [
                "#4E79A7",  # ones - sky blue
                "#F28E2C",  # tens - sunset orange
                "#E15759",  # hundreds - coral red
                "#76B7B2",  # thousands - seafoam green
                "#59A14F",  # ten-thousands - forest green
            ],
            'name': 'Nature Colors'
        }
    }
    
    # Get the selected palette (default to 'default' palette)
    palette_name = config.get('color_palette', 'default')
    selected_palette = color_palettes.get(palette_name, color_palettes['default'])
    place_value_colors = selected_palette['colors']
    
    if color_scheme == 'place-value':
        # Color each digit by its place value (right-to-left: rightmost is ones)
        digits = str(number)
        colored_spans = []
        
        for i, digit in enumerate(digits):
            place_idx = len(digits) - 1 - i  # rightmost digit is place 0 (ones)
            color_idx = place_idx % len(place_value_colors)
            color = place_value_colors[color_idx]
            colored_spans.append(f'<span style="color: {color};">{digit}</span>')
        
        return ''.join(colored_spans)
    elif color_scheme == 'heaven-earth':
        # Use orange (heaven bead color)
        return f'<span style="color: #F18F01;">{number}</span>'
    elif color_scheme == 'alternating':
        # For alternating, use blue for simplicity in web display
        return f'<span style="color: #1E88E5;">{number}</span>'
    else:
        return str(number)


def get_numeral_color(number, config):
    """Get single color for numeral (kept for backwards compatibility with tests).""" 
    color_scheme = config.get('color_scheme', 'monochrome')
    
    # For web display, automatically use colored numerals for non-monochrome schemes
    use_colored = config.get('colored_numerals', False) or color_scheme != 'monochrome'
    
    if not use_colored or color_scheme == 'monochrome':
        return "#333"
    
    # Get color palette (reuse same palette logic)
    color_palettes = {
        'default': ['#2E86AB', '#A23B72', '#F18F01', '#6A994E', '#BC4B51'],
        'colorblind': ['#0173B2', '#DE8F05', '#CC78BC', '#029E73', '#D55E00'],
        'mnemonic': ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'],
        'grayscale': ['#000000', '#404040', '#808080', '#b0b0b0', '#d0d0d0'],
        'nature': ['#4E79A7', '#F28E2C', '#E15759', '#76B7B2', '#59A14F']
    }
    
    palette_name = config.get('color_palette', 'default')
    place_value_colors = color_palettes.get(palette_name, color_palettes['default'])
    
    if color_scheme == 'place-value':
        # For single color (used by tests), return highest place value color
        digits = str(number)
        place_idx = len(digits) - 1  # Most significant digit place
        color_idx = place_idx % len(place_value_colors)
        return place_value_colors[color_idx]
    elif color_scheme == 'heaven-earth':
        # Use orange (heaven bead color)
        return "#F18F01"
    elif color_scheme == 'alternating':
        # For alternating, use blue for simplicity in web display
        return "#1E88E5"
    else:
        return "#333"


def generate_card_svgs(numbers, config):
    """Generate SVG content for each flashcard using existing Typst pipeline."""
    try:
        from .generate import generate_cards_direct
    except ImportError:
        # Fallback for when running tests directly
        from generate import generate_cards_direct
    
    # Create temporary directory for SVG generation
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        svg_dir = tmpdir_path / 'svg_cards'
        
        # Configure for web-optimized SVGs
        web_config = {
            **config,
            'card_width': '1.5in',  # Much smaller card = larger abacus relative to viewBox
            'card_height': '1.5in',
            'transparent': True,  # Transparent background for web
            'scale_factor': 1.0   # Full size for web (was 0.8 - too small)
        }
        
        # Generate SVG files using existing pipeline
        generated_files = generate_cards_direct(
            numbers, web_config, svg_dir,
            format='svg', separate_fronts_backs=True
        )
        
        # Read SVG contents
        card_data = {}
        fronts_dir = svg_dir / 'fronts'
        
        for i, number in enumerate(numbers):
            front_file = fronts_dir / f'card_{i:03d}.svg'
            if front_file.exists():
                with open(front_file, 'r') as f:
                    svg_content = f.read()
                    # Remove XML declaration and DOCTYPE if present
                    if svg_content.startswith('<?xml'):
                        svg_content = svg_content.split('>', 1)[1]
                    card_data[number] = svg_content.strip()
            else:
                # Fallback if SVG generation failed
                card_data[number] = f'<svg width="300" height="200"><text x="150" y="100" text-anchor="middle" font-size="48">{number}</text></svg>'
        
        return card_data


def generate_web_flashcards(numbers, config, output_path):
    """Generate HTML file with flashcard layout."""
    
    # Generate SVG content for all cards
    print(f"Generating SVG content for {len(numbers)} cards...")
    card_svgs = generate_card_svgs(numbers, config)
    
    # Generate individual cards HTML
    cards_html = []
    for i, number in enumerate(numbers):
        svg_content = card_svgs.get(number, f'<svg width="300" height="200"><text x="150" y="100" text-anchor="middle" font-size="48">Error</text></svg>')
        colored_numeral = get_colored_numeral_html(number, config)
        
        card_html = f'''
        <div class="flashcard" data-number="{number}">
            <div class="card-number">#{i+1}</div>
            <div class="abacus-container">
                {svg_content}
            </div>
            <div class="numeral">{colored_numeral}</div>
        </div>'''
        
        cards_html.append(card_html)
    
    # Configuration descriptions
    color_schemes = {
        'monochrome': 'All beads are the same color',
        'place-value': 'Each place value (ones, tens, hundreds) has a different color',
        'heaven-earth': 'Heaven beads (5-value) and earth beads (1-value) have different colors',
        'alternating': 'Columns alternate between two colors'
    }
    
    color_scheme_description = color_schemes.get(
        config.get('color_scheme', 'monochrome'),
        'Monochrome color scheme'
    )
    
    # Format font size for CSS
    font_size = config.get('font_size', '48pt')
    if not font_size.endswith(('px', 'pt', 'em', 'rem', '%')):
        font_size = font_size + 'px'  # Add px if no unit specified
    
    # HTML template
    html_template = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Soroban Flashcards</title>
    <style>
        body {{
            font-family: {font_family}, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            line-height: 1.6;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        
        .header {{
            text-align: center;
            margin-bottom: 30px;
        }}
        
        .header h1 {{
            color: #333;
            font-size: 2.5em;
            margin-bottom: 10px;
        }}
        
        .header p {{
            color: #666;
            font-size: 1.2em;
        }}
        
        .cards-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }}
        
        .flashcard {{
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            cursor: pointer;
            position: relative;
            min-height: 220px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }}
        
        .flashcard:hover {{
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.15);
        }}
        
        .abacus-container {{
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 10px 0;
            max-width: 100%;
            overflow: hidden;
        }}
        
        .abacus-container svg {{
            max-width: 100%;
            height: auto;
        }}
        
        .numeral {{
            font-size: {font_size};
            font-weight: bold;
            color: {numeral_color};
            opacity: 0;
            transition: opacity 0.3s ease;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255,255,255,0.95);
            padding: 15px 25px;
            border-radius: 8px;
            border: 2px solid #ddd;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 10;
        }}
        
        .flashcard:hover .numeral {{
            opacity: 1;
        }}
        
        .card-number {{
            position: absolute;
            top: 10px;
            left: 10px;
            font-size: 0.8em;
            color: #999;
            background: rgba(255,255,255,0.8);
            padding: 2px 6px;
            border-radius: 4px;
        }}
        
        .instructions {{
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        
        .instructions h3 {{
            color: #333;
            margin-bottom: 10px;
        }}
        
        .instructions p {{
            color: #666;
            line-height: 1.5;
        }}
        
        .stats {{
            display: flex;
            justify-content: space-around;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
        }}
        
        .stats div {{
            background: #f8f9fa;
            padding: 10px 15px;
            border-radius: 6px;
            font-size: 0.9em;
        }}
        
        @media (max-width: 768px) {{
            .cards-grid {{
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 15px;
            }}
            
            .flashcard {{
                min-height: 120px;
                padding: 15px;
            }}
            
            .numeral {{
                font-size: calc({font_size} * 0.8);
                padding: 10px 20px;
            }}
        }}
        
        /* Quiz Styling */
        .quiz-section {{
            background: #f8f9fa;
            border-radius: 12px;
            padding: 30px;
            margin: 30px 0;
            text-align: center;
        }}
        
        .quiz-section h2 {{
            color: #333;
            margin-bottom: 10px;
        }}
        
        .quiz-controls {{
            max-width: 600px;
            margin: 0 auto;
        }}
        
        .control-group {{
            margin: 20px 0;
        }}
        
        .control-group label {{
            display: block;
            font-weight: bold;
            margin-bottom: 10px;
            color: #555;
        }}
        
        .count-buttons {{
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
        }}
        
        .count-btn {{
            background: white;
            border: 2px solid #ddd;
            border-radius: 8px;
            padding: 10px 20px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 16px;
        }}
        
        .count-btn:hover {{
            border-color: #4a90e2;
            background: #f0f7ff;
        }}
        
        .count-btn.active {{
            background: #4a90e2;
            color: white;
            border-color: #4a90e2;
        }}
        
        .slider-container {{
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
        }}
        
        .slider-container input[type="range"] {{
            width: 200px;
            height: 6px;
            border-radius: 3px;
            background: #ddd;
            outline: none;
            -webkit-appearance: none;
        }}
        
        .slider-container input[type="range"]::-webkit-slider-thumb {{
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #4a90e2;
            cursor: pointer;
        }}
        
        .slider-value {{
            font-weight: bold;
            color: #4a90e2;
            min-width: 50px;
        }}
        
        .quiz-start-btn {{
            background: #28a745;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 15px 30px;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s ease;
            margin-top: 20px;
        }}
        
        .quiz-start-btn:hover {{
            background: #218838;
        }}
        
        /* Quiz Game Area */
        .quiz-game {{
            text-align: center;
            padding: 40px 20px;
        }}
        
        .quiz-progress {{
            margin-bottom: 30px;
        }}
        
        .progress-bar {{
            width: 100%;
            max-width: 400px;
            height: 8px;
            background: #ddd;
            border-radius: 4px;
            margin: 0 auto 10px;
            overflow: hidden;
        }}
        
        .progress-fill {{
            height: 100%;
            background: #4a90e2;
            transition: width 0.3s ease;
            width: 0%;
        }}
        
        .progress-text {{
            color: #666;
            font-size: 16px;
        }}
        
        .quiz-display {{
            position: relative;
            min-height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
        }}
        
        .quiz-flashcard {{
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 8px 16px rgba(0,0,0,0.1);
            width: min(85vw, 700px);
            height: min(50vh, 400px);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
            transition: transform 0.3s ease;
        }}
        
        /* Ensure quiz game section fits in viewport */
        #quiz-game {{
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 20px;
            box-sizing: border-box;
        }}
        
        /* Responsive adjustments for smaller screens */
        @media (max-height: 600px) {{
            .quiz-flashcard {{
                height: min(40vh, 300px);
                padding: 15px;
            }}
        }}
        
        @media (max-height: 500px) {{
            .quiz-flashcard {{
                height: min(35vh, 250px);
                padding: 10px;
            }}
            
            #quiz-game {{
                min-height: auto;
                padding: 10px;
            }}
        }}
        
        .quiz-flashcard svg {{
            width: 100%;
            height: 100%;
            max-width: 100%;
            max-height: 100%;
        }}
        
        .quiz-flashcard.pulse {{
            transform: scale(1.05);
        }}
        
        .quiz-flashcard.card-exit-warning {{
            border-color: #dc3545;
            box-shadow: 0 0 15px rgba(220, 53, 69, 0.4);
        }}
        
        .quiz-flashcard.card-fade-out {{
            opacity: 0.3;
            transform: scale(0.95);
            transition: all 0.1s ease;
        }}
        
        .countdown {{
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 48px;
            font-weight: bold;
            color: #4a90e2;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
            z-index: 10;
        }}
        
        .countdown.ready {{
            color: #28a745;
        }}
        
        .countdown.go {{
            color: #ffc107;
        }}
        
        .countdown.new-card-flash {{
            color: #17a2b8;
            font-size: 24px;
            animation: flashIn 0.15s ease;
        }}
        
        @keyframes flashIn {{
            from {{
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.8);
            }}
            to {{
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }}
        }}
        
        /* Quiz Input */
        .quiz-input {{
            text-align: center;
            padding: 40px 20px;
            max-width: 700px;
            margin: 0 auto;
        }}
        
        .quiz-stats {{
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-bottom: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 12px;
        }}
        
        .stats-item {{
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
        }}
        
        .stats-label {{
            font-size: 14px;
            color: #666;
            font-weight: 500;
        }}
        
        .stats-item span:last-child {{
            font-size: 24px;
            font-weight: bold;
            color: #2c5f76;
        }}
        
        .smart-input-container {{
            position: relative;
            margin: 40px 0;
            text-align: center;
        }}
        
        .smart-input-prompt {{
            font-size: 16px;
            color: #7a8695;
            margin-bottom: 15px;
            font-weight: normal;
        }}
        
        .number-display {{
            min-height: 60px;
            padding: 20px;
            font-size: 32px;
            font-family: 'Courier New', 'Monaco', monospace;
            text-align: center;
            font-weight: bold;
            color: #2c3e50;
            letter-spacing: 3px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
        }}
        
        .current-typing {{
            display: inline-block;
            transition: all 0.3s ease;
        }}
        
        .number-display.correct .current-typing {{
            color: #28a745;
            animation: successPulse 0.5s ease;
        }}
        
        .number-display.incorrect .current-typing {{
            color: #dc3545;
            animation: errorShake 0.5s ease;
        }}
        
        @keyframes successPulse {{
            0%, 100% {{ transform: scale(1); }}
            50% {{ transform: scale(1.05); }}
        }}
        
        @keyframes errorShake {{
            0%, 100% {{ transform: translateX(0); }}
            25% {{ transform: translateX(-10px); }}
            75% {{ transform: translateX(10px); }}
        }}
        
        .input-feedback {{
            margin-top: 10px;
            font-weight: bold;
            min-height: 20px;
        }}
        
        .input-feedback.success {{
            color: #28a745;
        }}
        
        .input-feedback.error {{
            color: #dc3545;
        }}
        
        .found-numbers {{
            margin: 30px 0;
            min-height: 60px;
        }}
        
        .found-number {{
            display: inline-block;
            margin: 5px;
            padding: 10px 15px;
            background: #28a745;
            color: white;
            border-radius: 8px;
            font-weight: bold;
            font-size: 18px;
            animation: slideIn 0.3s ease;
        }}
        
        @keyframes slideIn {{
            from {{
                opacity: 0;
                transform: translateY(-20px);
            }}
            to {{
                opacity: 1;
                transform: translateY(0);
            }}
        }}
        
        .finish-btn {{
            background: #2c5f76;
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 18px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 20px;
        }}
        
        .finish-btn:hover {{
            background: #1e4a5c;
            transform: translateY(-2px);
        }}
        
        .quiz-finish-buttons {{
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 20px;
            flex-wrap: wrap;
        }}
        
        .give-up-btn {{
            background: #17a2b8;
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 18px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
        }}
        
        .give-up-btn:hover {{
            background: #138496;
            transform: translateY(-2px);
        }}
        
        .input-container {{
            margin-top: 20px;
        }}
        
        .quiz-input textarea {{
            width: 100%;
            max-width: 400px;
            height: 120px;
            border: 2px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            font-size: 16px;
            resize: vertical;
            font-family: inherit;
        }}
        
        .quiz-input textarea:focus {{
            outline: none;
            border-color: #4a90e2;
        }}
        
        .quiz-input button {{
            background: #4a90e2;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 15px;
        }}
        
        .quiz-input button:hover {{
            background: #357abd;
        }}
        
        /* Quiz Results */
        .quiz-results {{
            text-align: center;
            padding: 40px 20px;
            max-width: 700px;
            margin: 0 auto;
        }}
        
        .score-display {{
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 40px;
            margin: 30px 0;
            flex-wrap: wrap;
        }}
        
        .score-circle {{
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: linear-gradient(135deg, #4a90e2, #357abd);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: bold;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }}
        
        .score-details {{
            text-align: left;
        }}
        
        .score-details p {{
            margin: 8px 0;
            font-size: 16px;
        }}
        
        .results-breakdown {{
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
            text-align: left;
        }}
        
        .result-item {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #eee;
        }}
        
        .result-item:last-child {{
            border-bottom: none;
        }}
        
        .result-correct {{
            color: #28a745;
            font-weight: bold;
        }}
        
        .result-incorrect {{
            color: #dc3545;
            font-weight: bold;
        }}
        
        .quiz-actions {{
            margin-top: 30px;
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
        }}
        
        .quiz-actions button {{
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            transition: background 0.2s ease;
        }}
        
        #retry-quiz {{
            background: #ffc107;
            color: #333;
        }}
        
        #retry-quiz:hover {{
            background: #e0a800;
        }}
        
        #back-to-cards {{
            background: #6c757d;
            color: white;
        }}
        
        #back-to-cards:hover {{
            background: #545b62;
        }}
        
        /* End Game Button */
        .end-game-btn {{
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s ease;
        }}
        
        .end-game-btn:hover {{
            background: #c82333;
        }}
        
        /* Quiz Header for Game Mode */
        .quiz-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding: 15px 20px;
            background: rgba(74, 144, 226, 0.1);
            border-radius: 8px;
        }}
        
        .quiz-header .quiz-progress {{
            flex: 1;
        }}
        
        @media (max-width: 768px) {{
            .quiz-section {{
                padding: 20px;
            }}
            
            .count-buttons {{
                gap: 8px;
            }}
            
            .count-btn {{
                padding: 8px 16px;
                font-size: 14px;
            }}
            
            .score-display {{
                flex-direction: column;
                gap: 20px;
            }}
            
            .score-details {{
                text-align: center;
            }}
            
            .countdown {{
                font-size: 36px;
            }}
            
            .sorting-section {{
                padding: 20px;
            }}
            
            .sorting-grid {{
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 10px;
                padding: 15px;
            }}
            
            .sort-card {{
                padding: 10px;
            }}
            
            .sort-count-btn {{
                padding: 8px 16px;
                font-size: 14px;
                margin: 2px;
            }}
            
            .sort-start-btn, .sort-check-btn, .sort-reveal-btn, .sort-new-btn {{
                padding: 10px 16px;
                font-size: 14px;
                margin: 5px;
            }}
            
            .sorting-actions {{
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
            }}
            
            .challenge-buttons {{
                grid-template-columns: 1fr;
                gap: 15px;
                margin: 20px 0;
            }}
            
            .modal-content {{
                width: 95%;
                max-height: 95vh;
            }}
            
            .modal-header {{
                padding: 15px 20px;
            }}
            
            .modal-body {{
                padding: 20px;
            }}
            
            .modal-header h2 {{
                font-size: 18px;
            }}
        }}
        
        /* Card Sorting Styling */
        .sorting-section {{
            background: #e8f4f8;
            border-radius: 12px;
            padding: 30px;
            margin: 30px 0;
            text-align: center;
        }}
        
        .sorting-section h2 {{
            color: #2c5f76;
            margin-bottom: 10px;
        }}
        
        .sorting-controls {{
            max-width: 600px;
            margin: 0 auto;
        }}
        
        .sort-count-btn {{
            background: #ffffff;
            color: #2c5f76;
            border: 2px solid #2c5f76;
            border-radius: 8px;
            padding: 10px 20px;
            margin: 0 5px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s ease;
        }}
        
        .sort-count-btn:hover {{
            background: #2c5f76;
            color: white;
            transform: translateY(-2px);
        }}
        
        .sort-count-btn.active {{
            background: #2c5f76;
            color: white;
        }}
        
        .sorting-actions {{
            margin-top: 20px;
        }}
        
        /* Setup modal body for sticky positioning */
        .modal-body {{
            position: relative;
        }}
        
        /* Sticky header within modal body */
        .sorting-header {{
            position: sticky;
            top: 0;
            background: #f8f9fa;
            border-bottom: 2px solid #e1e5e9;
            border-radius: 8px 8px 0 0;
            z-index: 50;
            padding: 12px 20px;
            margin: 0 -20px 15px -20px; /* Extend to edges of modal body */
        }}
        
        .sorting-header-content {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }}
        
        .sorting-status-group {{
            display: flex;
            flex-direction: column;
            gap: 5px;
        }}
        
        .sorting-timer {{
            font-size: 18px;
            font-weight: bold;
            color: #2c5f76;
        }}
        
        .sorting-controls {{
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }}
        
        .header-btn {{
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
        }}
        
        .check-btn {{
            background: #28a745;
            color: white;
        }}
        
        .check-btn:hover {{
            background: #218838;
        }}
        
        .reveal-btn {{
            background: #ffc107;
            color: #212529;
        }}
        
        .reveal-btn:hover {{
            background: #e0a800;
        }}
        
        .new-btn {{
            background: #007bff;
            color: white;
        }}
        
        .new-btn:hover {{
            background: #0056b3;
        }}
        
        .end-btn {{
            background: #dc3545;
            color: white;
        }}
        
        .end-btn:hover {{
            background: #c82333;
        }}
        
        .sorting-game-actions {{
            display: none; /* Hide old action buttons */
        }}
        
        /* Score Modal Styles */
        .score-modal {{
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 2000;
            display: flex;
            justify-content: center;
            align-items: center;
            animation: fadeIn 0.3s ease;
        }}
        
        .score-modal-content {{
            background: white;
            border-radius: 12px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease;
        }}
        
        .score-modal-header {{
            padding: 20px 30px;
            border-bottom: 1px solid #e1e5e9;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        
        .score-modal-header h3 {{
            margin: 0;
            color: #333;
            font-size: 24px;
        }}
        
        .score-modal-close {{
            background: none;
            border: none;
            font-size: 32px;
            cursor: pointer;
            color: #666;
            padding: 0;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 20px;
            transition: all 0.2s ease;
        }}
        
        .score-modal-close:hover {{
            background: #f8f9fa;
            color: #333;
        }}
        
        .score-modal-body {{
            padding: 30px;
        }}
        
        .score-modal-body .feedback-score {{
            font-size: 48px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 20px;
            color: #28a745;
        }}
        
        .score-modal-body .feedback-message {{
            font-size: 20px;
            text-align: center;
            margin-bottom: 15px;
            color: #333;
        }}
        
        .score-modal-body .feedback-time {{
            font-size: 18px;
            text-align: center;
            margin-bottom: 25px;
            color: #666;
            font-weight: bold;
        }}
        
        .score-modal-body .feedback-breakdown {{
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }}
        
        .score-modal-body .score-component {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #e9ecef;
        }}
        
        .score-modal-body .score-component:last-child {{
            border-bottom: none;
        }}
        
        .score-modal-body .component-label {{
            font-weight: bold;
            color: #333;
        }}
        
        .score-modal-body .component-score {{
            font-weight: bold;
            color: #007bff;
        }}
        
        .score-modal-body .component-weight {{
            color: #666;
            font-size: 14px;
        }}
        
        .score-modal-body .feedback-details {{
            background: #e9ecef;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
            font-size: 16px;
            color: #495057;
        }}
        
        .score-modal-footer {{
            padding: 20px 30px;
            border-top: 1px solid #e1e5e9;
            display: flex;
            gap: 15px;
            justify-content: flex-end;
        }}
        
        .modal-btn {{
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.2s ease;
        }}
        
        .new-game-btn {{
            background: #007bff;
            color: white;
        }}
        
        .new-game-btn:hover {{
            background: #0056b3;
        }}
        
        .close-btn {{
            background: #6c757d;
            color: white;
        }}
        
        .close-btn:hover {{
            background: #545b62;
        }}
        
        @keyframes fadeIn {{
            from {{ opacity: 0; }}
            to {{ opacity: 1; }}
        }}
        
        @keyframes slideIn {{
            from {{ 
                transform: translateY(-50px);
                opacity: 0;
            }}
            to {{ 
                transform: translateY(0);
                opacity: 1;
            }}
        }}
        
        .sort-start-btn, .sort-check-btn, .sort-reveal-btn, .sort-new-btn {{
            background: #2c5f76;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-size: 16px;
            cursor: pointer;
            margin: 0 10px;
            transition: all 0.3s ease;
        }}
        
        .sort-start-btn:hover, .sort-check-btn:hover, .sort-reveal-btn:hover, .sort-new-btn:hover {{
            background: #1e4a61;
            transform: translateY(-2px);
        }}
        
        .sort-check-btn {{
            background: #28a745;
        }}
        
        .sort-check-btn:hover {{
            background: #218838;
        }}
        
        .sort-reveal-btn {{
            background: #ffc107;
            color: #333;
        }}
        
        .sort-reveal-btn:hover {{
            background: #e0a800;
        }}
        
        .sort-new-btn {{
            background: #6f42c1;
        }}
        
        .sort-new-btn:hover {{
            background: #5a32a3;
        }}
        
        .sorting-instructions {{
            margin: 20px 0;
            color: #2c5f76;
        }}
        
        .sorting-progress {{
            background: #fff;
            border-radius: 8px;
            padding: 10px 20px;
            margin: 10px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        
        /* Horizontal layout for sorting game */
        .sorting-game-layout {{
            display: flex;
            gap: 30px;
            margin: 20px 0;
        }}
        
        .available-cards-section {{
            flex: 1;
        }}
        
        .sorting-slots-section {{
            flex: 2;
        }}
        
        .available-cards-section h4,
        .sorting-slots-section h4 {{
            margin: 0 0 15px 0;
            color: #2c5f76;
            font-size: 18px;
            text-align: center;
        }}
        
        .sorting-area {{
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: center;
            padding: 15px;
            background: rgba(255,255,255,0.5);
            border-radius: 8px;
            min-height: 120px;
            border: 2px dashed #2c5f76;
        }}
        
        @media (max-width: 768px) {{
            .sorting-game-layout {{
                flex-direction: column;
                gap: 20px;
            }}
            
            .available-cards-section,
            .sorting-slots-section {{
                flex: none;
            }}
        }}
        
        .position-slots {{
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: center;
            align-items: center;
            padding: 15px;
            background: rgba(255,255,255,0.7);
            border-radius: 8px;
            border: 2px dashed #2c5f76;
        }}
        
        .insert-button {{
            width: 32px;
            height: 50px;
            background: #2c5f76;
            color: white;
            border: none;
            border-radius: 20px;
            cursor: pointer;
            font-size: 24px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            opacity: 0.3;
        }}
        
        .insert-button:hover {{
            opacity: 1;
            background: #1976d2;
            transform: scale(1.1);
        }}
        
        .insert-button.active {{
            opacity: 1;
            background: #1976d2;
            box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
        }}
        
        .insert-button.disabled {{
            opacity: 0.1;
            cursor: not-allowed;
        }}
        
        .position-slot {{
            width: 90px;
            height: 110px;
            border: 2px solid #2c5f76;
            border-radius: 8px;
            background: #fff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
        }}
        
        .position-slot.gradient-bg {{
            color: white;
            border-color: rgba(255,255,255,0.3);
        }}
        
        .position-slot:hover {{
            background: #f0f8ff;
            border-color: #1a4a5c;
            transform: scale(1.05);
        }}
        
        .position-slot.active {{
            background: #e3f2fd;
            border-color: #1976d2;
            box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
        }}
        
        
        .position-slot .slot-label {{
            font-size: 12px;
            text-align: center;
            font-weight: 500;
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
            /* Color will be set dynamically based on background */
        }}
        
        .position-slot.filled .slot-label {{
            position: absolute;
            bottom: 8px;
            left: 8px;
            right: 8px;
            color: #2c3e50;
            text-shadow: none;
            font-size: 11px;
            font-weight: 600;
            opacity: 0;
            transition: opacity 0.3s ease;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 4px;
            padding: 4px 8px;
        }}
        
        .position-slot.filled:hover .slot-label {{
            opacity: 1;
        }}
        
        .position-slot.filled {{
            background: #e8f5e8;
            border-color: #28a745;
        }}
        
        .position-slot.filled .slot-card {{
            position: absolute;
            top: 5px;
            left: 5px;
            right: 5px;
            bottom: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
        }}
        
        .position-slot.correct {{
            border-color: #28a745;
            background: #f8fff9;
        }}
        
        .position-slot.incorrect {{
            border-color: #dc3545;
            background: #fff8f8;
            animation: shake 0.5s ease-in-out;
        }}
        
        .sorting-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin: 30px 0;
            padding: 20px;
            background: rgba(255,255,255,0.7);
            border-radius: 12px;
            min-height: 300px;
        }}
        
        .sort-card {{
            background: white;
            border-radius: 8px;
            padding: 8px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 2px solid transparent;
            position: relative;
            user-select: none;
            width: 90px;
            height: 90px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }}
        
        .sort-card .card-svg svg {{
            max-width: 100%;
            height: auto;
        }}
        
        .sort-card:hover {{
            transform: translateY(-5px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.2);
            border-color: #2c5f76;
        }}
        
        .sort-card.selected {{
            border-color: #1976d2;
            background: #e3f2fd;
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(25, 118, 210, 0.3);
        }}
        
        .sort-card.placed {{
            opacity: 0.7;
            transform: scale(0.9);
            cursor: default;
        }}
        
        .sort-card.placed:hover {{
            transform: scale(0.95);
            border-color: #28a745;
        }}
        
        .sort-card.correct {{
            border-color: #28a745;
            background: #f8fff9;
        }}
        
        .sort-card.incorrect {{
            border-color: #dc3545;
            background: #fff8f8;
            animation: shake 0.5s ease-in-out;
        }}
        
        .sort-card .card-position {{
            position: absolute;
            top: 5px;
            left: 5px;
            background: rgba(44, 95, 118, 0.8);
            color: white;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
        }}
        
        .sort-card .revealed-number {{
            position: absolute;
            top: 5px;
            right: 5px;
            background: #ffc107;
            color: #333;
            border-radius: 4px;
            padding: 2px 8px;
            font-size: 14px;
            font-weight: bold;
            display: none;
        }}
        
        .sort-card.revealed .revealed-number {{
            display: block;
        }}
        
        .sorting-feedback {{
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
        }}
        
        .feedback-perfect {{
            background: linear-gradient(135deg, #d4edda, #c3e6cb);
            color: #155724;
            border: 2px solid #28a745;
        }}
        
        .feedback-good {{
            background: linear-gradient(135deg, #fff3cd, #ffeaa7);
            color: #856404;
            border: 2px solid #ffc107;
        }}
        
        .feedback-needs-work {{
            background: linear-gradient(135deg, #f8d7da, #f5c6cb);
            color: #721c24;
            border: 2px solid #dc3545;
        }}
        
        .feedback-score {{
            font-size: 24px;
            font-weight: bold;
            margin: 10px 0;
        }}
        
        .feedback-message {{
            font-size: 18px;
            margin: 10px 0;
        }}
        
        .feedback-details {{
            margin-top: 15px;
            font-size: 14px;
            opacity: 0.8;
        }}
        
        .feedback-breakdown {{
            margin: 20px 0;
            padding: 15px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
        }}
        
        .score-component {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 8px 0;
            padding: 5px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }}
        
        .score-component:last-child {{
            border-bottom: none;
        }}
        
        .component-label {{
            font-weight: bold;
            flex: 1;
        }}
        
        .component-score {{
            font-weight: bold;
            margin: 0 10px;
            min-width: 40px;
            text-align: right;
        }}
        
        .component-weight {{
            font-size: 12px;
            opacity: 0.7;
            min-width: 80px;
            text-align: right;
        }}
        
        @keyframes shake {{
            0%, 100% {{ transform: translateX(0); }}
            25% {{ transform: translateX(-5px); }}
            75% {{ transform: translateX(5px); }}
        }}
        
        @keyframes success-pulse {{
            0% {{ transform: scale(1); }}
            50% {{ transform: scale(1.05); }}
            100% {{ transform: scale(1); }}
        }}
        
        .sort-card.success {{
            animation: success-pulse 0.6s ease-in-out;
        }}
        
        /* Challenge Buttons */
        .challenge-buttons {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 30px 0;
            max-width: 800px;
            margin-left: auto;
            margin-right: auto;
        }}
        
        .challenge-btn {{
            background: linear-gradient(135deg, #4a90e2, #357abd);
            color: white;
            border: none;
            border-radius: 16px;
            padding: 30px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-align: left;
            box-shadow: 0 6px 20px rgba(74, 144, 226, 0.3);
        }}
        
        .challenge-btn:hover {{
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(74, 144, 226, 0.4);
        }}
        
        .challenge-btn h3 {{
            margin: 0 0 10px 0;
            font-size: 20px;
            font-weight: bold;
        }}
        
        .challenge-btn p {{
            margin: 0;
            opacity: 0.9;
            font-size: 14px;
            line-height: 1.4;
        }}
        
        .sorting-btn {{
            background: linear-gradient(135deg, #2c5f76, #1e4a61);
            box-shadow: 0 6px 20px rgba(44, 95, 118, 0.3);
        }}
        
        .sorting-btn:hover {{
            box-shadow: 0 8px 25px rgba(44, 95, 118, 0.4);
        }}
        
        /* Modal Styling */
        .modal {{
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            animation: fadeIn 0.3s ease-out;
        }}
        
        .modal.show {{
            display: flex;
            align-items: center;
            justify-content: center;
        }}
        
        .modal-content {{
            background: white;
            border-radius: 12px;
            width: 90%;
            max-width: 900px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            animation: slideIn 0.3s ease-out;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }}
        
        .modal-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 30px;
            border-bottom: 1px solid #eee;
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            border-radius: 12px 12px 0 0;
        }}
        
        .modal-header h2 {{
            margin: 0;
            color: #333;
        }}
        
        .modal-controls {{
            display: flex;
            gap: 10px;
        }}
        
        .fullscreen-btn, .close-btn {{
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            padding: 5px 10px;
            border-radius: 6px;
            transition: background 0.2s ease;
        }}
        
        .fullscreen-btn:hover, .close-btn:hover {{
            background: rgba(0, 0, 0, 0.1);
        }}
        
        .close-btn {{
            color: #666;
        }}
        
        .close-btn:hover {{
            color: #333;
        }}
        
        .modal-body {{
            padding: 30px;
            flex: 1;
            overflow-y: auto;
        }}
        
        /* Fullscreen modal styling */
        .modal.fullscreen {{
            background: rgba(0, 0, 0, 0.95);
        }}
        
        .modal.fullscreen .modal-content {{
            width: 100%;
            height: 100%;
            max-width: none;
            max-height: none;
            border-radius: 0;
        }}
        
        .modal.fullscreen .modal-header {{
            border-radius: 0;
        }}
        
        /* Animations */
        @keyframes fadeIn {{
            from {{ opacity: 0; }}
            to {{ opacity: 1; }}
        }}
        
        @keyframes slideIn {{
            from {{ transform: scale(0.9) translateY(-20px); opacity: 0; }}
            to {{ transform: scale(1) translateY(0); opacity: 1; }}
        }}
        
        @media print {{
            body {{
                background-color: white;
            }}
            .flashcard {{
                box-shadow: none;
                border: 1px solid #ddd;
                break-inside: avoid;
            }}
            .numeral {{
                opacity: 0.5;
                background: transparent;
                border: none;
                box-shadow: none;
            }}
            .quiz-section, .quiz-game, .quiz-input, .quiz-results, .sorting-section {{
                display: none !important;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Soroban Flashcards</h1>
            <p>Hover over the cards to reveal the numbers</p>
        </div>
        
        <div class="instructions">
            <h3>How to use these flashcards:</h3>
            <p>Look at each abacus representation and try to determine the number before hovering to reveal the answer. 
            The abacus shows numbers using beads: each column represents a place value (ones, tens, hundreds, etc.). 
            In each column, the top bead represents 5 and the bottom beads each represent 1.</p>
            
            <div class="stats">
                <div><strong>Cards:</strong> {card_count}</div>
                <div><strong>Range:</strong> {number_range}</div>
                <div><strong>Color Scheme:</strong> {color_scheme_description}</div>
                <div><strong>Bead Shape:</strong> {bead_shape}</div>
            </div>
        </div>
        
        <!-- Challenge Buttons -->
        <div class="challenge-buttons">
            <button id="open-quiz-modal" class="challenge-btn quiz-btn">
                <h3>Speed Memory Quiz</h3>
                <p>Test your soroban reading skills with timed card displays</p>
            </button>
            <button id="open-sorting-modal" class="challenge-btn sorting-btn">
                <h3>Card Sorting Challenge</h3>
                <p>Arrange cards in order using only the abacus representations</p>
            </button>
        </div>

        <!-- Quiz Modal -->
        <div id="quiz-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Speed Memory Quiz</h2>
                    <div class="modal-controls">
                        <button id="quiz-fullscreen-btn" class="fullscreen-btn" title="Toggle Fullscreen">⛶</button>
                        <button id="close-quiz-modal" class="close-btn">&times;</button>
                    </div>
                </div>
                <div class="modal-body">
                    <p>Test your soroban reading skills! Cards will be shown briefly, then you'll enter the numbers you remember.</p>
            
            <div class="quiz-controls">
                <div class="control-group">
                    <label for="quiz-count">Cards to Quiz:</label>
                    <div class="count-buttons">
                        <button type="button" class="count-btn" data-count="5">5</button>
                        <button type="button" class="count-btn" data-count="10">10</button>
                        <button type="button" class="count-btn active" data-count="15">15</button>
                        <button type="button" class="count-btn" data-count="25">25</button>
                        <button type="button" class="count-btn" data-count="all">All ({card_count})</button>
                    </div>
                </div>
                
                <div class="control-group">
                    <label for="display-time">Display Time per Card:</label>
                    <div class="slider-container">
                        <input type="range" id="display-time" min="0.5" max="10" step="0.5" value="2" />
                        <span class="slider-value">2.0s</span>
                    </div>
                </div>
                
                <button id="start-quiz" class="quiz-start-btn">Start Quiz</button>
            </div>

            <!-- Quiz Game Area (hidden initially) -->
            <div id="quiz-game" class="quiz-game" style="display: none;">
                <div class="quiz-header">
                    <div class="quiz-progress">
                        <div class="progress-bar">
                            <div class="progress-fill"></div>
                        </div>
                        <span class="progress-text">Card <span id="current-card">1</span> of <span id="total-cards">10</span></span>
                    </div>
                    <button id="end-quiz" class="end-game-btn">End Quiz</button>
                </div>
                
                <div class="quiz-display">
                    <div id="quiz-card" class="quiz-flashcard">
                        <!-- Card content will be inserted here -->
                    </div>
                    <div id="quiz-countdown" class="countdown">Get Ready...</div>
                </div>
            </div>

            <!-- Quiz Input Phase (hidden initially) -->
            <div id="quiz-input" class="quiz-input" style="display: none;">
                <h3>Enter the Numbers You Remember</h3>
                <div class="quiz-stats">
                    <div class="stats-item">
                        <span class="stats-label">Cards shown:</span>
                        <span id="cards-shown-count">0</span>
                    </div>
                    <div class="stats-item">
                        <span class="stats-label">Guesses left:</span>
                        <span id="guesses-remaining">0</span>
                    </div>
                    <div class="stats-item">
                        <span class="stats-label">Found:</span>
                        <span id="numbers-found">0</span>
                    </div>
                </div>
                
                <div class="smart-input-container">
                    <div class="smart-input-prompt">Type the numbers you remember:</div>
                    <div class="number-display" id="number-display">
                        <span class="current-typing" id="current-typing"></span>
                    </div>
                    <input type="text" id="smart-input" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;" autocomplete="off">
                </div>
                
                <div class="found-numbers" id="found-numbers">
                    <!-- Accepted numbers will appear here -->
                </div>
                
                <div class="quiz-finish-buttons">
                    <button id="finish-quiz" class="finish-btn" style="display: none;">Finish Quiz</button>
                    <button id="give-up-quiz" class="give-up-btn" style="display: none;">Can't Remember More</button>
                </div>
            </div>

            <!-- Quiz Results (hidden initially) -->
            <div id="quiz-results" class="quiz-results" style="display: none;">
                <h3>Quiz Results</h3>
                <div class="score-display">
                    <div class="score-circle">
                        <span id="score-percentage">0%</span>
                    </div>
                    <div class="score-details">
                        <p><strong>Score:</strong> <span id="score-correct">0</span> / <span id="score-total">0</span> correct</p>
                        <p><strong>Time per card:</strong> <span id="result-timing">2.0s</span></p>
                    </div>
                </div>
                
                <div class="results-breakdown">
                    <h4>Detailed Results:</h4>
                    <div id="results-list">
                        <!-- Results will be inserted here -->
                    </div>
                </div>
                
                <div class="quiz-actions">
                    <button id="retry-quiz">Try Again</button>
                    <button id="back-to-cards">Back to Cards</button>
                </div>
            </div>
                </div>
            </div>
        </div>
        
        <!-- Sorting Modal -->
        <div id="sorting-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Card Sorting Challenge</h2>
                    <div class="modal-controls">
                        <button id="sorting-fullscreen-btn" class="fullscreen-btn" title="Toggle Fullscreen">⛶</button>
                        <button id="close-sorting-modal" class="close-btn">&times;</button>
                    </div>
                </div>
                <div class="modal-body">
                    <p>Click cards and positions to arrange them in ascending order (smallest to largest). No numerals shown - rely on reading the abacus!</p>
            
            <div class="sorting-controls">
                <div class="control-group">
                    <label for="sort-count">Cards to Sort:</label>
                    <div class="count-buttons">
                        <button type="button" class="sort-count-btn active" data-count="5">5</button>
                        <button type="button" class="sort-count-btn" data-count="8">8</button>
                        <button type="button" class="sort-count-btn" data-count="12">12</button>
                        <button type="button" class="sort-count-btn" data-count="15">15</button>
                    </div>
                </div>
                
                <div class="sorting-actions">
                    <button id="start-sorting" class="sort-start-btn">Start Sorting Challenge</button>
                </div>
            </div>
            
            <!-- Game Action Buttons (now moved to sticky header) -->
            <div class="sorting-game-actions" style="display: none;">
                <!-- Buttons moved to sticky header -->
            </div>
            
            <!-- Sorting Game Header (Sticky) -->
            <div id="sorting-header" class="sorting-header" style="display: none;">
                <div class="sorting-header-content">
                    <div class="sorting-status-group">
                        <span id="sorting-status">Ready to start</span>
                        <div class="sorting-timer" id="sorting-timer">0:00</div>
                    </div>
                    <div class="sorting-controls">
                        <button id="check-sorting" class="header-btn check-btn">Check Solution</button>
                        <button id="reveal-numbers" class="header-btn reveal-btn">Show Numbers</button>
                        <button id="new-sorting" class="header-btn new-btn">New Challenge</button>
                        <button id="end-sorting" class="header-btn end-btn">End Game</button>
                    </div>
                </div>
            </div>

            <!-- Sorting Game Area -->
            <div id="sorting-game" style="display: none;">
                <div class="sorting-instructions">
                    <p><strong>Instructions:</strong> Click a card → Click position or + button to place. Click placed cards to move back.</p>
                </div>
                
                <div class="sorting-game-layout">
                    <div class="available-cards-section">
                        <h4>Available Cards</h4>
                        <div id="sorting-area" class="sorting-area">
                            <!-- Available cards will be shown here -->
                        </div>
                    </div>
                    
                    <div class="sorting-slots-section">
                        <h4>Sorting Positions (Smallest → Largest)</h4>
                        <div id="position-slots" class="position-slots">
                            <!-- Position slots will be created here -->
                        </div>
                    </div>
                </div>
                
                <div class="sorting-feedback" id="sorting-feedback" style="display: none;">
                    <!-- Feedback will be shown here -->
                </div>
            </div>

            <!-- Score Report Modal -->
            <div id="score-modal" class="score-modal" style="display: none;">
                <div class="score-modal-content">
                    <div class="score-modal-header">
                        <h3>🎯 Sorting Challenge Results</h3>
                        <button class="score-modal-close">&times;</button>
                    </div>
                    <div id="score-modal-body" class="score-modal-body">
                        <!-- Score content will be inserted here -->
                    </div>
                    <div class="score-modal-footer">
                        <button id="score-modal-new-game" class="modal-btn new-game-btn">New Challenge</button>
                        <button id="score-modal-close-btn" class="modal-btn close-btn">Close</button>
                    </div>
                </div>
            </div>
                </div>
            </div>
        </div>

        <div class="cards-grid" id="cards-grid">
            {cards_html}
        </div>
        
        <div class="instructions">
            <p><em>Tip: You can print these cards for offline practice. Numbers will be faintly visible in print mode.</em></p>
        </div>
    </div>

    <script>
    // Modal Manager - Handles modal dialogs and fullscreen functionality
    class ModalManager {{
        constructor() {{
            this.isFullscreen = false;
            this.bindEvents();
        }}
        
        bindEvents() {{
            // Challenge button events
            document.getElementById('open-quiz-modal').addEventListener('click', () => {{
                this.openModal('quiz-modal');
            }});
            
            document.getElementById('open-sorting-modal').addEventListener('click', () => {{
                this.openModal('sorting-modal');
            }});
            
            // Close button events
            document.getElementById('close-quiz-modal').addEventListener('click', () => {{
                this.closeModal('quiz-modal');
            }});
            
            document.getElementById('close-sorting-modal').addEventListener('click', () => {{
                this.closeModal('sorting-modal');
            }});
            
            // Fullscreen button events
            document.getElementById('quiz-fullscreen-btn').addEventListener('click', () => {{
                this.toggleFullscreen('quiz-modal');
            }});
            
            document.getElementById('sorting-fullscreen-btn').addEventListener('click', () => {{
                this.toggleFullscreen('sorting-modal');
            }});
            
            // Close modal when clicking outside
            document.addEventListener('click', (e) => {{
                if (e.target.classList.contains('modal') && e.target.classList.contains('show')) {{
                    this.closeModal(e.target.id);
                }}
            }});
            
            // ESC key to close modal
            document.addEventListener('keydown', (e) => {{
                if (e.key === 'Escape') {{
                    const openModal = document.querySelector('.modal.show');
                    if (openModal) {{
                        this.closeModal(openModal.id);
                    }}
                }}
            }});
            
            // Fullscreen change events
            document.addEventListener('fullscreenchange', () => {{
                this.handleFullscreenChange();
            }});
            
            document.addEventListener('webkitfullscreenchange', () => {{
                this.handleFullscreenChange();
            }});
            
            document.addEventListener('mozfullscreenchange', () => {{
                this.handleFullscreenChange();
            }});
            
            document.addEventListener('MSFullscreenChange', () => {{
                this.handleFullscreenChange();
            }});
        }}
        
        openModal(modalId) {{
            const modal = document.getElementById(modalId);
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }}
        
        closeModal(modalId) {{
            const modal = document.getElementById(modalId);
            if (this.isFullscreen) {{
                this.exitFullscreen();
            }}
            modal.classList.remove('show', 'fullscreen');
            document.body.style.overflow = '';
        }}
        
        async toggleFullscreen(modalId) {{
            const modal = document.getElementById(modalId);
            
            if (!this.isFullscreen) {{
                try {{
                    if (modal.requestFullscreen) {{
                        await modal.requestFullscreen();
                    }} else if (modal.webkitRequestFullscreen) {{
                        await modal.webkitRequestFullscreen();
                    }} else if (modal.mozRequestFullScreen) {{
                        await modal.mozRequestFullScreen();
                    }} else if (modal.msRequestFullscreen) {{
                        await modal.msRequestFullscreen();
                    }}
                    modal.classList.add('fullscreen');
                }} catch (error) {{
                    console.warn('Fullscreen not supported or failed:', error);
                    // Fallback to CSS fullscreen
                    modal.classList.add('fullscreen');
                }}
            }} else {{
                this.exitFullscreen();
            }}
        }}
        
        exitFullscreen() {{
            if (document.exitFullscreen) {{
                document.exitFullscreen();
            }} else if (document.webkitExitFullscreen) {{
                document.webkitExitFullscreen();
            }} else if (document.mozCancelFullScreen) {{
                document.mozCancelFullScreen();
            }} else if (document.msExitFullscreen) {{
                document.msExitFullscreen();
            }}
        }}
        
        handleFullscreenChange() {{
            const isFullscreen = !!(document.fullscreenElement || 
                                   document.webkitFullscreenElement || 
                                   document.mozFullScreenElement || 
                                   document.msFullscreenElement);
            
            this.isFullscreen = isFullscreen;
            
            if (!isFullscreen) {{
                // Remove fullscreen class from all modals when exiting fullscreen
                document.querySelectorAll('.modal').forEach(modal => {{
                    modal.classList.remove('fullscreen');
                }});
            }}
        }}
    }}
    
    // Quiz functionality - No dependencies, pure JavaScript
    class SorobanQuiz {{
        constructor() {{
            this.cards = [];
            this.quizCards = [];
            this.currentCardIndex = 0;
            this.displayTime = 2.0;
            this.selectedCount = 15;
            this.foundNumbers = [];
            this.correctAnswers = [];
            this.guessesRemaining = 0;
            this.currentInput = '';
            this.incorrectGuesses = 0;
            this.finishButtonsBound = false;
            
            this.initializeCards();
            this.bindEvents();
        }}
        
        initializeCards() {{
            // Extract card data from the DOM
            const cardElements = document.querySelectorAll('.flashcard');
            this.cards = Array.from(cardElements).map(card => ({{
                number: parseInt(card.dataset.number),
                svg: card.querySelector('.abacus-container').innerHTML,
                element: card
            }}));
        }}
        
        bindEvents() {{
            // Count buttons
            document.querySelectorAll('.count-btn').forEach(btn => {{
                btn.addEventListener('click', (e) => {{
                    document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.selectedCount = btn.dataset.count === 'all' ? this.cards.length : parseInt(btn.dataset.count);
                }});
            }});
            
            // Display time slider
            const slider = document.getElementById('display-time');
            const valueDisplay = document.querySelector('.slider-value');
            slider.addEventListener('input', (e) => {{
                this.displayTime = parseFloat(e.target.value);
                valueDisplay.textContent = this.displayTime.toFixed(1) + 's';
            }});
            
            // Start quiz button
            document.getElementById('start-quiz').addEventListener('click', () => {{
                this.startQuiz();
            }});
            
            // Note: Submit answers button replaced by smart input system
            
            // Note: Finish quiz buttons are bound later in showInputPhase() when they become visible
            
            // End quiz button
            document.getElementById('end-quiz').addEventListener('click', () => {{
                this.endQuiz();
            }});
            
            // Retry and back buttons
            document.getElementById('retry-quiz').addEventListener('click', () => {{
                this.resetQuiz();
                this.startQuiz();
            }});
            
            document.getElementById('back-to-cards').addEventListener('click', () => {{
                this.resetQuiz();
            }});
        }}
        
        async startQuiz() {{
            // Select random cards
            this.quizCards = this.getRandomCards(this.selectedCount);
            this.correctAnswers = this.quizCards.map(card => card.number);
            this.currentCardIndex = 0;
            
            // Hide configuration controls, show only game
            document.querySelector('.quiz-controls').style.display = 'none';
            
            // Show quiz game section within modal
            this.hideQuizSections();
            document.getElementById('quiz-game').style.display = 'block';
            document.getElementById('total-cards').textContent = this.quizCards.length;
            
            // Start with the first card
            this.showNextCard();
        }}
        
        getRandomCards(count) {{
            const shuffled = [...this.cards].sort(() => 0.5 - Math.random());
            return shuffled.slice(0, Math.min(count, this.cards.length));
        }}
        
        async showNextCard() {{
            if (this.currentCardIndex >= this.quizCards.length) {{
                this.showInputPhase();
                return;
            }}
            
            const card = this.quizCards[this.currentCardIndex];
            const progress = ((this.currentCardIndex) / this.quizCards.length) * 100;
            
            // Update progress
            document.querySelector('.progress-fill').style.width = progress + '%';
            document.getElementById('current-card').textContent = this.currentCardIndex + 1;
            
            // Only show countdown for the very first card
            if (this.currentCardIndex === 0) {{
                await this.showCountdown();
            }} else {{
                // Subtle "new card" indicator for subsequent cards
                await this.showNewCardIndicator();
            }}
            
            // Show card
            await this.displayCard(card);
            
            this.currentCardIndex++;
            
            // Minimal delay before next card (just enough for the exit animation)
            setTimeout(() => {{
                this.showNextCard();
            }}, 100);
        }}
        
        async showNewCardIndicator() {{
            return new Promise(resolve => {{
                const countdownEl = document.getElementById('quiz-countdown');
                const cardEl = document.getElementById('quiz-card');
                
                // Hide card temporarily
                cardEl.style.display = 'none';
                countdownEl.style.display = 'block';
                
                // Brief flash to indicate new card
                countdownEl.textContent = 'Next';
                countdownEl.className = 'quiz-countdown new-card-flash';
                
                setTimeout(() => {{
                    countdownEl.style.display = 'none';
                    resolve();
                }}, 150); // Very brief indication
            }});
        }}

        async showCountdown() {{
            const countdownEl = document.getElementById('quiz-countdown');
            const cardEl = document.getElementById('quiz-card');
            
            cardEl.style.visibility = 'hidden';
            countdownEl.style.display = 'block';
            
            // 3, 2, 1 countdown
            const counts = ['3', '2', '1', 'GO!'];
            
            for (let i = 0; i < counts.length; i++) {{
                countdownEl.textContent = counts[i];
                countdownEl.className = 'countdown';
                if (i === counts.length - 1) countdownEl.classList.add('go');
                
                await this.delay(400);
            }}
            
            countdownEl.style.display = 'none';
        }}
        
        async displayCard(card) {{
            const cardEl = document.getElementById('quiz-card');
            const countdownEl = document.getElementById('quiz-countdown');
            
            // Show card content with entry animation
            cardEl.innerHTML = card.svg;
            cardEl.style.display = 'block';
            cardEl.style.visibility = 'visible';
            cardEl.classList.add('pulse');
            
            // Display for most of the time
            await this.delay((this.displayTime * 1000) - 300);
            
            // Subtle exit signal - brief red border flash
            cardEl.classList.add('card-exit-warning');
            await this.delay(200);
            
            // Quick fade out
            cardEl.classList.add('card-fade-out');
            await this.delay(100);
            
            // Hide card and reset classes
            cardEl.classList.remove('pulse', 'card-exit-warning', 'card-fade-out');
            cardEl.style.visibility = 'hidden';
        }}
        
        showInputPhase() {{
            // Complete progress bar
            document.querySelector('.progress-fill').style.width = '100%';
            
            // Initialize smart input system
            this.correctAnswers = this.quizCards.map(card => card.number);
            this.foundNumbers = [];
            this.guessesRemaining = this.selectedCount + Math.floor(this.selectedCount / 2); // Allow 50% extra guesses
            
            // Update stats display
            document.getElementById('cards-shown-count').textContent = this.quizCards.length;
            document.getElementById('guesses-remaining').textContent = this.guessesRemaining;
            document.getElementById('numbers-found').textContent = '0';
            
            // Hide quiz game, show input
            this.hideQuizSections();
            document.getElementById('quiz-input').style.display = 'block';
            
            // Setup smart input
            const smartInput = document.getElementById('smart-input');
            const display = document.getElementById('number-display');
            smartInput.value = '';
            document.getElementById('current-typing').textContent = '';
            
            // Focus the hidden input and make sure it captures keyboard events
            smartInput.focus();
            
            // Remove any existing event listeners to prevent duplicates
            const newSmartInput = smartInput.cloneNode(true);
            smartInput.parentNode.replaceChild(newSmartInput, smartInput);
            
            // Add input event listener for real-time validation
            newSmartInput.addEventListener('input', (e) => this.handleSmartInput(e));
            
            // Make the display area clickable to maintain focus
            display.addEventListener('click', () => {{
                newSmartInput.focus();
            }});
            
            // Keep focus on the hidden input
            newSmartInput.focus();
            
            // Bind finish buttons (they exist now that quiz-input is shown)
            this.bindFinishButtons();
            
            // Show finish button when all numbers found or guesses exhausted
            this.updateFinishButtonVisibility();
        }}
        
        bindFinishButtons() {{
            // Bind finish quiz buttons - called when input phase starts and buttons are visible
            // Only bind once to prevent duplicate listeners
            if (this.finishButtonsBound) return;
            
            const finishBtn = document.getElementById('finish-quiz');
            const giveUpBtn = document.getElementById('give-up-quiz');
            
            if (finishBtn) {{
                finishBtn.addEventListener('click', () => {{
                    console.log('Finish quiz button clicked');
                    this.finishQuiz();
                }});
                console.log('Finish button event listener added');
            }} else {{
                console.error('finish-quiz button not found in DOM');
            }}
            
            if (giveUpBtn) {{
                giveUpBtn.addEventListener('click', () => {{
                    console.log('Give up button clicked');
                    this.finishQuiz();
                }});
                console.log('Give up button event listener added');
            }} else {{
                console.error('give-up-quiz button not found in DOM');
            }}
            
            this.finishButtonsBound = true;
        }}
        
        handleSmartInput(event) {{
            const input = event.target;
            const value = input.value.trim();
            const display = document.getElementById('number-display');
            const typingSpan = document.getElementById('current-typing');
            
            // Reset visual feedback
            display.classList.remove('correct', 'incorrect');
            
            // Update the visual display
            typingSpan.textContent = value;
            
            // Check if input is empty
            if (!value) {{
                this.currentInput = '';
                return;
            }}
            
            // Check if it's a valid number
            const number = parseInt(value);
            if (isNaN(number)) {{
                return; // Wait for more input
            }}
            
            this.currentInput = value;
            
            // Check if this number is in our correct answers and not already found
            if (this.correctAnswers.includes(number) && !this.foundNumbers.includes(number)) {{
                // Correct number found!
                this.acceptCorrectNumber(number, input, display);
            }} else if (value.length >= 2 && !this.correctAnswers.includes(number)) {{
                // Wrong number (only trigger after at least 2 digits to avoid false positives)
                this.handleIncorrectGuess(input, display);
            }}
        }}
        
        acceptCorrectNumber(number, input, display) {{
            // Add to found numbers
            this.foundNumbers.push(number);
            
            // Visual success feedback
            display.classList.add('correct');
            
            // Update stats
            document.getElementById('numbers-found').textContent = this.foundNumbers.length;
            
            // Add to found numbers display
            this.addFoundNumberDisplay(number);
            
            // Clear input immediately for fast entry
            setTimeout(() => {{
                input.value = '';
                document.getElementById('current-typing').textContent = '';
                this.currentInput = '';
                
                // Check if we're done
                this.updateFinishButtonVisibility();
                
                // If all numbers found, auto-finish
                if (this.foundNumbers.length === this.correctAnswers.length) {{
                    setTimeout(() => this.finishQuiz(), 1000);
                }}
            }}, 150); // Much shorter delay - just enough to show the success feedback
            
            // Remove success visual feedback after animation completes
            setTimeout(() => {{
                display.classList.remove('correct');
            }}, 500);
        }}
        
        handleIncorrectGuess(input, display) {{
            // Only penalize if we have guesses remaining
            if (this.guessesRemaining > 0) {{
                this.guessesRemaining--;
                this.incorrectGuesses++; // Track incorrect guesses for scoring
                document.getElementById('guesses-remaining').textContent = this.guessesRemaining;
                
                // Visual error feedback
                display.classList.add('incorrect');
                
                // Clear input quickly for rapid entry
                setTimeout(() => {{
                    input.value = '';
                    document.getElementById('current-typing').textContent = '';
                    this.currentInput = '';
                    
                    // Check if we're out of guesses
                    this.updateFinishButtonVisibility();
                    if (this.guessesRemaining === 0) {{
                        setTimeout(() => this.finishQuiz(), 1000);
                    }}
                }}, 150); // Same fast clearing as correct numbers
                
                // Remove error visual feedback after animation completes
                setTimeout(() => {{
                    display.classList.remove('incorrect');
                }}, 500);
            }}
        }}
        
        addFoundNumberDisplay(number) {{
            const foundContainer = document.getElementById('found-numbers');
            const numberElement = document.createElement('span');
            numberElement.className = 'found-number';
            numberElement.textContent = number;
            foundContainer.appendChild(numberElement);
        }}
        
        updateFinishButtonVisibility() {{
            const finishBtn = document.getElementById('finish-quiz');
            const giveUpBtn = document.getElementById('give-up-quiz');
            
            const hasFoundSome = this.foundNumbers.length > 0;
            const hasFoundAll = this.foundNumbers.length === this.correctAnswers.length;
            const outOfGuesses = this.guessesRemaining === 0;
            const hasGuessesLeft = this.guessesRemaining > 0;
            
            if (hasFoundAll || outOfGuesses) {{
                // Show finish button when all found or no guesses left
                finishBtn.style.display = 'block';
                giveUpBtn.style.display = 'none';
                finishBtn.textContent = hasFoundAll ? 'Finish Quiz' : 'Show Results';
            }} else if (hasFoundSome && hasGuessesLeft) {{
                // Show both buttons when user has found some but could find more
                finishBtn.style.display = 'block';
                giveUpBtn.style.display = 'block';
                finishBtn.textContent = 'Show Results';
            }} else {{
                // No buttons when user hasn't found any yet
                finishBtn.style.display = 'none';
                giveUpBtn.style.display = 'none';
            }}
        }}
        
        finishQuiz() {{
            console.log('finishQuiz called, foundNumbers:', this.foundNumbers);
            // Use found numbers as answers and show results
            this.answers = [...this.foundNumbers];
            console.log('About to call showResults with answers:', this.answers);
            this.showResults();
        }}
        
        submitAnswers() {{
            const input = document.getElementById('answer-input').value;
            this.answers = this.parseAnswers(input);
            this.showResults();
        }}
        
        parseAnswers(input) {{
            // Parse comma or space separated numbers
            return input.split(/[,\\s]+/)
                       .map(s => s.trim())
                       .filter(s => s.length > 0)
                       .map(s => parseInt(s))
                       .filter(n => !isNaN(n));
        }}
        
        showResults() {{
            const scoreData = this.calculateScore();
            const correct = scoreData.correct;
            const finalScore = scoreData.finalScore;
            const percentage = Math.round(finalScore);
            
            // Update score display
            document.getElementById('score-percentage').textContent = percentage + '%';
            document.getElementById('score-correct').textContent = correct.length;
            document.getElementById('score-total').textContent = this.correctAnswers.length;
            document.getElementById('result-timing').textContent = this.displayTime.toFixed(1) + 's';
            
            // Show detailed results with penalty info
            this.showDetailedResults(correct, scoreData);
            
            // Hide input, show results
            this.hideQuizSections();
            document.getElementById('quiz-results').style.display = 'block';
        }}
        
        calculateScore() {{
            const correct = [];
            const correctSet = new Set(this.correctAnswers);
            const answerSet = new Set(this.answers);
            
            // Find correct answers
            this.answers.forEach(answer => {{
                if (correctSet.has(answer)) {{
                    correct.push(answer);
                }}
            }});
            
            // Calculate base score as percentage of correct answers
            const baseScore = (correct.length / this.correctAnswers.length) * 100;
            
            // Calculate penalty: lose 5 points per incorrect guess, minimum 0%
            const penalty = this.incorrectGuesses * 5;
            const finalScore = Math.max(0, baseScore - penalty);
            
            return {{
                correct: correct,
                baseScore: baseScore,
                penalty: penalty,
                incorrectGuesses: this.incorrectGuesses,
                finalScore: finalScore
            }};
        }}
        
        showDetailedResults(correct, scoreData) {{
            const resultsEl = document.getElementById('results-list');
            const correctSet = new Set(correct);
            const answerSet = new Set(this.answers);
            
            let html = '';
            
            // Show scoring breakdown if there were penalties
            if (scoreData && scoreData.incorrectGuesses > 0) {{
                html += `<div class="result-item score-breakdown">
                    <div style="margin-bottom: 10px; font-weight: bold; color: #2c5f76;">Score Breakdown:</div>
                    <div style="font-size: 0.9em; color: #666;">
                        Base Score: ${{Math.round(scoreData.baseScore)}}% (${{correct.length}} of ${{this.correctAnswers.length}} correct)<br>
                        Penalty: -${{scoreData.penalty}}% (${{scoreData.incorrectGuesses}} wrong guess${{scoreData.incorrectGuesses > 1 ? 'es' : ''}} × 5 points each)<br>
                        <strong style="color: #2c5f76;">Final Score: ${{Math.round(scoreData.finalScore)}}%</strong>
                    </div>
                </div>`;
            }}
            
            // Show all correct answers and whether user got them
            this.correctAnswers.forEach(num => {{
                const wasCorrect = correctSet.has(num);
                const className = wasCorrect ? 'result-correct' : 'result-incorrect';
                const status = wasCorrect ? '✓ Correct' : '✗ Missed';
                html += `<div class="result-item">
                    <span>Card: ${{num}}</span>
                    <span class="${{className}}">${{status}}</span>
                </div>`;
            }});
            
            // Show any extra incorrect answers
            const extraAnswers = this.answers.filter(a => !correctSet.has(a) && this.correctAnswers.includes(a) === false);
            extraAnswers.forEach(num => {{
                html += `<div class="result-item">
                    <span>Wrong guess: ${{num}}</span>
                    <span class="result-incorrect">✗ Not in quiz (-5 points)</span>
                </div>`;
            }});
            
            resultsEl.innerHTML = html;
        }}
        
        endQuiz() {{
            // Stop the current quiz and return to configuration
            this.resetQuiz();
        }}
        
        resetQuiz() {{
            // Reset state
            this.currentCardIndex = 0;
            this.answers = [];
            this.correctAnswers = [];
            this.quizCards = [];
            this.foundNumbers = [];
            this.guessesRemaining = 0;
            this.currentInput = '';
            this.incorrectGuesses = 0;
            this.finishButtonsBound = false;
            
            // Clear smart input
            const smartInput = document.getElementById('smart-input');
            if (smartInput) {{
                smartInput.value = '';
                smartInput.classList.remove('correct', 'incorrect');
            }}
            
            // Clear found numbers display
            const foundContainer = document.getElementById('found-numbers');
            if (foundContainer) {{
                foundContainer.innerHTML = '';
            }}
            
            // Reset stats display
            document.getElementById('cards-shown-count').textContent = '0';
            document.getElementById('guesses-remaining').textContent = '0';
            document.getElementById('numbers-found').textContent = '0';
            
            // Hide finish buttons
            document.getElementById('finish-quiz').style.display = 'none';
            document.getElementById('give-up-quiz').style.display = 'none';
            
            // Reset to initial quiz state (hide all sections, show controls)
            this.hideQuizSections();
            document.querySelector('.quiz-controls').style.display = 'block';
        }}
        
        hideQuizSections() {{
            document.getElementById('quiz-game').style.display = 'none';
            document.getElementById('quiz-input').style.display = 'none';
            document.getElementById('quiz-results').style.display = 'none';
        }}
        
        delay(ms) {{
            return new Promise(resolve => setTimeout(resolve, ms));
        }}
    }}
    
    // Card Sorting Challenge - Drag and drop functionality
    class SortingChallenge {{
        constructor() {{
            this.cards = [];
            this.sortingCards = [];
            this.selectedCount = 5;
            this.currentOrder = [];
            this.correctOrder = [];
            this.isDragging = false;
            this.draggedElement = null;
            this.draggedIndex = -1;
            this.previewOrder = [];
            this.lastInsertIndex = -1;
            this.touchStartElement = null;
            this.touchStartIndex = -1;
            this.touchStartX = 0;
            this.touchStartY = 0;
            
            this.initializeSorting();
            this.bindSortingEvents();
        }}
        
        initializeSorting() {{
            // Get available cards (same as quiz cards)
            const cardElements = document.querySelectorAll('.flashcard');
            this.cards = Array.from(cardElements).map(card => ({{
                number: parseInt(card.dataset.number),
                svg: card.querySelector('.abacus-container').outerHTML
            }}));
        }}
        
        bindSortingEvents() {{
            // Card count selection
            document.querySelectorAll('.sort-count-btn').forEach(btn => {{
                btn.addEventListener('click', (e) => {{
                    document.querySelectorAll('.sort-count-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    this.selectedCount = parseInt(e.target.dataset.count);
                }});
            }});
            
            // Action buttons
            document.getElementById('start-sorting').addEventListener('click', () => this.startSorting());
            document.getElementById('check-sorting').addEventListener('click', () => this.checkSolution());
            document.getElementById('reveal-numbers').addEventListener('click', () => this.revealNumbers());
            document.getElementById('new-sorting').addEventListener('click', () => this.newChallenge());
            document.getElementById('end-sorting').addEventListener('click', () => this.endSorting());
            
            // Score modal event listeners
            document.querySelector('.score-modal-close').addEventListener('click', () => this.hideScoreModal());
            document.getElementById('score-modal-close-btn').addEventListener('click', () => this.hideScoreModal());
            document.getElementById('score-modal-new-game').addEventListener('click', () => {{
                this.hideScoreModal();
                this.newChallenge();
            }});
            
            // Close modal when clicking outside
            document.getElementById('score-modal').addEventListener('click', (e) => {{
                if (e.target.id === 'score-modal') {{
                    this.hideScoreModal();
                }}
            }});
        }}
        
        startSorting() {{
            // Select random cards for sorting
            const shuffledCards = [...this.cards].sort(() => Math.random() - 0.5);
            this.sortingCards = shuffledCards.slice(0, this.selectedCount);
            this.correctOrder = [...this.sortingCards].sort((a, b) => a.number - b.number);
            
            // Shuffle the display order
            this.currentOrder = [...this.sortingCards].sort(() => Math.random() - 0.5);
            
            // Initialize revealed state
            this.numbersRevealed = false;
            
            // Hide configuration controls, show only game
            document.querySelector('.sorting-controls').style.display = 'none';
            
            // Show sorting game and sticky header
            document.getElementById('sorting-game').style.display = 'block';
            document.getElementById('sorting-header').style.display = 'block';
            
            this.renderSortingCards();
            this.updateSortingStatus(`Arrange the ${{this.selectedCount}} cards in ascending order (smallest to largest)`);
            
            // Start timer
            this.startTimer();
            
            // Reset reveal numbers button for new game
            document.getElementById('reveal-numbers').style.display = 'inline-block';
            
            // Update buttons - hide old controls, sticky header is now visible
            document.getElementById('start-sorting').style.display = 'none';
            document.querySelector('.sorting-game-actions').style.display = 'none';
        }}
        
        getSequenceStyle(position, totalSlots) {{
            // Generate neutral warm gray gradient that won't clash with abacus colors
            // Position 0 (first) = darkest, last position = lightest
            const intensity = position / (totalSlots - 1); // 0 to 1
            const lightness = 30 + (intensity * 45); // 30% to 75% lightness for better contrast
            return {{
                background: `hsl(220, 8%, ${{lightness}}%)`, // Very subtle blue-gray, low saturation
                color: lightness > 60 ? '#2c3e50' : '#ffffff', // High contrast text
                borderColor: lightness > 60 ? '#2c5f76' : 'rgba(255,255,255,0.4)'
            }};
        }}

        renderSortingCards() {{
            this.createPositionSlots();
            this.renderAvailableCards();
        }}
        
        createPositionSlots() {{
            const slotsContainer = document.getElementById('position-slots');
            if (!slotsContainer) return;
            
            slotsContainer.innerHTML = '';
            this.placedCards = new Array(this.selectedCount).fill(null);
            
            // Add insert button before the very first position
            const firstInsertBtn = document.createElement('button');
            firstInsertBtn.className = 'insert-button';
            firstInsertBtn.innerHTML = '+';
            firstInsertBtn.dataset.insertAt = 0;
            firstInsertBtn.addEventListener('click', (e) => this.handleInsertClick(0));
            slotsContainer.appendChild(firstInsertBtn);
            
            for (let i = 0; i < this.selectedCount; i++) {{
                // Add the position slot
                const slot = document.createElement('div');
                slot.className = 'position-slot';
                slot.dataset.position = i;
                
                // Apply gradient to entire slot background
                const style = this.getSequenceStyle(i, this.selectedCount);
                slot.style.background = style.background;
                slot.style.color = style.color;
                slot.style.borderColor = style.borderColor;
                
                slot.innerHTML = `
                    <div class="slot-label" style="color: ${{style.color}}">${{i === 0 ? 'Smallest' : i === this.selectedCount - 1 ? 'Largest' : ''}}</div>
                `;
                
                slot.addEventListener('click', (e) => this.handleSlotClick(i));
                slotsContainer.appendChild(slot);
                
                // Add insert button after each position
                const insertBtn = document.createElement('button');
                insertBtn.className = 'insert-button';
                insertBtn.innerHTML = '+';
                insertBtn.dataset.insertAt = i + 1;
                insertBtn.addEventListener('click', (e) => this.handleInsertClick(i + 1));
                slotsContainer.appendChild(insertBtn);
            }}
        }}
        
        renderAvailableCards() {{
            const sortingArea = document.getElementById('sorting-area');
            if (!sortingArea) return;
            
            sortingArea.innerHTML = '';
            
            // Remove duplicates and filter out placed cards
            const uniqueAvailable = this.currentOrder.filter((card, index, arr) => {{
                // Only keep first occurrence of each card number
                const firstIndex = arr.findIndex(c => c.number === card.number);
                if (firstIndex !== index) {{
                    console.warn(`Duplicate card found: ${{card.number}}, removing duplicate`);
                    return false;
                }}
                
                // Skip if already placed
                if (this.placedCards.some(placed => placed && placed.number === card.number)) {{
                    console.warn(`Card ${{card.number}} is both available and placed, removing from available`);
                    return false;
                }}
                
                return true;
            }});
            
            // Update currentOrder to clean version
            this.currentOrder = uniqueAvailable;
            
            this.currentOrder.forEach((card, index) => {{
                const cardEl = document.createElement('div');
                cardEl.className = 'sort-card';
                cardEl.dataset.number = card.number;
                
                // Apply revealed state if numbers were previously revealed
                if (this.numbersRevealed) {{
                    cardEl.classList.add('revealed');
                }}
                
                cardEl.innerHTML = `
                    <div class="revealed-number">${{card.number}}</div>
                    <div class="card-svg">${{card.svg}}</div>
                `;
                
                cardEl.addEventListener('click', (e) => this.handleCardClick(card, cardEl));
                sortingArea.appendChild(cardEl);
            }});
        }}
        
        handleCardClick(card, cardElement) {{
            // Clear any previously selected cards
            document.querySelectorAll('.sort-card.selected').forEach(el => {{
                el.classList.remove('selected');
            }});
            
            // Select this card
            cardElement.classList.add('selected');
            this.selectedCard = card;
            this.selectedCardElement = cardElement;
            
            // Highlight available positions and insert buttons
            document.querySelectorAll('.position-slot').forEach(slot => {{
                if (!slot.classList.contains('filled')) {{
                    slot.classList.add('active');
                }}
            }});
            
            document.querySelectorAll('.insert-button').forEach(btn => {{
                btn.classList.add('active');
            }});
            
            this.updateSortingStatus(`Selected card with value ${{card.number}}. Click a position or + button to place it.`);
        }}
        
        handleInsertClick(insertPosition) {{
            if (!this.selectedCard) {{
                this.updateSortingStatus('Please select a card first, then click where to insert it.');
                return;
            }}
            
            // Handle insertion at the rightmost position (beyond current array bounds)
            if (insertPosition >= this.selectedCount) {{
                // Find the rightmost empty position
                let rightmostEmptyPos = -1;
                for (let i = this.selectedCount - 1; i >= 0; i--) {{
                    if (this.placedCards[i] === null) {{
                        rightmostEmptyPos = i;
                        break;
                    }}
                }}
                
                if (rightmostEmptyPos === -1) {{
                    this.updateSortingStatus('All positions are filled. Move a card first to make room.');
                    return;
                }}
                
                // Place card in the rightmost empty position
                this.placedCards[rightmostEmptyPos] = this.selectedCard;
            }} else {{
                // Create a new array for placed cards
                const newPlacedCards = new Array(this.selectedCount).fill(null);
                
                // Copy existing cards, shifting them as needed
                for (let i = 0; i < this.placedCards.length; i++) {{
                    if (this.placedCards[i] !== null) {{
                        if (i < insertPosition) {{
                            // Cards before insert position stay in same place
                            newPlacedCards[i] = this.placedCards[i];
                        }} else {{
                            // Cards at or after insert position shift right by 1
                            if (i + 1 < this.selectedCount) {{
                                newPlacedCards[i + 1] = this.placedCards[i];
                            }} else {{
                                // Card would fall off - store temporarily, will handle below
                                newPlacedCards[i + 1] = this.placedCards[i];
                            }}
                        }}
                    }}
                }}
                
                // Place the selected card at the insert position
                newPlacedCards[insertPosition] = this.selectedCard;
                
                // Now apply gap-filling logic: shift cards left to compress and eliminate gaps
                const compactedCards = [];
                for (let i = 0; i < newPlacedCards.length; i++) {{
                    if (newPlacedCards[i] !== null) {{
                        compactedCards.push(newPlacedCards[i]);
                    }}
                }}
                
                // If we have more cards than positions, put excess back in available
                if (compactedCards.length > this.selectedCount) {{
                    const excessCards = compactedCards.slice(this.selectedCount);
                    this.currentOrder.push(...excessCards);
                    compactedCards.splice(this.selectedCount);
                }}
                
                // Fill the final array with compacted cards (no gaps)
                const finalPlacedCards = new Array(this.selectedCount).fill(null);
                for (let i = 0; i < compactedCards.length; i++) {{
                    finalPlacedCards[i] = compactedCards[i];
                }}
                
                this.placedCards = finalPlacedCards;
            }}
            
            // Remove card from available cards
            this.currentOrder = this.currentOrder.filter(c => c.number !== this.selectedCard.number);
            
            // Debug: Check total card count
            this.debugCardCount('after insert');
            
            // Clear selection and re-render
            this.clearSelection();
            this.updatePositionSlots();
            this.renderAvailableCards();
            
            // Update status
            const placedCount = this.placedCards.filter(c => c !== null).length;
            if (placedCount === this.selectedCount) {{
                this.updateSortingStatus('All cards placed! Click "Check My Solution" to see how you did.');
            }} else {{
                this.updateSortingStatus(`${{placedCount}}/${{this.selectedCount}} cards placed. Select another card to continue.`);
            }}
        }}
        
        debugCardCount(context) {{
            const placedCount = this.placedCards.filter(c => c !== null).length;
            const availableCount = this.currentOrder.length;
            const totalCount = placedCount + availableCount;
            
            console.log(`DEBUG ${{context}}: Placed=${{placedCount}}, Available=${{availableCount}}, Total=${{totalCount}}, Expected=${{this.selectedCount}}`);
            
            if (totalCount !== this.selectedCount) {{
                console.error('Card count mismatch! Some cards are missing or duplicated.');
                console.log('Placed cards:', this.placedCards.map(c => c ? c.number : 'empty'));
                console.log('Available cards:', this.currentOrder.map(c => c.number));
            }}
        }}
        
        updatePositionSlots() {{
            this.placedCards.forEach((card, position) => {{
                const slot = document.querySelector(`[data-position="${{position}}"]`);
                if (!slot) return;
                
                if (card) {{
                    slot.classList.add('filled');
                    // Reset to white background when filled
                    slot.style.background = '#fff';
                    slot.style.color = '#333';
                    slot.style.borderColor = '#2c5f76';
                    slot.innerHTML = `
                        <div class="slot-card">
                            <div class="card-svg">${{card.svg}}</div>
                        </div>
                        <div class="slot-label">← Click to move back</div>
                    `;
                }} else {{
                    slot.classList.remove('filled');
                    // Apply gradient to empty slot
                    const style = this.getSequenceStyle(position, this.selectedCount);
                    slot.style.background = style.background;
                    slot.style.color = style.color;
                    slot.style.borderColor = style.borderColor;
                    slot.innerHTML = `
                        <div class="slot-label" style="color: ${{style.color}}">${{position === 0 ? 'Smallest' : position === this.selectedCount - 1 ? 'Largest' : ''}}</div>
                    `;
                }}
            }});
        }}
        
        clearSelection() {{
            this.selectedCard = null;
            this.selectedCardElement = null;
            
            // Remove active states
            document.querySelectorAll('.sort-card.selected').forEach(el => {{
                el.classList.remove('selected');
            }});
            document.querySelectorAll('.position-slot.active').forEach(el => {{
                el.classList.remove('active');
            }});
            document.querySelectorAll('.insert-button.active').forEach(el => {{
                el.classList.remove('active');
            }});
        }}
        
        handleSlotClick(position) {{
            const slot = document.querySelector(`[data-position="${{position}}"]`);
            
            // If no card is selected but slot has a card, move it back to available
            if (!this.selectedCard && this.placedCards[position]) {{
                const cardToMove = this.placedCards[position];
                
                // Remove card from this position
                this.placedCards[position] = null;
                
                // Add card back to available cards
                this.currentOrder.push(cardToMove);
                
                // Debug: Check total card count
                this.debugCardCount('after moving card back');
                
                // Update slot appearance
                this.updatePositionSlots();
                this.renderAvailableCards();
                
                // Auto-select the moved card so user can immediately place it elsewhere
                this.selectedCard = cardToMove;
                this.selectedCardElement = document.querySelector(`[data-number="${{cardToMove.number}}"]`);
                if (this.selectedCardElement) {{
                    this.selectedCardElement.classList.add('selected');
                    
                    // Highlight available positions
                    document.querySelectorAll('.position-slot').forEach(slot => {{
                        if (!slot.classList.contains('filled')) {{
                            slot.classList.add('active');
                        }}
                    }});
                    document.querySelectorAll('.insert-button').forEach(btn => {{
                        btn.classList.add('active');
                        btn.classList.remove('disabled');
                    }});
                }}
                
                const placedCount = this.placedCards.filter(c => c !== null).length;
                this.updateSortingStatus(`Moved card ${{cardToMove.number}} back and selected it. ${{placedCount}}/${{this.selectedCount}} cards placed.`);
                return;
            }}
            
            if (!this.selectedCard) {{
                this.updateSortingStatus('Select a card first, or click a placed card to move it back.');
                return;
            }}
            
            // If slot is already filled, replace the card
            if (this.placedCards[position]) {{
                // Move the previous card back to available area
                this.currentOrder.push(this.placedCards[position]);
            }}
            
            // Place the selected card in this position
            this.placedCards[position] = this.selectedCard;
            
            // Remove card from current order (available cards)
            this.currentOrder = this.currentOrder.filter(c => c.number !== this.selectedCard.number);
            
            // Debug: Check total card count
            this.debugCardCount('after regular placement');
            
            // Update slot appearance
            slot.classList.add('filled');
            // Reset to white background when filled
            slot.style.background = '#fff';
            slot.style.color = '#333';
            slot.style.borderColor = '#2c5f76';
            slot.innerHTML = `
                <div class="slot-card">
                    <div class="card-svg">${{this.selectedCard.svg}}</div>
                </div>
                <div class="slot-label">← Click to move back</div>
            `;
            
            // Clear selection and re-render
            this.clearSelection();
            this.renderAvailableCards();
            
            // Update status
            const placedCount = this.placedCards.filter(c => c !== null).length;
            if (placedCount === this.selectedCount) {{
                this.updateSortingStatus('All cards placed! Click "Check My Solution" to see how you did.');
            }} else {{
                this.updateSortingStatus(`${{placedCount}}/${{this.selectedCount}} cards placed. Select another card to continue.`);
            }}
        }}
        
        handleDragEnd(e) {{
            if (this.previewOrder.length > 0) {{
                // Commit the preview order to the actual order
                this.currentOrder = [...this.previewOrder];
            }}
            
            // Clean up
            this.resetDragState();
            
            // Re-render with final positions
            this.renderSortingCards();
            
            // Add success animation
            setTimeout(() => {{
                document.querySelectorAll('.sort-card').forEach(card => {{
                    card.classList.add('success');
                    setTimeout(() => card.classList.remove('success'), 600);
                }});
            }}, 100);
        }}
        
        handleDragOver(e) {{
            if (e.preventDefault) e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            // Calculate where to insert based on mouse position
            const insertIndex = this.calculateInsertIndex(e.clientX, e.clientY);
            console.log('DragOver - insertIndex:', insertIndex, 'lastInsertIndex:', this.lastInsertIndex);
            if (insertIndex !== -1 && insertIndex !== this.lastInsertIndex) {{
                console.log('Calling updatePreviewOrder with insertIndex:', insertIndex);
                this.updatePreviewOrder(insertIndex);
            }}
            
            return false;
        }}
        
        handleDragEnter(e) {{
            // Handle drag enter for the sorting area
        }}
        
        handleDragLeave(e) {{
            // Handle drag leave
        }}
        
        handleDrop(e) {{
            if (e.stopPropagation) e.stopPropagation();
            // The preview order is already set, just let dragEnd handle the commit
            return false;
        }}
        
        calculateInsertIndex(clientX, clientY) {{
            const sortingArea = document.getElementById('sorting-area');
            const cards = Array.from(sortingArea.querySelectorAll('.sort-card:not(.dragging)'));
            
            if (cards.length === 0) return 0;
            
            
            // Simple approach: find which card the mouse is over
            for (let i = 0; i < cards.length; i++) {{
                const card = cards[i];
                const rect = card.getBoundingClientRect();
                
                // Check if mouse is over this card
                if (clientX >= rect.left && clientX <= rect.right && 
                    clientY >= rect.top && clientY <= rect.bottom) {{
                    
                    const cardIndex = parseInt(card.dataset.index);
                    const cardCenterX = rect.left + rect.width / 2;
                    
                    const insertIndex = clientX < cardCenterX ? cardIndex : cardIndex + 1;
                    return insertIndex;
                }}
            }}
            
            return this.currentOrder.length;
        }}
        
        updatePreviewOrder(insertIndex) {{
            if (this.lastInsertIndex === insertIndex) return; // No change needed
            this.lastInsertIndex = insertIndex;
            
            console.log('updatePreviewOrder called with insertIndex:', insertIndex);
            console.log('currentOrder:', this.currentOrder.map(c => c.number));
            console.log('draggedIndex:', this.draggedIndex);
            
            // Create new preview order
            const newOrder = [...this.currentOrder];
            const draggedCard = newOrder.splice(this.draggedIndex, 1)[0];
            
            // Adjust insert index if we removed an item before it
            let adjustedInsertIndex = insertIndex;
            if (this.draggedIndex < insertIndex) {{
                adjustedInsertIndex--;
            }}
            
            // Insert at new position
            newOrder.splice(adjustedInsertIndex, 0, draggedCard);
            this.previewOrder = newOrder;
            
            console.log('New preview order:', this.previewOrder.map(c => c.number));
            
            // Update the visual layout immediately
            this.renderPreview();
        }}
        
        renderPreview() {{
            console.log('renderPreview called');
            const sortingArea = document.getElementById('sorting-area');
            
            // Get all cards except the dragged one
            const cards = Array.from(sortingArea.querySelectorAll('.sort-card:not(.dragging)'));
            console.log('Found cards (excluding dragged):', cards.length);
            
            const draggedNumber = parseInt(this.draggedElement.dataset.number);
            
            // Simply compare the full orders - if they're different, reorder
            const previewNumbers = this.previewOrder.map(c => c.number);
            const currentNumbers = this.currentOrder.map(c => c.number);
            
            console.log('Preview order:', previewNumbers);
            console.log('Current order:', currentNumbers);
            
            // Check if the orders are different
            const needsReorder = !previewNumbers.every((num, index) => currentNumbers[index] === num);
            
            console.log('Needs reorder:', needsReorder);
            
            if (needsReorder) {{
                console.log('Performing reorder...');
                
                // Update currentOrder to match preview (this is key!)
                this.currentOrder = [...this.previewOrder];
                
                // Create a simple reordering without removing cards from DOM
                // Just change their visual order using CSS flexbox order or reinsert in correct order
                
                const previewWithoutDragged = this.previewOrder.filter(card => card.number !== draggedNumber);
                console.log('Cards to reorder:', previewWithoutDragged.map(c => c.number));
                console.log('Available DOM cards:', cards.map(c => parseInt(c.dataset.number)));
                
                // Store references to all current cards
                const cardElements = new Map();
                cards.forEach(card => {{
                    cardElements.set(parseInt(card.dataset.number), card);
                }});
                
                // Reorder by moving each card to the correct position
                previewWithoutDragged.forEach((card, targetIndex) => {{
                    const cardEl = cardElements.get(card.number);
                    console.log('Finding card', card.number, 'found element:', !!cardEl);
                    if (cardEl) {{
                        cardEl.dataset.index = targetIndex;
                        cardEl.querySelector('.card-position').textContent = targetIndex + 1;
                        
                        // Move to correct position in DOM
                        const currentIndex = Array.from(sortingArea.children).indexOf(cardEl);
                        const targetPosition = targetIndex;
                        
                        if (currentIndex !== targetPosition) {{
                            if (targetPosition >= sortingArea.children.length - 1) {{
                                sortingArea.appendChild(cardEl);
                            }} else {{
                                const nextSibling = sortingArea.children[targetPosition];
                                sortingArea.insertBefore(cardEl, nextSibling);
                            }}
                        }}
                    }}
                }});
                
                // Ensure dragged element stays at the end for z-index
                if (this.draggedElement && this.draggedElement.parentNode === sortingArea) {{
                    sortingArea.appendChild(this.draggedElement);
                }}
            }}
        }}
        
        resetDragState() {{
            if (this.draggedElement) {{
                this.draggedElement.classList.remove('dragging');
                this.draggedElement.style.transform = '';
                this.draggedElement.style.position = '';
                this.draggedElement.style.pointerEvents = '';
            }}
            this.isDragging = false;
            this.draggedElement = null;
            this.draggedIndex = -1;
            this.previewOrder = [];
            this.lastInsertIndex = -1;
        }}
        
        // Enhanced touch support for mobile with real-time reordering
        handleTouchStart(e) {{
            const touch = e.touches[0];
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
            this.touchStartElement = e.target.closest('.sort-card');
            this.touchStartIndex = this.touchStartElement ? parseInt(this.touchStartElement.dataset.index) : -1;
            
            if (this.touchStartElement) {{
                this.isDragging = true;
                this.draggedElement = this.touchStartElement;
                this.draggedIndex = this.touchStartIndex;
                this.previewOrder = [...this.currentOrder];
                this.lastInsertIndex = -1;
                
                this.touchStartElement.classList.add('dragging');
                this.createPlaceholder();
            }}
        }}
        
        handleTouchMove(e) {{
            e.preventDefault();
            
            if (this.touchStartElement && this.isDragging) {{
                const touch = e.touches[0];
                
                // Update dragged element position
                const deltaX = touch.clientX - this.touchStartX;
                const deltaY = touch.clientY - this.touchStartY;
                this.touchStartElement.style.transform = `translate(${{deltaX}}px, ${{deltaY}}px) rotate(5deg) scale(1.05)`;
                
                // Calculate insert position and update preview
                const insertIndex = this.calculateInsertIndex(touch.clientX, touch.clientY);
                if (insertIndex !== -1) {{
                    this.updatePreviewOrder(insertIndex);
                }}
            }}
        }}
        
        handleTouchEnd(e) {{
            if (!this.touchStartElement || !this.isDragging) return;
            
            // Commit the preview order
            this.currentOrder = [...this.previewOrder];
            
            // Clean up
            this.touchStartElement.classList.remove('dragging');
            this.touchStartElement.style.transform = '';
            this.removePlaceholder();
            
            this.isDragging = false;
            this.draggedElement = null;
            this.draggedIndex = -1;
            this.previewOrder = [];
            this.lastInsertIndex = -1;
            
            // Re-render final positions
            this.renderSortingCards();
            
            // Success animation
            setTimeout(() => {{
                document.querySelectorAll('.sort-card').forEach(card => {{
                    card.classList.add('success');
                    setTimeout(() => card.classList.remove('success'), 600);
                }});
            }}, 100);
            
            this.touchStartElement = null;
            this.touchStartIndex = -1;
        }}
        
        checkSolution() {{
            if (this.placedCards.some(card => card === null)) {{
                this.updateSortingStatus('Please place all cards before checking your solution.');
                return;
            }}
            
            // Get the sequences for comparison
            const userSequence = this.placedCards.map(card => card.number);
            const correctSequence = this.correctOrder.map(card => card.number);
            
            // Calculate fair score using sequence alignment
            const scoreResult = this.calculateSequenceScore(userSequence, correctSequence);
            
            // Update visual feedback for each position
            this.placedCards.forEach((card, index) => {{
                const slot = document.querySelector(`[data-position="${{index}}"]`);
                const isExactMatch = card.number === this.correctOrder[index].number;
                
                if (isExactMatch) {{
                    slot.classList.add('correct');
                    slot.classList.remove('incorrect');
                }} else {{
                    slot.classList.add('incorrect');
                    slot.classList.remove('correct');
                }}
            }});
            
            this.showAdvancedFeedback(userSequence, correctSequence);
        }}
        
        calculateSequenceScore(userSeq, correctSeq) {{
            // Calculate Longest Common Subsequence (LCS) score
            const lcsLength = this.longestCommonSubsequence(userSeq, correctSeq);
            
            // Calculate how many cards are in correct relative order
            const relativeOrderScore = (lcsLength / correctSeq.length) * 100;
            
            // Calculate exact position matches
            let exactMatches = 0;
            for (let i = 0; i < userSeq.length; i++) {{
                if (userSeq[i] === correctSeq[i]) {{
                    exactMatches++;
                }}
            }}
            const exactScore = (exactMatches / correctSeq.length) * 100;
            
            // Calculate inversion count (how "scrambled" the sequence is)
            const inversions = this.countInversions(userSeq, correctSeq);
            const maxInversions = (correctSeq.length * (correctSeq.length - 1)) / 2;
            const inversionScore = Math.max(0, ((maxInversions - inversions) / maxInversions) * 100);
            
            // Weighted final score: 
            // - 50% for having cards in correct relative order (LCS)
            // - 30% for exact position matches
            // - 20% for overall sequence organization (inversions)
            const finalScore = Math.round(
                (relativeOrderScore * 0.5) + 
                (exactScore * 0.3) + 
                (inversionScore * 0.2)
            );
            
            return {{
                percentage: finalScore,
                exactMatches: exactMatches,
                correctRelativeOrder: lcsLength,
                totalCards: correctSeq.length,
                details: {{
                    relativeOrderScore: Math.round(relativeOrderScore),
                    exactScore: Math.round(exactScore),
                    inversionScore: Math.round(inversionScore),
                    inversions: inversions
                }}
            }};
        }}
        
        longestCommonSubsequence(seq1, seq2) {{
            const m = seq1.length;
            const n = seq2.length;
            const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
            
            for (let i = 1; i <= m; i++) {{
                for (let j = 1; j <= n; j++) {{
                    if (seq1[i - 1] === seq2[j - 1]) {{
                        dp[i][j] = dp[i - 1][j - 1] + 1;
                    }} else {{
                        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                    }}
                }}
            }}
            
            return dp[m][n];
        }}
        
        countInversions(userSeq, correctSeq) {{
            // Create a mapping from value to correct position
            const correctPositions = {{}};
            correctSeq.forEach((val, idx) => {{
                correctPositions[val] = idx;
            }});
            
            // Convert user sequence to "correct position" sequence
            const userCorrectPositions = userSeq.map(val => correctPositions[val]);
            
            // Count inversions in this position sequence
            let inversions = 0;
            for (let i = 0; i < userCorrectPositions.length; i++) {{
                for (let j = i + 1; j < userCorrectPositions.length; j++) {{
                    if (userCorrectPositions[i] > userCorrectPositions[j]) {{
                        inversions++;
                    }}
                }}
            }}
            
            return inversions;
        }}
        
        showAdvancedFeedback(userSeq, correctSeq) {{
            const feedbackEl = document.getElementById('sorting-feedback');
            
            // Calculate advanced scoring metrics
            const lcsLength = this.longestCommonSubsequence(userSeq, correctSeq);
            const relativeOrderScore = (lcsLength / correctSeq.length) * 100;
            
            // Calculate exact position matches
            let exactMatches = 0;
            for (let i = 0; i < Math.min(userSeq.length, correctSeq.length); i++) {{
                if (userSeq[i] === correctSeq[i]) {{
                    exactMatches++;
                }}
            }}
            const exactScore = (exactMatches / correctSeq.length) * 100;
            
            // Calculate inversion score
            const inversions = this.countInversions(userSeq, correctSeq);
            const maxInversions = (correctSeq.length * (correctSeq.length - 1)) / 2;
            const inversionScore = Math.max(0, ((maxInversions - inversions) / maxInversions) * 100);
            
            // Weighted final score
            const finalScore = Math.round(
                (relativeOrderScore * 0.5) + 
                (exactScore * 0.3) + 
                (inversionScore * 0.2)
            );
            
            const isPerfect = finalScore === 100;
            
            let feedbackClass, message;
            
            if (isPerfect) {{
                feedbackClass = 'feedback-perfect';
                message = '🎉 Perfect! All cards in correct order!';
            }} else if (finalScore >= 80) {{
                feedbackClass = 'feedback-good';
                message = '👍 Excellent! Very close to perfect!';
            }} else if (finalScore >= 60) {{
                feedbackClass = 'feedback-good';
                message = '👍 Good job! You understand the pattern!';
            }} else {{
                feedbackClass = 'feedback-needs-work';
                message = '💪 Keep practicing! Focus on reading each abacus carefully.';
            }}
            
            // Show score in modal instead of inline
            this.showScoreModal({{
                finalScore,
                message,
                relativeOrderScore,
                exactScore,
                inversionScore,
                lcsLength,
                correctSeq,
                exactMatches,
                feedbackClass,
                elapsedTime: this.getElapsedTime()
            }});
            
            // Keep inline feedback hidden
            feedbackEl.style.display = 'none';
            
            this.updateSortingStatus(isPerfect ? 'Perfect solution!' : `${{finalScore}}% score`);
        }}
        
        revealNumbers() {{
            // Track revealed state
            this.numbersRevealed = true;
            
            document.querySelectorAll('.sort-card').forEach(card => {{
                card.classList.add('revealed');
            }});
            
            document.getElementById('reveal-numbers').style.display = 'none';
            this.updateSortingStatus('Numbers revealed - now you can see the correct order!');
        }}
        
        startTimer() {{
            this.startTime = Date.now();
            this.timerInterval = setInterval(() => {{
                const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                document.getElementById('sorting-timer').textContent = 
                    `${{minutes}}:${{seconds.toString().padStart(2, '0')}}`;
            }}, 1000);
        }}
        
        stopTimer() {{
            if (this.timerInterval) {{
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }}
        }}
        
        getElapsedTime() {{
            if (this.startTime) {{
                return Math.floor((Date.now() - this.startTime) / 1000);
            }}
            return 0;
        }}
        
        showScoreModal(scoreData) {{
            const {{ 
                finalScore, message, relativeOrderScore, exactScore, inversionScore,
                lcsLength, correctSeq, exactMatches, feedbackClass, elapsedTime 
            }} = scoreData;
            
            const minutes = Math.floor(elapsedTime / 60);
            const seconds = elapsedTime % 60;
            const timeDisplay = `${{minutes}}:${{seconds.toString().padStart(2, '0')}}`;
            
            document.getElementById('score-modal-body').innerHTML = `
                <div class="feedback-score">${{finalScore}}%</div>
                <div class="feedback-message">${{message}}</div>
                <div class="feedback-time">⏱️ Time: ${{timeDisplay}}</div>
                <div class="feedback-breakdown">
                    <div class="score-component">
                        <span class="component-label">Sequence Order:</span>
                        <span class="component-score">${{Math.round(relativeOrderScore)}}%</span>
                        <span class="component-weight">(50% weight)</span>
                    </div>
                    <div class="score-component">
                        <span class="component-label">Exact Positions:</span>
                        <span class="component-score">${{Math.round(exactScore)}}%</span>
                        <span class="component-weight">(30% weight)</span>
                    </div>
                    <div class="score-component">
                        <span class="component-label">Organization:</span>
                        <span class="component-score">${{Math.round(inversionScore)}}%</span>
                        <span class="component-weight">(20% weight)</span>
                    </div>
                </div>
                <div class="feedback-details">
                    Cards in correct order: ${{lcsLength}}/${{correctSeq.length}} • 
                    Exact position matches: ${{exactMatches}}/${{correctSeq.length}}
                </div>
            `;
            
            document.getElementById('score-modal').style.display = 'flex';
        }}
        
        hideScoreModal() {{
            document.getElementById('score-modal').style.display = 'none';
        }}

        endSorting() {{
            // End the current sorting and return to configuration
            this.resetSorting();
        }}
        
        resetSorting() {{
            // Reset state
            this.currentOrder = [];
            this.correctOrder = [];
            this.placedCards = [];
            this.selectedCard = null;
            this.selectedCardElement = null;
            
            // Clear feedback
            document.getElementById('sorting-feedback').style.display = 'none';
            
            // Hide game and sticky header, show configuration controls
            document.getElementById('sorting-game').style.display = 'none';
            document.getElementById('sorting-header').style.display = 'none';
            document.querySelector('.sorting-controls').style.display = 'block';
            
            // Stop timer
            this.stopTimer();
            
            // Reset buttons
            document.getElementById('start-sorting').style.display = 'inline-block';
            document.querySelector('.sorting-game-actions').style.display = 'none';
        }}
        
        newChallenge() {{
            // Reset state but stay in game mode
            this.currentOrder = [];
            this.correctOrder = [];
            this.placedCards = [];
            this.selectedCard = null;
            this.selectedCardElement = null;
            this.numbersRevealed = false;
            
            // Clear feedback
            document.getElementById('sorting-feedback').style.display = 'none';
            
            // Clear card states
            document.querySelectorAll('.sort-card').forEach(card => {{
                card.classList.remove('correct', 'incorrect', 'revealed');
            }});
            
            // Start a new challenge (keeping game mode active)
            this.startSorting();
        }}
        
        updateSortingStatus(message) {{
            document.getElementById('sorting-status').textContent = message;
        }}
    }}
    
    // Initialize quiz and sorting when DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {{
        new ModalManager();
        new SorobanQuiz();
        new SortingChallenge();
    }});
    </script>
</body>
</html>'''
    
    # Fill template
    html_content = html_template.format(
        font_family=config.get('font_family', 'DejaVu Sans').replace('"', ''),
        font_size=font_size,
        numeral_color=get_numeral_color(numbers[0] if numbers else 0, config),
        cards_html=''.join(cards_html),
        color_scheme_description=color_scheme_description,
        bead_shape=config.get('bead_shape', 'diamond').capitalize(),
        card_count=len(numbers),
        number_range=f"{min(numbers)} - {max(numbers)}" if numbers else "0"
    )
    
    # Write HTML file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"Generated web flashcards: {output_path}")
    return output_path