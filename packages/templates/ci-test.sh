#!/bin/bash

# CI Test Script for @soroban/templates
# This script can be run in any CI environment to verify the templates package

set -e  # Exit on any error

echo "🔧 CI Test Script for @soroban/templates"
echo "========================================"

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from the templates package directory"
    exit 1
fi

# Verify package.json has the correct name
PACKAGE_NAME=$(node -p "require('./package.json').name")
if [ "$PACKAGE_NAME" != "@soroban/templates" ]; then
    echo "❌ Error: Wrong package name: $PACKAGE_NAME"
    exit 1
fi

echo "✅ Package name verified: $PACKAGE_NAME"

# Check Node.js version
NODE_VERSION=$(node --version)
echo "📦 Node.js version: $NODE_VERSION"

# Check Python version
PYTHON_VERSION=$(python3 --version 2>/dev/null || echo "Python not available")
echo "🐍 Python version: $PYTHON_VERSION"

# Run package validation
echo ""
echo "📋 Running package validation..."
npm run test:validate

# Run Node.js tests
echo ""
echo "🟨 Running Node.js tests..."
npm run test:node

# Run Python tests (if Python is available)
echo ""
echo "🐍 Running Python tests..."
if command -v python3 &> /dev/null; then
    npm run test:python
else
    echo "⚠️  Python3 not available, skipping Python tests"
fi

# Run integration tests
echo ""
echo "🔗 Running integration tests..."
npm run test:integration

# Verify examples work
echo ""
echo "📚 Testing examples..."
echo "  Testing Node.js example..."
timeout 10 node examples/node-example.js > /dev/null || {
    echo "❌ Node.js example failed"
    exit 1
}

if command -v python3 &> /dev/null; then
    echo "  Testing Python example..."
    timeout 10 python3 examples/python-example.py > /dev/null || {
        echo "❌ Python example failed"
        exit 1
    }
else
    echo "  ⚠️  Skipping Python example (Python3 not available)"
fi

# Check template file integrity
echo ""
echo "🔍 Verifying template file integrity..."

# Check flashcards.typ
if [ -f "flashcards.typ" ]; then
    FLASHCARDS_SIZE=$(wc -c < flashcards.typ)
    FLASHCARDS_LINES=$(wc -l < flashcards.typ)
    echo "  flashcards.typ: $FLASHCARDS_LINES lines, $FLASHCARDS_SIZE bytes"

    if [ $FLASHCARDS_SIZE -lt 1000 ]; then
        echo "❌ flashcards.typ seems too small"
        exit 1
    fi

    if ! grep -q "draw-soroban" flashcards.typ; then
        echo "❌ flashcards.typ missing draw-soroban function"
        exit 1
    fi
else
    echo "❌ flashcards.typ not found"
    exit 1
fi

# Check single-card.typ
if [ -f "single-card.typ" ]; then
    SINGLE_CARD_SIZE=$(wc -c < single-card.typ)
    SINGLE_CARD_LINES=$(wc -l < single-card.typ)
    echo "  single-card.typ: $SINGLE_CARD_LINES lines, $SINGLE_CARD_SIZE bytes"

    if [ $SINGLE_CARD_SIZE -lt 1000 ]; then
        echo "❌ single-card.typ seems too small"
        exit 1
    fi

    if ! grep -q "generate-single-card" single-card.typ; then
        echo "❌ single-card.typ missing generate-single-card function"
        exit 1
    fi
else
    echo "❌ single-card.typ not found"
    exit 1
fi

# Final report
echo ""
echo "🎉 All CI tests passed!"
echo "✅ Package validation: OK"
echo "✅ Node.js tests: OK"
if command -v python3 &> /dev/null; then
    echo "✅ Python tests: OK"
else
    echo "⚠️  Python tests: SKIPPED"
fi
echo "✅ Integration tests: OK"
echo "✅ Examples: OK"
echo "✅ Template integrity: OK"

echo ""
echo "🚀 @soroban/templates is ready for use!"