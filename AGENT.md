# Arden CLI Agent Guide

Arden CLI is a tool for sending agent telemetry and logs to the Arden Stats API.

## Build Commands
- `bun run build` - Build the project using tsup
- `bun run dev` - Run in development mode with pretty logging
- `bun run start` - Run the built version
- `bun run clean` - Clean the dist directory
- `bun test` - Run test suite

## Architecture
- **Entry Point**: `src/index.ts` - Main CLI entry using Commander.js
- **Commands**: `src/commands/` - Individual command implementations
- **Utilities**: `src/util/` - Shared utilities (env, logger)
- **Build Target**: Node.js 20+ CommonJS modules via tsup
- **Output**: `dist/` directory with bundled executable

## Configuration System
- **Settings File**: Uses unified `~/.arden/settings.json` for all configuration
- **Priority Order**: CLI options → environment variables → settings file → defaults
- **Core Module**: `src/util/settings.ts` handles all configuration operations
- **Commands**: Use `arden config` to view current settings and get configuration guidance
- **Output**: Use `output.success/info/error` from `src/util/output.ts` for user messages

## Global Options
- **`-H, --host <url>`**: API host URL (available on all commands)
- **Commands access global options**: Use `command.parent?.getOptionValue('host')` in action functions
- **No option overrides**: Individual commands should NOT redefine global options

## Sync State Tracking
- **Settings Integration**: Sync state stored in `~/.arden/settings.json` under `claude_sync` key
- **File Tracking**: Records file path, checksum, last_modified, and events_processed for each synced file
- **Change Detection**: Uses SHA-256 checksums to detect file changes since last sync
- **Incremental Sync**: Skips files that haven't changed since last sync (use `--force` to override)
- **State Functions**: Use `isFileSynced()`, `recordFileSynced()`, and sync state utilities from `../util/settings`

## Code Style
- **TypeScript**: Strict mode enabled with comprehensive type checking
- **Imports**: ES6 imports, utilities from relative paths (`../util/`)
- **Exports**: Named exports for commands, default exports for utilities
- **Configuration**: Use `settings` from `../util/settings` 
- **Output**: Use `output` from `../util/output` for standardized user messages
- **Logging**: Use `logger` from `../util/logger` (pino-based) for diagnostics only
- **Environment**: Use `env` from `../util/env` (znv-based type-safe config)
- **Commands**: Use Commander.js patterns with `.action()` callbacks
- **Error Handling**: Catch CLI errors and log with `logger.error()`
- **Naming**: camelCase for variables/functions, PascalCase for commands
