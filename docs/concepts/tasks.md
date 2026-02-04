---
sidebar_position: 2
---

# Tasks

Tasks are the building blocks of workflows in Graflow.

## What is a Task?

A task represents a single unit of work within a workflow. Each task can run scripts, execute commands, or perform specific operations.

## Task Structure

```yaml
tasks:
  - name: my-task
    description: What this task does
    script: |
      echo "Running my task"
    depends_on: [previous-task]
    retry:
      max_attempts: 3
      delay: 5s
```

## Task Properties

| Property | Description | Required |
|----------|-------------|----------|
| `name` | Unique identifier within the workflow | Yes |
| `description` | Human-readable description | No |
| `script` | Commands to execute | Yes |
| `depends_on` | List of tasks that must complete first | No |
| `retry` | Retry configuration | No |

## Task Dependencies

Tasks can depend on other tasks using the `depends_on` property. Graflow automatically determines the execution order based on these dependencies.

## Next Steps

Learn about [Execution](./execution) to understand how Graflow runs your tasks.
