#!/bin/bash

# Development startup script for Soroban Flashcard Generator
# This script starts all development services concurrently

set -e

echo "🚀 Starting Soroban Flashcard Generator Development Environment"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Build packages if needed
echo "🔨 Building packages..."
pnpm turbo run build --filter="@soroban/*" --continue

# Generate Panda CSS
echo "🎨 Generating Panda CSS..."
cd apps/web && pnpm panda && cd ../..

# Start development servers
echo "🌟 Starting development servers..."
echo ""
echo "📝 Available endpoints:"
echo "   • Web App: http://localhost:3000"
echo "   • API Health: http://localhost:3000/api/generate"
echo ""

# Use Turborepo to run development in parallel
pnpm turbo run dev --parallel