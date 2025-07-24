# Arden CLI Command Reference

The Arden CLI (`arden`) is a command-line tool for interacting with the Arden Stats platform, providing telemetry tracking and analytics for AI agents.

## Global Options

These options are available on all commands:

- `-H, --host <url>` - API host URL (default: from settings or environment)
- `--insecure` - Allow connections to untrusted hosts (development only)
- `-V, --version` - Display version number
- `-h, --help` - Display help information

## Command Structure

```
arden [global-options] <command> [command-options] [arguments]
```

## Commands Overview

### 🚀 `init`
**Description:** Initialize Arden CLI for your AI agent environment

**Usage:** `arden init [options]`

**Options:**
- `--yes, -y` - Skip confirmation prompts

**Purpose:** 
- Environment validation and configuration
- Auto-detection of AI agents (Claude Code, Amp)
- Initial authentication setup
- Integration installation (hooks, history import)

---

### ⚡ `amp`
**Description:** Amp Code integration management

**Usage:** `arden amp <subcommand> [options]`

#### Subcommands:

#### `amp sync`
**Description:** Sync Amp threads from file-changes directory to Arden
**Options:**
- `--threads <path>` - Path to file-changes directory (default: ~/file-changes)
- `--yes, -y` - Skip confirmation prompts
- `--force` - Force sync all threads, ignoring cached state

Each thread folder in the file-changes directory is treated as a single event, using the folder creation date as the event timestamp.

---

### 🤖 `claude`
**Description:** Claude Code integration management

**Usage:** `arden claude <subcommand> [options]`

#### Subcommands:

#### `claude init`
**Description:** Initialize Arden hooks into Claude Code settings
**Options:**
- `--settings <path>` - Path to Claude settings.json file
- `--yes, -y` - Skip confirmation prompts

#### `claude sync`
**Description:** Sync Claude Code usage data from local JSONL files to Arden
**Options:**
- `--claude-dir <path>` - Custom path to Claude data directory (default: ~/.claude)
- `--limit <number>` - Limit number of events to process per file (default: 100)
- `--force` - Force sync all files, ignoring cached state

#### `claude hook <hook>` *(internal)*
**Description:** Handle Claude Code runtime hooks
**Arguments:**
- `<hook>` - Hook type (PreToolUse, PostToolUse, Notification, Stop, SubagentStop)
**Options:**
- `--print` - Print enriched payload to stdout

---

### 🚀 `amp`
**Description:** Amp thread synchronization and integration management

**Usage:** `arden amp <subcommand> [options]`

#### Subcommands:

#### `amp sync`
**Description:** Sync Amp thread data from file-changes directory to Arden
**Options:**
- `--threads <path>` - Path to file-changes directory (default: ~/file-changes)
- `--yes, -y` - Skip confirmation prompts
- `--force` - Force re-sync of all threads, ignoring cached state

---

### 📊 `event`
**Description:** Send telemetry events to Arden Stats API

**Usage:** `arden event [options]`

**Options:**
- `--agent <id>` - Agent ID (required)
- `--bid <int>` - Bid amount in micro-cents (default: 0)
- `--mult <int>` - Bid multiplier (default: 0)
- `--time <ms>` - Timestamp in epoch milliseconds
- `--data <json>` - Data payload as JSON string, @file, or - for stdin
- `--file <path>` - Read data from file
- `--print` - Pretty-print the event payload

**Additional Arguments:** 
- Key-value pairs: `key=value` - Add custom data fields

---

### ⚙️ `config`
**Description:** Display current Arden CLI configuration

**Usage:** `arden config`

Displays the current configuration settings and provides guidance on editing the configuration file manually.

**Configuration Keys:**
- `host` - API host URL
- `api_token` - Authentication token
- `user_id` - User authentication ID
- `claudeSettingsPath` - Path to Claude settings.json
- `claudeAmpThreadsPath` - Path to Claude/Amp threads directory
- `claude_sync` - Local sync state tracking for incremental Claude syncs
- `amp_sync` - Local sync state tracking for incremental Amp syncs

## Configuration File

Settings are stored in `~/.arden/settings.json` with the following structure:

```json
{
  "host": "https://ardenstats.com",
  "api_token": "your-api-token",
  "user_id": "your-user-id",
  "claudeSettingsPath": "~/.claude/settings.json",
  "claudeAmpThreadsPath": "~/.claude/amp_threads",
  "claude_sync": {
    "last_sync": "2025-01-23T10:30:00Z",
    "synced_files": [
      {
        "path": "thread_abc123.jsonl",
        "checksum": "sha256:...",
        "last_modified": "2025-01-23T10:00:00Z",
        "events_processed": 25
      }
    ]
  },
  "amp_sync": {
    "last_sync": "2025-01-23T11:00:00Z",
    "synced_files": [
      {
        "path": "T-thread-456",
        "checksum": "sha256:...",
        "last_modified": "2025-01-23T10:30:00Z",
        "events_processed": 1
      }
    ]
  }
}
```

## Environment Variables

The CLI respects these environment variables:

- `ARDEN_HOST` - API host URL
- `ARDEN_API_TOKEN` - API authentication token
- `ARDEN_USER_ID` - User authentication ID

## Examples

### Basic Setup
```bash
# Initial setup and configuration
arden init
```

### Claude Code Integration
```bash
# Initialize hooks into Claude Code
arden claude init

# Sync Claude Code usage data
arden claude sync

# Force sync all files (ignoring previous sync state)
arden claude sync --force
```

### Amp Code Integration
```bash
# Sync Amp threads from file-changes directory
arden amp sync

# Sync from custom directory
arden amp sync --threads ~/custom-threads

# Force sync all threads (ignoring previous sync state)
arden amp sync --force
```

### Sending Events
```bash
# Send a simple event
arden event --agent my-agent --data '{"action": "tool_use", "tool": "file_read"}'

# Send event with custom fields
arden event --agent my-agent status=success duration=1500

# Pretty-print event payload
arden event --agent my-agent --data '{"event": "test"}' --print
```

### Configuration Management
```bash
# View current settings and configuration guidance
arden config
```

To modify settings, edit `~/.arden/settings.json` directly:
```json
{
  "host": "https://api.ardenstats.com",
  "api_token": "your-token",
  "default_format": "table"
}
```



## Exit Codes

- `0` - Success
- `1` - General error (authentication, validation, network, etc.)
- `2` - Invalid arguments or configuration

## Debugging

Use environment variable `DEBUG=arden:*` for detailed logging:

```bash
DEBUG=arden:* arden event --agent test --data '{}'
```
