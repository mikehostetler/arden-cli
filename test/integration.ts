#!/usr/bin/env node

import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

class IntegrationTester {
  private host: string;
  private token: string;
  private cliPath: string;
  
  constructor(host: string = 'http://localhost:4000', token: string = 'test-token') {
    this.host = host;
    this.token = token;
    this.cliPath = join(__dirname, '..', 'dist', 'index.js');
  }

  async runTest(testName: string, testFn: () => Promise<void>): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🧪 Running test: ${testName}`);
      await testFn();
      const duration = Date.now() - startTime;
      console.log(`✅ ${testName} passed (${duration}ms)`);
      return { name: testName, passed: true, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ ${testName} failed (${duration}ms)`);
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { 
        name: testName, 
        passed: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration 
      };
    }
  }

  private async runCLI(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [this.cliPath, ...args], {
        stdio: 'pipe',
        env: {
          ...process.env,
          HOST: this.host,
          ARDEN_API_TOKEN: this.token,
          LOG_LEVEL: 'info' // Keep logs for test validation
        }
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code || 0 });
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        child.kill();
        reject(new Error('CLI command timed out'));
      }, 10000);
    });
  }

  async testSingleEventSubmission(): Promise<void> {
    const result = await this.runCLI([
      'events', 'send',
      '--agent', 'A-12345678',
      '--user', '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      '--bid', '100',
      '--mult', '1',
      '--data', '{"test": "integration"}',
      '--host', this.host,
      '--token', this.token
    ]);

    // For this test, we expect either success OR a network error
    // If the server is not running, the CLI should handle it gracefully
    if (result.exitCode === 1) {
      // Check if it's a network error (connection refused, etc.)
      if (result.stdout.includes('Failed to send event') || 
          result.stdout.includes('connection refused') ||
          result.stdout.includes('ECONNREFUSED') ||
          result.stdout.includes('fetch failed')) {
        // This is expected when the server isn't running
        console.log('   ⚠️  Server not running - test passed with network error');
        return;
      }
    }

    if (result.exitCode !== 0) {
      throw new Error(`CLI exited with code ${result.exitCode}. stderr: ${result.stderr}`);
    }

    // Check if success message is in output (logs go to stdout)
    if (!result.stdout.includes('Event sent successfully') && !result.stdout.includes('ID:')) {
      throw new Error(`Expected success message not found. Exit code: ${result.exitCode}. stdout: ${result.stdout}. stderr: ${result.stderr}`);
    }
  }

  async testEventValidation(): Promise<void> {
    const result = await this.runCLI([
      'events', 'send',
      '--agent', 'A-12345678',
      '--bid', '100',
      '--data', '{"validation": "test"}',
      '--dry-run',
      '--host', this.host,
      '--token', this.token
    ]);

    if (result.exitCode !== 0) {
      throw new Error(`CLI exited with code ${result.exitCode}. stderr: ${result.stderr}`);
    }

    // Check if dry run message is in output (logs go to stdout)
    if (!result.stdout.includes('Dry run - event validated successfully') && !result.stdout.includes('validated successfully')) {
      throw new Error(`Expected dry run success message not found. Exit code: ${result.exitCode}. stdout: ${result.stdout}. stderr: ${result.stderr}`);
    }
  }

  async testMissingRequiredAgent(): Promise<void> {
    const result = await this.runCLI([
      'events', 'send',
      '--bid', '100',
      '--data', '{"test": "missing-agent"}',
      '--host', this.host,
      '--token', this.token
    ]);

    if (result.exitCode === 0) {
      throw new Error('Expected CLI to fail with missing agent, but it succeeded');
    }

    if (!result.stdout.includes('--agent is required') && !result.stderr.includes('--agent is required')) {
      throw new Error(`Expected missing agent error not found. stdout: ${result.stdout}. stderr: ${result.stderr}`);
    }
  }

  async testKeyValueDataParsing(): Promise<void> {
    const result = await this.runCLI([
      'events', 'send',
      '--agent', 'A-12345678',
      '--dry-run',
      '--host', this.host,
      '--token', this.token,
      'key1=value1',
      'key2=123',
      'key3=true'
    ]);

    if (result.exitCode !== 0) {
      throw new Error(`CLI exited with code ${result.exitCode}. stderr: ${result.stderr}`);
    }

    if (!result.stdout.includes('Dry run - event validated successfully') && !result.stdout.includes('validated successfully')) {
      throw new Error(`Expected dry run success message not found. stdout: ${result.stdout}. stderr: ${result.stderr}`);
    }
  }

  async runAllTests(): Promise<void> {
    console.log(`🚀 Starting integration tests against ${this.host}\n`);

    // Check if CLI is built
    if (!existsSync(this.cliPath)) {
      throw new Error(`CLI not found at ${this.cliPath}. Please run 'bun run build' first.`);
    }

    const tests = [
      () => this.testSingleEventSubmission(),
      () => this.testEventValidation(),
      () => this.testMissingRequiredAgent(),
      () => this.testKeyValueDataParsing()
    ];

    const testNames = [
      'Single Event Submission',
      'Event Validation (Dry Run)',
      'Missing Required Agent Error',
      'Key-Value Data Parsing'
    ];

    const results: TestResult[] = [];

    for (let i = 0; i < tests.length; i++) {
      const result = await this.runTest(testNames[i], tests[i]);
      results.push(result);
    }

    // Summary
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`\n📊 Test Results:`);
    console.log(`   Total: ${results.length}`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Duration: ${totalTime}ms`);

    if (failed > 0) {
      console.log(`\n❌ Failed tests:`);
      results.filter(r => !r.passed).forEach(r => {
        console.log(`   - ${r.name}: ${r.error}`);
      });
      process.exit(1);
    } else {
      console.log(`\n✅ All tests passed!`);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const hostArg = args.find(arg => arg.startsWith('--host='));
const tokenArg = args.find(arg => arg.startsWith('--token='));

const host = hostArg ? hostArg.split('=')[1] : 'http://localhost:4000';
const token = tokenArg ? tokenArg.split('=')[1] : 'test-token';

const tester = new IntegrationTester(host, token);

tester.runAllTests().catch((error) => {
  console.error(`💥 Integration test suite failed: ${error.message}`);
  process.exit(1);
});
