#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

async function runTests() {
  console.log('🧪 Running Arden CLI Unit Tests...\n');
  
  try {
    const testProcess = spawn('bun', ['test', 'test/unit'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ All unit tests passed!');
      } else {
        console.log(`\n❌ Tests failed with exit code ${code}`);
        process.exit(code);
      }
    });
    
  } catch (error) {
    console.error('Failed to run tests:', error.message);
    process.exit(1);
  }
}

runTests();
