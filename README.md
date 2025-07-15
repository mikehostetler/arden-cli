# Arden CLI

A powerful command-line tool for sending AI agent telemetry and logs to the Arden Stats API. Built with TypeScript and designed for seamless integration with AI coding assistants, with **Claude Code hooks** as the primary integration strategy.

## 🚀 Features

- **🎯 Claude Code Integration**: Primary integration strategy with built-in hooks for automatic usage tracking
- **Agent Telemetry**: Send structured telemetry events to the Arden Stats API
- **Batch Processing**: Handle multiple events efficiently with automatic chunking
- **Flexible Data Input**: Support for JSON, files, stdin, and key-value pairs
- **Robust Error Handling**: Comprehensive validation and retry logic
- **Development-Friendly**: Pretty logging and debug modes

## 📦 Installation

```bash
npm i -g arden
```

## 🎯 Usage

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

## 🎯 Claude Code Integration (Primary Integration)

The **recommended and primary way** to integrate with Arden is through Claude Code hooks. This provides automatic usage tracking when Claude completes coding tasks in your projects.

### Why Claude Code Integration?

- **Automatic Tracking**: No manual event submission required
- **Session-Based Metrics**: Captures complete coding sessions with Claude
- **Rich Context**: Includes session ID, transcript path, and completion data
- **Zero Friction**: Works seamlessly with your existing Claude workflows

### Setting up Claude Code Hooks

1. **Install the Arden CLI** globally:
   ```bash
   npm i -g arden
   ```

2. **Configure Claude Code hooks** in your `~/.claude/settings.json`:
   ```json
   {
     "hooks": {
       "Stop": "arden claude Stop"
     }
   }
   ```

3. **Usage events are automatically tracked** when Claude completes tasks and stops

### How It Works

When Claude Code finishes a session, it triggers the `Stop` hook which:
- Receives session data (session_id, transcript_path, etc.) via stdin
- Automatically sends a usage event to Arden with agent ID `A-CLAUDECODE`  
- Tracks your Claude coding sessions without any manual intervention

The `arden claude Stop` command is designed **exclusively for use within Claude Code hooks** and accepts the standard Claude hook data format as documented in the [Claude Code hooks documentation](https://docs.anthropic.com/en/docs/claude-code/hooks).

### Testing Your Setup

```bash
# Test the hook configuration (for debugging only)
echo '{"session_id": "test123", "hook_event_name": "Stop"}' | arden claude Stop --dry-run

# Check if events are being sent
arden agents list | grep A-CLAUDECODE
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

## 🔗 Quick Start with Claude Code

1. **Install Arden CLI**: `npm i -g arden`
2. **Add Stop hook** to your `~/.claude/settings.json`:
   ```json
   {
     "hooks": {
       "Stop": "arden claude Stop"
     }
   }
   ```
3. **Start coding** - usage is automatically tracked when Claude completes tasks!

Each completed Claude session sends an event to Arden with agent ID `A-CLAUDECODE`, allowing you to track your Claude usage seamlessly.

## 🔧 Configuration

The CLI uses environment variables for configuration:

```bash
# Optional - for dedicated user stats tracking
export ARDEN_API_TOKEN="your-bearer-token"

# Optional configuration
export HOST="https://ardenstats.com"
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
# Test with agents list (should show A-CLAUDECODE if events were sent)
bun run dev agents list --limit 5

# Test agents leaderboard (A-CLAUDECODE should appear after Claude sessions)
bun run dev agents leaderboard --period today --mode simulated

# Test users leaderboard
bun run dev users leaderboard --mode simulated

# Test Claude hook command (for debugging)
echo '{"session_id": "test123", "hook_event_name": "Stop"}' | bun run dev claude Stop --dry-run
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
