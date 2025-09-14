#!/bin/bash

echo "🚀 Setting up Soroban Flashcard Generator Development Environment"
echo ""

# Check for required tools
echo "📋 Checking requirements..."

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is required but not installed. Please install pnpm first."
    echo "   npm install -g pnpm"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

echo "✅ All requirements satisfied"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile=false

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Build core packages
echo "🔨 Building core packages..."

# Build TypeScript client
echo "  Building @soroban/client..."
cd packages/core/client/typescript
pnpm build
cd ../../../../

# Build Node client
echo "  Building @soroban/core..."
cd packages/core/client/node
pnpm build
cd ../../../../

echo "✅ Core packages built"
echo ""

# Build web app dependencies
echo "🎨 Setting up Panda CSS..."
cd apps/web
pnpm build:css --config
cd ../../

echo "✅ Panda CSS configured"
echo ""

# Final verification
echo "🧪 Running type checks..."
pnpm turbo run type-check

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Development environment setup complete!"
    echo ""
    echo "📋 Next steps:"
    echo "   • Run 'pnpm dev' to start development server"
    echo "   • Run 'pnpm build' to build all packages"
    echo "   • Run 'pnpm turbo run dev' to start all services"
    echo ""
else
    echo "⚠️  Setup complete but type checks failed. Review the output above."
fi