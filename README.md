# Arden CLI

A command-line interface tool for Arden, built with Bun and TypeScript using tsup for building.

## Installation

Install globally from npm:

```bash
npm install -g arden-cli
```

## Usage

```bash
# Say hello
arden hello

# Say hello with a custom name
arden hello --name "Your Name"

# Get help
arden --help
arden hello --help
```

## Development

```bash
# Install dependencies
bun install

# Run in development mode (with pretty logging)
bun run dev hello

# Build the project
bun run build

# Run the built version
bun run start hello
```

## Configuration

Create a `.env` file in your project root (see `.env.example`):

```bash
# Log level: trace, debug, info, warn, error, fatal
LOG_LEVEL=info

# Node environment
NODE_ENV=development

# Arden API configuration
ARDEN_API_URL=https://api.arden.dev
ARDEN_API_TOKEN=your-token-here
```

## Project Structure

```
src/
├── index.ts            # Main CLI entry point
├── commands/
│   └── hello.ts        # Hello command implementation
└── util/
    ├── env.ts          # Environment variable handling with znv
    └── logger.ts       # Unified logger with pino
```

## Features

- **TypeScript**: Full TypeScript support with strict type checking
- **tsup**: Fast bundling with tsup for optimal build performance
- **Unified Logging**: Structured logging with pino (pretty format in development, JSON in production)
- **Environment Variables**: Type-safe environment variable handling with znv
- **Commander.js**: Robust CLI argument parsing and command structure

## Building and Publishing

```bash
# Clean and build
bun run clean
bun run build

# Publish to npm
npm publish
```

## Logging

The CLI uses pino for structured logging:

- **Development**: Pretty formatted logs with colors and timestamps
- **Production**: JSON formatted logs for structured processing
- **Debug mode**: Set `LOG_LEVEL=debug` to see detailed debug information
