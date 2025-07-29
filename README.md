# Arden CLI

A command-line tool for tracking AI agent usage and sending telemetry to the Arden Stats API. Supports automatic integration with Claude Code and Amp agents.

## Features

- **Automatic Setup**: Single command configuration for your AI agent environment
- **Claude Code Integration**: Built-in hooks for automatic usage tracking
- **Amp Support**: Native integration with Amp agents
- **Agent Telemetry**: Send structured telemetry events to the Arden Stats API
- **Batch Processing**: Handle multiple events efficiently with automatic chunking
- **Flexible Data Input**: Support for JSON, files, stdin, and key-value pairs
- **Robust Error Handling**: Comprehensive validation and retry logic

## Quick Start

Install the CLI and run setup to configure your system automatically:

```bash
npm install -g arden
arden setup
```

The setup command will:
- Detect Claude Code and Amp agents on your system
- Install Claude hooks if needed (with your permission)
- Guide you through API token configuration
- Verify everything is working correctly

## Installation

### From npm

```bash
npm install -g arden
```

### From GitHub

```bash
# Install directly from GitHub
npm install -g https://github.com/mikehostetler/arden-cli

# Or clone and install locally
git clone https://github.com/mikehostetler/arden-cli
cd arden-cli
npm install
npm run build
npm link
```

## Usage

### Basic Commands

```bash
# Show help
arden --help

# Show version
arden --version
```

### Sending Telemetry Events

#### Single Event

```bash
# Send a simple event
arden events send --agent "A-12345678" --user "01HXXXXXXXXXXXXXXXXXXX" key1=value1 key2=42

# Send event with JSON data
arden events send --agent "A-12345678" --data '{"action": "code_completion", "tokens": 150}'

# Send event with file data
arden events send --agent "A-12345678" --data @event.json

# Send event with stdin data
echo '{"action": "debug", "success": true}' | arden events send --agent "A-12345678" --data -
```

#### Batch Events

```bash
# Send multiple events from file
arden events batch events.json

# Send events from stdin
cat events.json | arden events pipe

# Dry run to validate without sending
arden events pipe --dry-run < events.json
```

#### Event Validation

```bash
# Validate event structure
arden events validate --agent "A-12345678" --data '{"test": true}'

# Validate multiple events
arden events validate events.json
```

### Manual Event Submission

For advanced use cases or custom integrations, you can manually submit events:

```bash
# Submit single event
arden events submit --agent "A-12345678" --data '{"action": "custom_task"}'
```

### Agent Management

List and view leaderboards for agents:

```bash
# List all agents
arden agents list --limit 10

# View agents leaderboard
arden agents leaderboard

# View today's leaderboard with simulated data
arden agents leaderboard --period today --mode simulated

# View 30-day leaderboard with real data
arden agents leaderboard --period 30d --mode real

# Get JSON output
arden agents leaderboard --json
```

### User Management

View user leaderboards:

```bash
# View users leaderboard
arden users leaderboard

# View today's user leaderboard
arden users leaderboard --period today --mode simulated

# View 30-day user leaderboard
arden users leaderboard --period 30d --mode real

# Get JSON output
arden users leaderboard --json
```

## Claude Code Integration

Claude Code integration provides automatic usage tracking when Claude completes coding tasks in your projects.

### Automatic Setup

The recommended way to set up Claude integration is using the setup command:

```bash
arden setup
```

This will automatically detect Claude Code and install the necessary hooks with your permission.

### Manual Setup

If you prefer to configure manually:

1. Add the hook to your `~/.claude/settings.json`:
   ```json
   {
     "hooks": {
       "Stop": "arden claude hook Stop"
     }
   }
   ```

2. Usage events are automatically tracked when Claude completes tasks

### How It Works

When Claude Code finishes a session, it triggers the `Stop` hook which:
- Receives session data (session_id, transcript_path, etc.) via stdin
- Automatically sends a usage event to Arden with agent ID `A-CLAUDECODE`  
- Tracks your Claude coding sessions without any manual intervention

### Testing Your Setup

```bash
# Test the hook configuration
echo '{"session_id": "test123", "hook_event_name": "Stop"}' | arden claude hook Stop --dry-run

# Check if events are being sent
arden agents list | grep A-CLAUDECODE
```

## Event Specification

Events follow the Arden Telemetry Protocol v1 with these key fields:

- **agent**: Agent ID (required) - hex string like "A-12345678"
- **user**: User ULID (auto-filled from Bearer token if provided)
- **time**: Unix timestamp in milliseconds (auto-generated if omitted)  
- **bid/mult**: Pricing fields (default: 0)
- **data**: Event payload as flat key-value pairs (≤1024 bytes JSON)

Example event:
```json
{
  "agent": "A-12345678",
  "data": {
    "action": "code_completion",
    "tokens": 150,
    "success": true
  }
}
```

## Configuration

The CLI supports configuration through multiple methods with the following priority:
1. Command-line options (highest priority)
2. Environment variables
3. Settings file (`~/.arden/settings.json`)
4. Default values (lowest priority)

### Environment Variables

All Arden-specific environment variables use the `ARDEN_*` prefix:

```bash
# Core settings
export ARDEN_API_TOKEN="your-bearer-token"     # API authentication token
export ARDEN_USER_ID="your-user-id"            # User ID for tracking
export ARDEN_HOST="https://ardenstats.com"     # API host URL

# CLI preferences  
export ARDEN_LOG_LEVEL="info"                  # debug, info, warn, error
export ARDEN_DEFAULT_FORMAT="table"            # json, table, yaml
export ARDEN_INTERACTIVE="true"                # true, false

# System variables (optional)
export NODE_ENV="development"                   # Node.js environment
```

### Settings File

Use the `arden config` command to view current settings and get configuration guidance:

```bash
# View current settings and configuration help
arden config
```

To modify configuration, edit the settings file directly at `~/.arden/settings.json`:

```json
{
  "api_token": "your-token",
  "user_id": "your-user-id",
  "host": "https://ardenstats.com",
  "default_format": "table",
  "log_level": "info",
  "interactive": true
}
```

### Legacy Environment Variables

⚠️ **Deprecated**: The following legacy environment variables are still supported but will show deprecation warnings:
- `HOST` → Use `ARDEN_HOST` instead
- `LOG_LEVEL` → Use `ARDEN_LOG_LEVEL` instead

You can also create a `.env` file in your project root with these variables.

## Examples

### Development Workflow

```bash
# Set up environment (optional)
export ARDEN_API_TOKEN="your-bearer-token"
export LOG_LEVEL="debug"

# Test connection with agents list
arden agents list --limit 5

# Send development event
arden events send --agent "A-DEV12345" \
  --data '{"event_type": "development", "feature": "new_api"}' \
  status=started \
  duration=3600

# Validate before sending
arden events send --agent "A-DEV12345" --dry-run --print \
  action=code_review \
  files_reviewed=5 \
  issues_found=2
```

### Batch Processing

```bash
# Create events file
cat > events.json << 'EOF'
[
  {
    "agent": "A-12345678",
    "user": "01HXXXXXXXXXXXXXXXXXXX",
    "data": {"action": "start_session"}
  },
  {
    "agent": "A-12345678", 
    "user": "01HXXXXXXXXXXXXXXXXXXX",
    "data": {"action": "code_completion", "tokens": 150}
  }
]
EOF

# Send batch
arden events batch events.json

# Or pipe from stdin
cat events.json | arden events pipe
```

### Integration with Other Tools

```bash
# Log completion events from your editor
echo '{"action": "autocomplete", "language": "typescript"}' | \
  arden events send --agent "A-EDITOR01" --data -

# Track Claude coding session automatically (hooks handle this)
# No manual intervention needed - hooks automatically track usage
```

## Development

### Quick Start for Contributors

```bash
# Clone and setup
git clone https://github.com/mikehostetler/arden-cli.git
cd arden-cli
bun install

# Start development with hot reload
bun run dev

# Or use the traditional Bun mode
bun run dev:bun
```

### Building and Quality

```bash
# Build the project
bun run build

# Run all quality checks (format, lint, test)
bun run quality

# Individual commands
bun run format        # Format code with Prettier
bun run lint          # Check code with ESLint
bun run lint:fix      # Auto-fix linting issues
bun run test          # Run test suite
```

### VS Code Development

This project includes VS Code configuration for optimal development experience:

- **Auto-formatting** on save with Prettier
- **ESLint integration** with auto-fix on save
- **Debug configurations** for CLI and tests
- **Task definitions** for build, test, lint, format
- **Extension recommendations** for best tooling

### Testing

```bash
# Run test suite
bun run test

# Run specific test types
bun run test:unit         # Unit tests only
bun run test:integration  # Integration tests
bun run test:watch        # Watch mode for development

# Test CLI functionality
bun run dev agents list --limit 5
bun run dev agents leaderboard --period today --mode simulated
echo '{"session_id": "test123"}' | bun run dev claude hook Stop --dry-run
```

## Advanced Features

### Global Options

```bash
# Override API host
arden --host "https://custom.api.com" events send --agent "A-12345678" test=true

# Debug mode
LOG_LEVEL=debug arden events send --agent "A-12345678" debug=true
```

### Authentication

Use Bearer token authentication for dedicated user stats tracking:

```bash
# Via environment variable
export ARDEN_API_TOKEN="your-bearer-token"

# Via command line option
arden events send --token "your-bearer-token" --agent "A-12345678" action=test
```

### Error Handling

The CLI provides detailed error messages and proper exit codes:

- **0**: Success
- **1**: General error (validation, network, etc.)
- **401**: Authentication failure
- **400**: Bad request/validation error

### Retry Logic

Automatic retry with exponential backoff for:
- Network timeouts
- Server errors (5xx)
- Transient failures

Client errors (4xx) are not retried.

## Protocol Specification

This CLI implements the **Agent Telemetry Protocol v1**. For detailed specification, see [SPEC.md](SPEC.md).

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

### Quick Contribution Steps

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Follow our [development guidelines](CONTRIBUTING.md)
4. Run quality checks (`bun run quality`)
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style

This project uses automated code formatting and linting:
- **Prettier** for consistent code formatting
- **ESLint** for code quality and import organization
- **TypeScript** strict mode for type safety
- **VS Code** integration for development efficiency

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- GitHub Issues: [Report a bug](https://github.com/mikehostetler/arden-cli/issues)
- Documentation: [SPEC.md](SPEC.md)
- Agent Guide: [AGENT.md](AGENT.md)
