# Arden CLI

A powerful command-line tool for sending AI agent telemetry and logs to the Arden Stats API. Built with TypeScript and designed for seamless integration with AI coding assistants like Claude and Amp.

## 🚀 Features

- **Agent Telemetry**: Send structured telemetry events to the Arden Stats API
- **Batch Processing**: Handle multiple events efficiently with automatic chunking
- **Claude Integration**: Built-in hooks for Claude Code integration
- **Amp Integration**: Import and process Amp file change data
- **Flexible Data Input**: Support for JSON, files, stdin, and key-value pairs
- **Robust Error Handling**: Comprehensive validation and retry logic
- **Development-Friendly**: Pretty logging and debug modes

## 📦 Installation

```bash
npm install -g @arden/cli
```

## 🎯 Usage

### Basic Commands

```bash
# Show help
arden --help

# Test the CLI
arden hello --name "Developer"

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

### Claude Integration

The CLI includes built-in support for Claude Code hooks:

```bash
# Handle Claude hooks (used internally)
arden claude PreToolUse --dry-run
arden claude PostToolUse --print
```

### Amp Integration

Import Amp file changes into Arden Stats:

```bash
# Import all Amp threads
arden amp import

# Import specific thread
arden amp import --thread "T-12345678-abcd-efgh-ijkl-mnopqrstuvwx"

# Dry run to see what would be imported
arden amp import --dry-run

# Import changes since specific date
arden amp import --since "2024-01-01T00:00:00Z"
```

## 📊 Event Specification

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

## 🔗 Claude Integration Setup

Configure Claude Code to send telemetry when agents stop:

1. Add this to your Claude hooks configuration:
```json
{
  "Stop": "arden claude Stop"
}
```

2. The CLI will automatically capture and send agent stop events to Arden Stats

3. Optional: Set up additional hooks for other events:
```json
{
  "Stop": "arden claude Stop",
  "SubagentStop": "arden claude SubagentStop"
}
```

## 🔧 Configuration

The CLI uses environment variables for configuration:

```bash
# Optional - for dedicated user stats tracking
export ARDEN_API_TOKEN="your-bearer-token"

# Optional configuration
export HOST="https://ardenstats.com/api/v1"
export LOG_LEVEL="info"  # debug, info, warn, error
export NODE_ENV="development"
```

You can also create a `.env` file in your project root with these variables.

## 📝 Examples

### Development Workflow

```bash
# Set up environment (optional)
export ARDEN_API_TOKEN="your-bearer-token"
export LOG_LEVEL="debug"

# Test connection
arden hello --name "$(whoami)"

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

# Process Amp changes after coding session
arden amp import --since "$(date -u -d '1 hour ago' '+%Y-%m-%dT%H:%M:%SZ')"
```

## 🔧 Development

### Building

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Clean build artifacts
npm run clean
```

### Testing

```bash
# Test with hello command
bun run dev hello --name "Test"

# Test event sending (dry run)
bun run dev events send --agent "A-TEST123" --dry-run --print action=test
```

## 🌟 Advanced Features

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

## 📚 Protocol Specification

This CLI implements the **Agent Telemetry Protocol v1**. For detailed specification, see [SPEC.md](SPEC.md).

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 📞 Support

For issues and questions:
- GitHub Issues: [Report a bug](https://github.com/mikehostetler/arden-cli/issues)
- Documentation: [SPEC.md](SPEC.md)
- Agent Guide: [AGENT.md](AGENT.md)
