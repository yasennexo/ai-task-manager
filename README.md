# AI Task Manager

A personal task management agent that runs inside Claude Code. It reads your Slack channels and DMs, extracts actionable tasks (including implicit commitments, follow-ups, and open decisions), and stores them in a local SQLite database.

## How it works

There is no UI. You talk to Claude Code in plain English:

```
extract my tasks
show my tasks
mark task abc123 as done
snooze task abc123 until Friday
send digest
```

Claude reads your Slack messages, figures out what you need to do, and manages the database for you.

## Prerequisites

1. **Node.js 20+**
2. **Claude Code CLI** — [install here](https://docs.anthropic.com/en/claude-code)
3. **Slack MCP connected to Claude Code** — follow the setup in Claude Code settings to connect the Slack integration. You'll need your Slack workspace authorised.

## Setup

```bash
git clone <repo-url>
cd ai-task-manager
npm install
cp .env.example .env
# Add your Anthropic API key to .env
```

Then open Claude Code in this directory:

```bash
claude
```

Claude will detect that `slack.json` is missing and walk you through onboarding — it will ask for your Slack user ID, your channels, your DM contacts, and your project names. This takes about 5 minutes.

## Daily usage

| What you say | What happens |
|---|---|
| `extract my tasks` | Scans private channels + DMs for new tasks |
| `extract my tasks from DMs` | DMs only |
| `extract my tasks including public channels` | Full scan including public channels |
| `show my tasks` | Prints open tasks grouped by project and priority |
| `mark task X as done` | Closes a task (use the 8-char ID shown in the list) |
| `snooze task X until Monday` | Hides a task until the given date |
| `send digest` | Posts your task list to your Slack DM |
| `run daily digest` | Extract + show + send digest in one go |

## Task extraction

The agent extracts two types of tasks:

- **Explicit** — someone directly asked you to do something
- **Contextual** — implicit commitments you made ("I'll send that over"), follow-ups you promised, decisions you're waiting on, items shared with you that you haven't acted on

It looks back 7 days by default and skips duplicates automatically.

## Database CLI (direct access)

If you ever need to manage tasks without Claude:

```bash
npm run init          # initialise the database (run once)
npm run tasks         # show all open tasks
npm run cli done <id>            # mark a task done
npm run cli snooze <id> YYYY-MM-DD  # snooze a task
npm run cli reopen <id>          # reopen a snoozed/done task
```

## Project structure

```
slack.json          # your channel/DM IDs (gitignored, created during onboarding)
slack.example.json  # template showing the expected format
CLAUDE.md           # agent instructions (workflows, rules, your config)
src/cli.ts          # database CLI
src/db/             # SQLite schema and queries
tasks.db            # your task database (gitignored)
.env                # your Anthropic API key (gitignored)
```
