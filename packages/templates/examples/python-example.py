#!/usr/bin/env python3

"""
Python Example: Using soroban_templates

This example demonstrates how to use the templates package
in a Python environment to generate soroban content.
"""

import sys
import os
import subprocess
from pathlib import Path

# Add the parent directory to the path for importing templates
sys.path.insert(0, str(Path(__file__).parent.parent))

from __init__ import (
    FLASHCARDS_TEMPLATE,
    SINGLE_CARD_TEMPLATE,
    get_template_path,
    verify_templates
)

def main():
    print("🐍 Python Example: soroban_templates\n")

    # Example 1: Direct template access
    print("🎯 Example 1: Direct Template Access")
    print("====================================")
    print(f"FLASHCARDS_TEMPLATE: {FLASHCARDS_TEMPLATE}")
    print(f"SINGLE_CARD_TEMPLATE: {SINGLE_CARD_TEMPLATE}")

    # Verify files exist
    flashcards_exists = Path(FLASHCARDS_TEMPLATE).exists()
    single_card_exists = Path(SINGLE_CARD_TEMPLATE).exists()

    print("Files exist:")
    print(f"  flashcards.typ: {'✅' if flashcards_exists else '❌'}")
    print(f"  single-card.typ: {'✅' if single_card_exists else '❌'}")

    # Example 2: Dynamic path resolution
    print("\n🔧 Example 2: Dynamic Path Resolution")
    print("====================================")
    try:
        dynamic_flashcards = get_template_path('flashcards.typ')
        dynamic_single_card = get_template_path('single-card.typ')

        print("Dynamic paths:")
        print(f"  flashcards.typ: {dynamic_flashcards}")
        print(f"  single-card.typ: {dynamic_single_card}")
    except Exception as error:
        print(f"❌ Error: {error}")

    # Example 3: Template verification
    print("\n🔍 Example 3: Template Verification")
    print("==================================")
    try:
        verification_result = verify_templates()
        print(f"Template verification: {'✅ Passed' if verification_result else '❌ Failed'}")
    except Exception as error:
        print(f"❌ Verification error: {error}")

    # Example 4: Loading template content
    print("\n📄 Example 4: Loading Template Content")
    print("=====================================")
    if flashcards_exists:
        with open(FLASHCARDS_TEMPLATE, 'r', encoding='utf-8') as f:
            content = f.read()

        lines = content.splitlines()
        print(f"Template loaded: {len(lines)} lines, {len(content)} characters")

        print("First few lines:")
        for i, line in enumerate(lines[:3], 1):
            display_line = line[:80] + ('...' if len(line) > 80 else '')
            print(f"  {i}: {display_line}")

        # Check for key functions
        has_draw = 'draw-soroban' in content
        has_colors = 'color-scheme' in content
        print("\nFunction analysis:")
        print(f"  Contains draw-soroban: {'✅' if has_draw else '❌'}")
        print(f"  Supports color schemes: {'✅' if has_colors else '❌'}")

    # Example 5: Simulated CLI usage
    print("\n⚡ Example 5: Simulated CLI Usage")
    print("================================")

    def simulate_typst_compilation(number: int, output_file: str) -> dict:
        """Simulate using typst CLI with the templates"""
        try:
            template_path = get_template_path('flashcards.typ')

            # In a real scenario, you'd run this command:
            mock_cmd = [
                'typst', 'compile',
                '--input', f'number={number}',
                template_path,
                output_file
            ]

            print(f"  Would run: {' '.join(mock_cmd)}")

            # Simulate successful compilation
            return {
                'success': True,
                'number': number,
                'output': output_file,
                'template_used': template_path
            }
        except Exception as error:
            return {
                'success': False,
                'error': str(error)
            }

    test_numbers = [123, 4567, 1000]
    for num in test_numbers:
        result = simulate_typst_compilation(num, f'soroban_{num}.pdf')
        if result['success']:
            print(f"✅ Number {num}: Simulation successful")
        else:
            print(f"❌ Number {num}: Failed - {result['error']}")

    # Example 6: Batch processing simulation
    print("\n📦 Example 6: Batch Processing Simulation")
    print("========================================")

    def batch_generate_cards(numbers: list, template_type: str = 'flashcards'):
        """Simulate batch generation of flashcards"""
        results = []

        try:
            template_file = 'flashcards.typ' if template_type == 'flashcards' else 'single-card.typ'
            template_path = get_template_path(template_file)

            print(f"Using template: {template_file}")
            print(f"Template path: {template_path}")

            for num in numbers:
                # Simulate processing
                result = {
                    'number': num,
                    'template': template_type,
                    'success': True,
                    'output_size': f"{num * 2}KB"  # Mock file size
                }
                results.append(result)
                print(f"  ✅ Processed {num} -> {result['output_size']}")

            return results
        except Exception as error:
            print(f"❌ Batch processing failed: {error}")
            return []

    batch_numbers = [100, 200, 300, 400, 500]
    batch_results = batch_generate_cards(batch_numbers, 'flashcards')
    print(f"Batch processing completed: {len(batch_results)} cards generated")

    # Example 7: Error handling
    print("\n🚨 Example 7: Error Handling")
    print("===========================")
    try:
        bad_path = get_template_path('nonexistent.typ')
        print("❌ This should not print")
    except FileNotFoundError as error:
        print(f"✅ Caught expected error: {error}")

    # Example 8: Integration with pathlib
    print("\n📁 Example 8: Integration with pathlib")
    print("=====================================")
    flashcards_path = Path(FLASHCARDS_TEMPLATE)
    single_card_path = Path(SINGLE_CARD_TEMPLATE)

    print("Path information:")
    print(f"  Flashcards parent: {flashcards_path.parent}")
    print(f"  Flashcards stem: {flashcards_path.stem}")
    print(f"  Flashcards suffix: {flashcards_path.suffix}")
    print(f"  Single card size: {single_card_path.stat().st_size} bytes")
    print(f"  Templates directory: {flashcards_path.parent.name}")

    print("\n🎉 Python examples completed successfully!")

if __name__ == "__main__":
    main()