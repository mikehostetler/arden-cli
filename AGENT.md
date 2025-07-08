# Arden CLI Agent Guide

Arden CLI is a tool for sending agent telemetry and logs to the Arden Stats API.

## Build Commands
- `bun run build` - Build the project using tsup
- `bun run dev` - Run in development mode with pretty logging
- `bun run start` - Run the built version
- `bun run clean` - Clean the dist directory
- No test commands configured yet

## Architecture
- **Entry Point**: `src/index.ts` - Main CLI entry using Commander.js
- **Commands**: `src/commands/` - Individual command implementations
- **Utilities**: `src/util/` - Shared utilities (env, logger)
- **Build Target**: Node.js 20+ CommonJS modules via tsup
- **Output**: `dist/` directory with bundled executable

## Code Style
- **TypeScript**: Strict mode enabled with comprehensive type checking
- **Imports**: ES6 imports, utilities from relative paths (`../util/`)
- **Exports**: Named exports for commands, default exports for utilities
- **Logging**: Use `logger` from `../util/logger` (pino-based)
- **Environment**: Use `env` from `../util/env` (znv-based type-safe config)
- **Commands**: Use Commander.js patterns with `.action()` callbacks
- **Error Handling**: Catch CLI errors and log with `logger.error()`
- **Naming**: camelCase for variables/functions, PascalCase for commands
