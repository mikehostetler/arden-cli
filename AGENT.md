# Arden CLI Agent Guide

Arden CLI is a professional command-line tool for sending agent telemetry and logs to the Arden Stats API. Built with TypeScript and Commander.js, it provides a robust interface for AI agent monitoring and analytics.

## Overview

**Type**: Node.js CLI Application
**Framework**: Commander.js with TypeScript
**Target**: Node.js 20+ CommonJS modules
**Package Manager**: Bun (compatible with npm/yarn)
**Build System**: tsup with custom build scripts

## Build Commands
- `bun run build` - Build the project using tsup with version injection
- `bun run dev` - Run in development mode with pretty logging and watch
- `bun run start` - Run the built version from dist/
- `bun run clean` - Clean the dist directory
- `bun test` - Run unit tests
- `bun run test:integration` - Run integration tests (requires build)
- `bun run test:all` - Run all tests including snapshots
- `bun run quality` - Run format check, lint, and tests

## Architecture

### Core Structure
- **Entry Point**: `src/index.ts` - Main CLI entry with Commander.js setup
- **Commands**: `src/commands/` - Individual command implementations and schemas
- **Utilities**: `src/util/` - Shared utilities (env, logger, settings, validation)
- **Output**: `dist/` directory with bundled executable and shebang

### Command Pattern
- Commands use `createCommand()` and `createCommandAction()` from `src/util/command-base.ts`
- Global options are available on all commands via inheritance
- Commands should use `.action(createCommandAction(handler, schema))` for consistency
- Validation schemas in `src/commands/*/schemas.ts` using Zod

## Configuration System

### Settings Management
- **Settings File**: Uses unified `~/.arden/settings.json` for all configuration
- **Priority Order**: CLI options → environment variables → settings file → defaults
- **Core Module**: `src/util/settings.ts` handles all configuration operations
- **Schema**: Validated using Zod with `ArdenSettingsSchema`

### Configuration Commands
- **View**: `arden config` - Display all current configuration
- **Get**: `arden config <key>` - Show specific configuration value
- **Set**: `arden config <key> <value>` - Set configuration value with validation
- **Reset**: `arden config --reset` - Reset to defaults with confirmation prompt
- **List**: `arden config --list` - Same as default view

### Configurable Keys
- `user_id` - Your user ID for event attribution
- `host` - API host URL (default: https://ardenstats.com)
- `log_level` - Log level: debug, info, warn, error (default: info)
- `telemetry_enabled` - Enable error telemetry: true/false (default: true)

### Internal Settings (Not Exposed)
- `claude_sync` - Claude Code sync state tracking
- `amp_sync` - Amp Code sync state tracking
- `updateCheckCache` - Update notification cache
- `default_format`, `interactive` - Legacy settings preserved for compatibility

## Environment Variables

### Configuration Variables
- `ARDEN_HOST` - API host URL
- `ARDEN_USER_ID` - User ID for event attribution
- `ARDEN_API_TOKEN` - API authentication token (legacy, not used)
- `ARDEN_LOG_LEVEL` - Log level (debug, info, warn, error)
- `NODE_ENV` - Environment mode (development, production)

### Telemetry Variables
- `APPSIGNAL_PUSH_API_KEY` - AppSignal API key for error telemetry

### Environment Module
- **Core**: `src/util/env.ts` - Type-safe environment variable handling with znv
- **Functions**: `getEnvHost()`, `getEnvUserId()`, `getEnvLogLevel()`, etc.
- **Validation**: All environment variables are type-checked and validated

## Logging and Output

### Dual Logging System
**Diagnostic Logging**: `logger` from `src/util/logging.ts`
- Based on Signale with configurable log levels
- Use for debugging, internal diagnostics, and error tracking
- Controlled by `log_level` setting (debug, info, warn, error)
- Functions: `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`

**User Output**: `output` from `src/util/logging.ts`
- Clean, user-facing messages without log level formatting
- Use for command results, success messages, and user feedback
- Functions: `output.success()`, `output.error()`, `output.warn()`, `output.info()`, `output.message()`

### Best Practices
- Use `output.*` for user-facing messages and command results
- Use `logger.*` only for diagnostic information and debugging
- Never mix logger and output in the same user-facing workflow
- Log levels are controlled via `arden config log_level <level>` (debug, info, warn, error)

## Telemetry System

### Error Reporting (AppSignal)
- **Module**: `src/util/telemetry.ts`
- **Provider**: AppSignal JavaScript SDK
- **Initialization**: Automatic on CLI startup if telemetry enabled
- **Configuration**: Uses build-time version and Git commit SHA for deploy tracking

### Telemetry Functions
- `initTelemetry()` - Initialize AppSignal with version and revision
- `reportError(error, context?)` - Report errors with rich context including version, platform, etc.
- `stopTelemetry()` - Clean shutdown for graceful exit
- `isTelemetryEnabled()` - Check if telemetry is enabled in settings

### Context Enrichment
Errors are automatically enriched with:
- Application version (injected at build time)
- Git commit SHA (captured during build)
- Platform information (Node.js version, OS)
- Environment (development/production)
- Custom context from calling code

### Privacy
- Telemetry can be disabled via `arden config telemetry_enabled false`
- Only error information and system context is sent
- No user data or command arguments are transmitted

## Global Options

### Available on All Commands
- **`-H, --host <url>`**: API host URL (env: ARDEN_HOST)
- **`-u, --user <user-id>`**: User ID (env: ARDEN_USER_ID)
- **`-y, --yes`**: Assume yes for prompts

### Command Access Pattern
```typescript
// Access global options in command actions
const globalHost = command.parent?.getOptionValue('host');
const config = getResolvedConfig(options); // Merges CLI, env, and file settings
```

### Important Rules
- Individual commands should NOT redefine global options
- Use `getResolvedConfig()` to get final merged configuration
- Global options override environment variables and settings file

## Sync State Tracking

### Purpose
Track incremental sync state for AI agent integrations (Claude Code, Amp Code)

### Storage
- **Location**: `~/.arden/settings.json` under `claude_sync` and `amp_sync` keys
- **Structure**: Records file path, SHA-256 checksum, last_modified, and events_processed

### Functions
- `isFileSynced(path, checksum)` - Check if file changed since last sync
- `recordFileSynced(path, checksum, events)` - Record successful sync
- Similar functions for Amp: `isAmpThreadSynced()`, `recordAmpThreadSynced()`

### Change Detection
- Uses SHA-256 checksums to detect file changes
- Incremental sync: skips unchanged files for performance
- Override with `--force` flag to sync all files

## TUI and Visual Features

### Available Packages (Already Installed)
- **chalk** (^5.4.1) - Terminal string styling and colors
- **inquirer** (^12.8.2) - Interactive command-line prompts
- **cli-progress** (^3.12.0) - Progress bars and indicators
- **ora** (^8.2.0) - Elegant terminal spinners
- **boxen** (^8.0.1) - Create boxes in terminal output
- **signale** (^1.4.0) - Hackable console logger (used for diagnostic logging)

### Usage Patterns
```typescript
// Colors and styling
import chalk from 'chalk';
output.success(chalk.green('✓ Operation completed'));

// Interactive prompts (use for confirmations beyond simple y/n)
import inquirer from 'inquirer';
const answers = await inquirer.prompt([...]);

// Progress bars for long operations
import { SingleBar, Presets } from 'cli-progress';
const bar = new SingleBar({}, Presets.shades_classic);

// Spinners for async operations
import ora from 'ora';
const spinner = ora('Loading...').start();

// Boxed output for important information
import boxen from 'boxen';
console.log(boxen('Important Message', { padding: 1 }));
```

### Visual Guidelines
- Use consistent color scheme: green for success, red for errors, yellow for warnings, cyan for keys/labels
- For command output, prefer direct `console.log` with chalk for clean formatting
- For diagnostic messages, use `output.*` functions 
- Use spinners for network operations and file processing
- Use progress bars for batch operations with known total count
- Box important setup instructions or configuration guidance

### TUI Output Style (Inspired by fly.io CLI)
- **Clean, minimal formatting**: Bold headers, consistent spacing, no excessive decoration
- **Color coding**: Cyan for keys/labels, dim gray for default values, green for success indicators
- **Aligned columns**: Left-align keys with consistent padding (e.g., `key.padEnd(17)`)
- **Simple arrows**: Use `→` for state changes (green for setting, red for reset preview)
- **Direct console output**: Use `console.log(chalk.color('text'))` for command results, not `output.*`
- **Example pattern**:
  ```typescript
  console.log(chalk.bold('Configuration'));
  console.log('');
  console.log(`${chalk.cyan(key.padEnd(17))} ${value}`);
  console.log(`${chalk.cyan(key)} ${chalk.green('→')} ${newValue}`);
  ```

## Code Style and Patterns

### TypeScript Configuration
- **Strict Mode**: Enabled with comprehensive type checking
- **Target**: ES2022 with Node.js 20+ compatibility
- **Module**: CommonJS output for maximum Node.js compatibility

### Import/Export Patterns
- **Imports**: ES6 imports, utilities from relative paths (`../util/`)
- **Exports**: Named exports for commands, default exports for utilities
- **No Barrel Exports**: Import directly from specific files for tree-shaking

### Naming Conventions
- **Variables/Functions**: camelCase (`getUserId`, `configPath`)
- **Types/Interfaces**: PascalCase (`ConfigOptions`, `ArdenSettings`)
- **Constants**: SCREAMING_SNAKE_CASE (`CONFIGURABLE_KEYS`)
- **Files**: kebab-case (`command-base.ts`, `update-checker.ts`)

### Error Handling
- Use try/catch blocks with specific error types
- Report errors via `reportError()` for telemetry
- Log errors with `logger.error()` for diagnostics
- Show user-friendly errors with `output.error()`
- Exit with appropriate codes: 1 (generic), 2 (config), 3 (network)

### Command Structure
```typescript
// Standard command pattern
export const myCommand = createCommand('name', 'description')
  .argument('[arg]', 'Optional argument')
  .option('--flag', 'Command-specific option')
  .action(createCommandAction(runCommand, MyOptionsSchema));

async function runCommand(options: MyOptions, config: ResolvedConfig) {
  // Command implementation
}
```

### Validation and Schemas
- Use Zod for all input validation (`src/commands/*/schemas.ts`)
- Validate early: command options, environment variables, API responses
- Provide clear error messages for validation failures
- Export schema types for TypeScript integration

This comprehensive guide should help developers understand the architecture, patterns, and best practices for working with the Arden CLI codebase.
