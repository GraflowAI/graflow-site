---
sidebar_position: 1
---

# Configuration Reference

Complete reference for Graflow workflow configuration.

## Workflow Configuration

### Top-level Properties

```yaml
name: string          # Required: Workflow name
description: string   # Optional: Workflow description
version: string       # Optional: Workflow version
tasks: []             # Required: List of tasks
```

## Task Configuration

### Task Properties

```yaml
tasks:
  - name: string           # Required: Task name
    description: string    # Optional: Task description
    script: string         # Required: Script to execute
    depends_on: []         # Optional: Task dependencies
    image: string          # Optional: Docker image
    env: {}                # Optional: Environment variables
    retry: {}              # Optional: Retry configuration
    timeout: string        # Optional: Task timeout
```

### Retry Configuration

```yaml
retry:
  max_attempts: 3      # Maximum retry attempts
  delay: 5s            # Delay between retries
  backoff: exponential # Backoff strategy: fixed, linear, exponential
```

### Environment Variables

```yaml
env:
  MY_VAR: "value"
  SECRET: "${SECRET_FROM_ENV}"
```

## Examples

See the [Getting Started](../getting-started) section for practical examples.
