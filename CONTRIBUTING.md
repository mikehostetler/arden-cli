# Contributing to Arden CLI

Welcome to Arden CLI! We're excited that you're interested in contributing. This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- **Node.js** 18+ or **Bun** 1.0+
- **Git** for version control
- **VS Code** (recommended) with our extension recommendations

### Getting Started

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/arden-cli.git
   cd arden-cli
   ```

2. **Install Dependencies**
   ```bash
   bun install
   ```

3. **Set Up Development Environment**
   ```bash
   # Copy example environment file
   cp .env.example .env
   
   # Install VS Code extensions (if using VS Code)
   code --install-extension esbenp.prettier-vscode
   code --install-extension dbaeumer.vscode-eslint
   ```

4. **Run Development Build**
   ```bash
   # Hot reload development server
   bun run dev
   
   # Or traditional Bun mode
   bun run dev:bun
   ```

## Project Structure

```
arden-cli/
├── src/
│   ├── commands/         # CLI command implementations
│   ├── util/            # Shared utilities (settings, client, etc.)
│   └── index.ts         # Main CLI entry point
├── test/                # Test files
├── scripts/             # Build and utility scripts
├── .vscode/             # VS Code configuration
└── dist/                # Built output (generated)
```

### Key Files

- **`src/index.ts`** - Main CLI entry using Commander.js
- **`src/commands/`** - Individual command implementations
- **`src/util/settings.ts`** - Unified configuration system

- **`src/util/output.ts`** - Standardized user output
- **`src/util/logger.ts`** - Development logging

## Code Style and Standards

### TypeScript Guidelines

- **Strict TypeScript** - All code must pass `tsc --noEmit`
- **Type Safety** - Prefer explicit types over `any`
- **Modern ES6+** - Use modern JavaScript features
- **Functional Style** - Prefer pure functions and immutable data

### Code Formatting

We use **Prettier** and **ESLint** for consistent code formatting:

```bash
# Check formatting
bun run format:check

# Auto-format code
bun run format

# Lint code
bun run lint

# Fix linting issues
bun run lint:fix

# Run all quality checks
bun run quality
```

### Style Rules

- **Single quotes** for strings (except when escaping)
- **Semicolons** always
- **Trailing commas** in ES5-compatible positions
- **2 spaces** for indentation
- **100 character** line length
- **camelCase** for variables and functions
- **PascalCase** for types and classes

### Import Organization

Imports are automatically sorted by ESLint:

```typescript
// 1. Node.js built-ins
import { readFileSync } from 'fs';
import { join } from 'path';

// 2. External packages
import { Command } from 'commander';
import { z } from 'zod';

// 3. Internal utilities (relative imports)
import { settings } from '../util/settings';
import { output } from '../util/output';
```

## Development Workflow

### 1. Making Changes

1. **Create a branch** for your feature/fix
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Write code** following our style guidelines

3. **Add tests** for new functionality
   ```bash
   bun test
   ```

4. **Run quality checks**
   ```bash
   bun run quality
   ```

### 2. Testing

We have several types of tests:

```bash
# Unit tests
bun run test:unit

# Integration tests
bun run test:integration

# Output snapshot tests
bun run test:snapshots

# All tests
bun run test:all

# Watch mode for development
bun run test:watch
```

### 3. Building

```bash
# Clean build
bun run clean && bun run build

# Development build
bun run build

# Test the built CLI
./dist/index.js --help
```

### 4. Debugging

VS Code is configured for debugging:

1. **Debug CLI** - Debug the main CLI with default args
2. **Debug CLI with Args** - Debug with custom arguments
3. **Debug Tests** - Debug specific test files

Set breakpoints and use F5 to start debugging.

## Architecture Guidelines

### Command Structure

Commands should follow this pattern:

```typescript
import { Command } from 'commander';
import { output } from '../util/output';
import { settings } from '../util/settings';

export const myCommand = new Command('my-command')
  .description('Description of what this command does')
  .option('-f, --flag', 'Description of flag')
  .action(async (options) => {
    try {
      // Get global options from parent
      const host = myCommand.parent?.getOptionValue('host');
      
      // Use settings for configuration
      const config = await settings.load();
      
      // Do work...
      
      // Use output for user messages
      output.success('Operation completed');
    } catch (error) {
      output.error(`Failed: ${error.message}`);
      process.exit(1);
    }
  });
```

### Configuration System

- **Priority**: CLI options → env vars → settings file → defaults
- **Use `settings`** from `../util/settings` for all configuration
- **Global options** available via `command.parent?.getOptionValue()`
- **No option overrides** - don't redefine global options in commands

### Output Standards

- **Use `output`** from `../util/output` for all user messages
- **Consistent formatting** - success/info/error/warning
- **JSON support** - respect `--json` flags
- **No direct console.log** except in output utility

### Error Handling

- **Catch CLI errors** and use `output.error()` + `process.exit(1)`
- **Use logger** for development diagnostics only
- **Proper exit codes** - 0=success, 1=error, 401=auth, 400=validation

## Adding New Commands

1. **Create command file** in `src/commands/`
2. **Export command** with descriptive name
3. **Import and register** in `src/index.ts`
4. **Add tests** in `test/`
5. **Update documentation**

Example:

```typescript
// src/commands/my-feature.ts
export const myFeatureCommand = new Command('my-feature')
  .description('New feature description')
  .action(async () => {
    // Implementation
  });

// src/index.ts
import { myFeatureCommand } from './commands/my-feature';
program.addCommand(myFeatureCommand);
```

## Testing Guidelines

### Unit Tests

- **Test individual functions** and utilities
- **Mock external dependencies**
- **Use descriptive test names**

```typescript
import { describe, it, expect } from 'bun:test';
import { myFunction } from '../src/util/my-utility';

describe('myFunction', () => {
  it('should handle valid input correctly', () => {
    const result = myFunction('valid-input');
    expect(result).toBe('expected-output');
  });
});
```

### Integration Tests

- **Test command behavior** end-to-end
- **Mock HTTP requests** using MSW
- **Test error conditions**

### Output Snapshot Tests

- **Test CLI output formatting**
- **Ensure consistent user experience**
- **Update snapshots** when output changes intentionally

## Documentation Standards

### Code Comments

- **Avoid unnecessary comments** - code should be self-documenting
- **Document complex logic** and business rules
- **Use JSDoc** for public APIs

### README Updates

- **Keep examples current** with actual implementation
- **Update feature lists** when adding new commands
- **Test all example commands** before publishing

### Commit Messages

Use conventional commit format:

```
feat: add new leaderboard command
fix: resolve authentication token validation
docs: update contributing guidelines
test: add integration tests for events command
```

## Release Process

1. **Version bump** in `package.json`
2. **Update CHANGELOG.md**
3. **Run full test suite**
4. **Create release PR**
5. **Tag release** after merge

## Common Issues

### Build Failures

```bash
# Clean and rebuild
bun run clean && bun run build

# Check TypeScript errors
bunx tsc --noEmit

# Verify dependencies
bun install
```

### Test Failures

```bash
# Update snapshots if output changed
bun test --update-snapshots

# Run specific test
bun test test/specific.test.ts

# Debug test
bun test --inspect test/specific.test.ts
```

### ESLint/Prettier Conflicts

```bash
# Fix auto-fixable issues
bun run lint:fix

# Format code
bun run format

# Check for remaining issues
bun run quality
```

## Getting Help

- **GitHub Issues** - Report bugs and request features
- **Discord/Slack** - Real-time development chat
- **Code Reviews** - Ask questions in PR reviews
- **Documentation** - Check AGENT.md for additional context

## Code of Conduct

- **Be respectful** and inclusive
- **Provide constructive feedback**
- **Help newcomers** get started
- **Focus on the code** not the person

Thank you for contributing to Arden CLI! 🚀
