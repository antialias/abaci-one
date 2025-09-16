#!/usr/bin/env node

/**
 * Package validation test
 * Verifies that all declared package files exist
 */

const fs = require('fs');
const packageJson = require('./package.json');

console.log('📦 Package Validation - @soroban/templates');

try {
  const declaredFiles = packageJson.files || [];

  for (const file of declaredFiles) {
    if (file.includes('*')) {
      // Skip glob patterns - they're handled by npm
      continue;
    }

    if (!fs.existsSync(file)) {
      throw new Error(`Missing declared file: ${file}`);
    }

    console.log(`✓ ${file}`);
  }

  console.log('✅ Package files validated');

} catch (error) {
  console.error('❌ Package validation failed:', error.message);
  process.exit(1);
}