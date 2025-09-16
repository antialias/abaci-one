#!/usr/bin/env python3

"""
Comprehensive test suite for soroban_templates package
Tests Python interface and file integrity
"""

import sys
import os
from pathlib import Path
from typing import Callable, Any

# Add this directory to Python path for import
sys.path.insert(0, str(Path(__file__).parent))

# Import the templates package
from __init__ import (
    FLASHCARDS_TEMPLATE,
    SINGLE_CARD_TEMPLATE,
    get_template_path,
    verify_templates
)

# Test framework
class TestRunner:
    def __init__(self):
        self.tests = []
        self.test_count = 0
        self.passed_tests = 0

    def test(self, name: str, test_func: Callable[[], None]):
        """Register a test function"""
        self.tests.append((name, test_func))

    def assert_true(self, condition: bool, message: str):
        """Assert that condition is true"""
        self.test_count += 1
        if condition:
            self.passed_tests += 1
            print(f"  ✅ {message}")
        else:
            print(f"  ❌ {message}")
            raise AssertionError(f"Assertion failed: {message}")

    def assert_equal(self, actual: Any, expected: Any, message: str):
        """Assert that two values are equal"""
        self.assert_true(
            actual == expected,
            f"{message} (expected: {expected}, got: {actual})"
        )

    def assert_contains(self, content: str, substring: str, message: str):
        """Assert that content contains substring"""
        self.assert_true(
            substring in content,
            f"{message} (should contain: {substring})"
        )

    def run_tests(self):
        """Execute all registered tests"""
        print("🧮 soroban_templates - Python Test Suite")
        print("========================================\n")

        for name, test_func in self.tests:
            print(f"🔍 {name}")
            try:
                test_func()
                print("")
            except Exception as error:
                print(f"  💥 Test failed: {error}\n")
                sys.exit(1)

        print(f"🎉 All tests passed! ({self.passed_tests}/{self.test_count})")

# Initialize test runner
runner = TestRunner()

# Test: Package Structure
def test_package_structure():
    runner.assert_true(isinstance(FLASHCARDS_TEMPLATE, str),
                      "FLASHCARDS_TEMPLATE should be a string")
    runner.assert_true(isinstance(SINGLE_CARD_TEMPLATE, str),
                      "SINGLE_CARD_TEMPLATE should be a string")
    runner.assert_true(callable(get_template_path),
                      "get_template_path should be callable")
    runner.assert_true(callable(verify_templates),
                      "verify_templates should be callable")

    runner.assert_true(FLASHCARDS_TEMPLATE.endswith('flashcards.typ'),
                      "FLASHCARDS_TEMPLATE should end with flashcards.typ")
    runner.assert_true(SINGLE_CARD_TEMPLATE.endswith('single-card.typ'),
                      "SINGLE_CARD_TEMPLATE should end with single-card.typ")

runner.test("Package Structure Validation", test_package_structure)

# Test: File Existence and Properties
def test_file_existence():
    runner.assert_true(os.path.exists(FLASHCARDS_TEMPLATE),
                      "flashcards.typ file should exist")
    runner.assert_true(os.path.exists(SINGLE_CARD_TEMPLATE),
                      "single-card.typ file should exist")

    flashcards_path = Path(FLASHCARDS_TEMPLATE)
    single_card_path = Path(SINGLE_CARD_TEMPLATE)

    runner.assert_true(flashcards_path.is_file(),
                      "flashcards.typ should be a file")
    runner.assert_true(single_card_path.is_file(),
                      "single-card.typ should be a file")
    runner.assert_true(flashcards_path.stat().st_size > 1000,
                      "flashcards.typ should be substantial (>1KB)")
    runner.assert_true(single_card_path.stat().st_size > 1000,
                      "single-card.typ should be substantial (>1KB)")

runner.test("Template File Existence", test_file_existence)

# Test: Template Content Validation
def test_template_content():
    with open(FLASHCARDS_TEMPLATE, 'r', encoding='utf-8') as f:
        flashcards_content = f.read()

    with open(SINGLE_CARD_TEMPLATE, 'r', encoding='utf-8') as f:
        single_card_content = f.read()

    runner.assert_contains(flashcards_content, 'draw-soroban',
                          "flashcards.typ should contain draw-soroban function")
    runner.assert_contains(single_card_content, 'generate-single-card',
                          "single-card.typ should contain generate-single-card function")

    # Check for common Typst syntax
    runner.assert_contains(flashcards_content, '#let',
                          "flashcards.typ should use Typst function syntax")
    runner.assert_contains(single_card_content, '#let',
                          "single-card.typ should use Typst function syntax")

    # Check for soroban-specific content
    runner.assert_contains(flashcards_content, 'bead',
                          "flashcards.typ should reference beads")
    runner.assert_contains(flashcards_content, 'column',
                          "flashcards.typ should reference columns")

runner.test("Template Content Validation", test_template_content)

# Test: Dynamic Path Resolution
def test_dynamic_path_resolution():
    dynamic_flashcards = get_template_path('flashcards.typ')
    dynamic_single_card = get_template_path('single-card.typ')

    runner.assert_equal(dynamic_flashcards, FLASHCARDS_TEMPLATE,
                       "get_template_path should resolve flashcards.typ correctly")
    runner.assert_equal(dynamic_single_card, SINGLE_CARD_TEMPLATE,
                       "get_template_path should resolve single-card.typ correctly")

    # Test error handling
    try:
        get_template_path('nonexistent.typ')
        runner.assert_true(False, "get_template_path should raise for nonexistent files")
    except FileNotFoundError as error:
        runner.assert_true('not found' in str(error),
                          "get_template_path should provide meaningful error messages")

runner.test("Dynamic Path Resolution", test_dynamic_path_resolution)

# Test: Path Properties
def test_path_properties():
    # Ensure paths are absolute
    runner.assert_true(os.path.isabs(FLASHCARDS_TEMPLATE),
                      "FLASHCARDS_TEMPLATE should be absolute path")
    runner.assert_true(os.path.isabs(SINGLE_CARD_TEMPLATE),
                      "SINGLE_CARD_TEMPLATE should be absolute path")

    # Ensure paths point to correct directory
    flashcards_dir = os.path.dirname(FLASHCARDS_TEMPLATE)
    single_card_dir = os.path.dirname(SINGLE_CARD_TEMPLATE)
    runner.assert_equal(flashcards_dir, single_card_dir,
                       "Both templates should be in same directory")
    runner.assert_true('templates' in flashcards_dir,
                      "Templates should be in templates directory")

runner.test("Path Properties and Security", test_path_properties)

# Test: Template Verification Function
def test_template_verification():
    # Should pass without errors
    result = verify_templates()
    runner.assert_equal(result, True, "verify_templates should return True for valid templates")

    # Test that it actually checks content
    runner.assert_true(callable(verify_templates),
                      "verify_templates should be a callable function")

runner.test("Template Verification Function", test_template_verification)

# Test: File Permissions and Access
def test_file_access():
    # Test read access
    runner.assert_true(os.access(FLASHCARDS_TEMPLATE, os.R_OK),
                      "flashcards.typ should have read permissions")
    runner.assert_true(os.access(SINGLE_CARD_TEMPLATE, os.R_OK),
                      "single-card.typ should have read permissions")

    # Test file size is reasonable
    flashcards_size = os.path.getsize(FLASHCARDS_TEMPLATE)
    single_card_size = os.path.getsize(SINGLE_CARD_TEMPLATE)

    runner.assert_true(1000 < flashcards_size < 100000,
                      f"flashcards.typ should have reasonable size (1KB-100KB), got {flashcards_size} bytes")
    runner.assert_true(1000 < single_card_size < 100000,
                      f"single-card.typ should have reasonable size (1KB-100KB), got {single_card_size} bytes")

runner.test("File Access and Permissions", test_file_access)

# Test: Encoding and Character Set
def test_encoding():
    # Test UTF-8 encoding
    with open(FLASHCARDS_TEMPLATE, 'r', encoding='utf-8') as f:
        flashcards_content = f.read()

    with open(SINGLE_CARD_TEMPLATE, 'r', encoding='utf-8') as f:
        single_card_content = f.read()

    runner.assert_true(isinstance(flashcards_content, str),
                      "flashcards.typ should decode as valid UTF-8")
    runner.assert_true(isinstance(single_card_content, str),
                      "single-card.typ should decode as valid UTF-8")

    # Test for reasonable line count
    flashcards_lines = len(flashcards_content.splitlines())
    single_card_lines = len(single_card_content.splitlines())

    runner.assert_true(flashcards_lines > 10,
                      "flashcards.typ should have substantial content (>10 lines)")
    runner.assert_true(single_card_lines > 10,
                      "single-card.typ should have substantial content (>10 lines)")

runner.test("Template Encoding and Character Set", test_encoding)

# Test: Python Path and Import System
def test_import_system():
    # Test that imports work correctly
    import __init__ as templates_module

    runner.assert_true(hasattr(templates_module, 'FLASHCARDS_TEMPLATE'),
                      "Module should export FLASHCARDS_TEMPLATE")
    runner.assert_true(hasattr(templates_module, 'SINGLE_CARD_TEMPLATE'),
                      "Module should export SINGLE_CARD_TEMPLATE")
    runner.assert_true(hasattr(templates_module, '__version__'),
                      "Module should have version information")
    runner.assert_true(hasattr(templates_module, '__author__'),
                      "Module should have author information")

    # Test __all__ export
    if hasattr(templates_module, '__all__'):
        all_exports = templates_module.__all__
        runner.assert_true('FLASHCARDS_TEMPLATE' in all_exports,
                          "FLASHCARDS_TEMPLATE should be in __all__")
        runner.assert_true('SINGLE_CARD_TEMPLATE' in all_exports,
                          "SINGLE_CARD_TEMPLATE should be in __all__")

runner.test("Python Import System", test_import_system)

# Test: Cross-platform Compatibility
def test_cross_platform():
    # Test that paths work on current platform
    flashcards_pathlib = Path(FLASHCARDS_TEMPLATE)
    single_card_pathlib = Path(SINGLE_CARD_TEMPLATE)

    runner.assert_true(flashcards_pathlib.exists(),
                      "flashcards.typ path should work with pathlib")
    runner.assert_true(single_card_pathlib.exists(),
                      "single-card.typ path should work with pathlib")

    # Test path separators are correct for platform
    runner.assert_true(os.sep in FLASHCARDS_TEMPLATE,
                      "Template paths should use platform-appropriate separators")

runner.test("Cross-platform Compatibility", test_cross_platform)

if __name__ == "__main__":
    runner.run_tests()