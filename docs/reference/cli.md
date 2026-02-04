---
sidebar_position: 2
---

# CLI Reference

Command-line interface reference for Graflow.

## Basic Usage

```bash
graflow [command] [options]
```

## Commands

### `run`

Execute a workflow.

```bash
graflow run <workflow-file> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--dry-run` | Validate without executing |
| `--verbose` | Enable verbose logging |
| `--parallel <n>` | Max parallel tasks |

### `validate`

Validate a workflow file without executing.

```bash
graflow validate <workflow-file>
```

### `list`

List workflow runs and their status.

```bash
graflow list [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--status <status>` | Filter by status |
| `--limit <n>` | Limit results |

### `status`

Get the status of a workflow run.

```bash
graflow status <run-id>
```

### `logs`

View logs for a workflow run.

```bash
graflow logs <run-id> [--task <task-name>]
```

## Global Options

| Option | Description |
|--------|-------------|
| `--help` | Show help |
| `--version` | Show version |
| `--config <file>` | Config file path |
