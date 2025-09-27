#!/usr/bin/env python3
"""
Simple script to generate the complete Soroban flashcards website with all games.

This script generates a comprehensive HTML file containing:
- An abacus guide
- Four interactive games:
  1. Speed Memory Quiz - Flash cards test visual memory
  2. Speed Complement Race - Lightning-fast arithmetic with train racing
  3. Matching Pairs - Memory card matching game
  4. Card Sorting Challenge - Drag and drop sorting

Usage:
    python3 generate_complete_games_website.py

This will create a file called 'complete_soroban_games.html' with all the games.
"""

import sys
import os
import shutil
from pathlib import Path

# Add the packages/core/src directory to Python path
core_src = Path(__file__).parent / 'packages' / 'core' / 'src'
sys.path.insert(0, str(core_src))

def main():
    """Generate the complete games website."""
    print("🎮 Generating Complete Soroban Games Website...")
    print("   This includes an abacus guide + 4 interactive games!")

    try:
        # Import the web generator
        from web_generator import generate_web_flashcards

        # Configuration for the website
        config = {
            'color_scheme': 'place-value',  # Colorful and educational
            'color_palette': 'default',
            'bead_shape': 'diamond',       # Realistic looking
            'font_family': 'DejaVu Sans',
            'font_size': '48pt',
            'colored_numerals': True,      # Make numbers colorful too
            'show_empty_columns': False,
            'hide_inactive_beads': False,
            'columns': 'auto',
            'transparent': False,
            'card_width': '3.5in',
            'card_height': '2.5in',
            'scale_factor': 0.9
        }

        # Generate a good range of numbers for practicing
        # Include single digits, teens, and some larger numbers
        numbers = list(range(0, 100)) + [123, 456, 789, 1000, 2500, 5000]

        # Output file
        output_file = Path('complete_soroban_games.html')

        print(f"📝 Generating website with {len(numbers)} flashcards...")
        print(f"🎯 Games included:")
        print("   1. Speed Memory Quiz - Test your visual memory")
        print("   2. Speed Complement Race - Racing trains & arithmetic")
        print("   3. Matching Pairs - Memory tile matching")
        print("   4. Card Sorting Challenge - Drag & drop sorting")

        # Generate the complete website
        result_path = generate_web_flashcards(numbers, config, output_file)

        print(f"\n✅ SUCCESS! Generated complete games website:")
        print(f"   📄 File: {result_path}")
        print(f"   🎮 Games: 4 interactive games included")
        print(f"   📚 Guide: Complete abacus learning guide")
        print(f"   🎯 Cards: {len(numbers)} practice flashcards")

        # Get file size for user info
        file_size = result_path.stat().st_size / (1024 * 1024)  # Convert to MB
        print(f"   📏 Size: {file_size:.1f} MB")

        print(f"\n🌟 Open '{result_path}' in your web browser to play!")
        print("   All games work offline - no internet connection needed")

        return str(result_path)

    except ImportError as e:
        print(f"❌ Error importing web generator: {e}")
        print("   Make sure you're running this from the project root directory")
        return None

    except Exception as e:
        print(f"❌ Error generating website: {e}")
        return None

if __name__ == '__main__':
    result = main()
    if result:
        print(f"\n🎉 Complete! Your games website is ready: {result}")
    else:
        print("\n💥 Generation failed. Check the error messages above.")
        sys.exit(1)