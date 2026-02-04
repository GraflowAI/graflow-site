---
sidebar_position: 1
---

# Workflows

A workflow is the fundamental unit of execution in Graflow.

## What is a Workflow?

A workflow is a collection of tasks that are executed in a specific order based on their dependencies. Workflows are defined using YAML configuration files.

## Workflow Structure

```yaml
name: my-workflow
description: A description of what this workflow does

tasks:
  - name: task-1
    script: echo "Hello"

  - name: task-2
    depends_on: [task-1]
    script: echo "World"
```

## Key Properties

| Property | Description | Required |
|----------|-------------|----------|
| `name` | Unique identifier for the workflow | Yes |
| `description` | Human-readable description | No |
| `tasks` | List of tasks to execute | Yes |

## Next Steps

Learn more about [Tasks](./tasks) and how they work within workflows.
