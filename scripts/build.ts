#!/usr/bin/env bun
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Read the package.json to get the current version
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

// Get the short commit SHA
let commitSha = 'unknown';
try {
  commitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch (error) {
  console.warn('Could not get git commit SHA:', (error as Error).message);
}

console.log(`Building with version: ${version} (commit: ${commitSha})`);

// Read the current tsup config
const tsupConfig = packageJson.tsup;

// Update the define to include the current version and commit SHA
tsupConfig.define = {
  __VERSION__: `"${version}"`,
  __COMMIT_SHA__: `"${commitSha}"`,
};

// Write the updated package.json temporarily
const originalPackageJson = readFileSync(packageJsonPath, 'utf-8');
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

try {
  // Run tsup build
  execSync('npx tsup', { stdio: 'inherit' });
  console.log(`✅ Build completed with version ${version}`);
} finally {
  // Restore original package.json
  writeFileSync(packageJsonPath, originalPackageJson);
}
