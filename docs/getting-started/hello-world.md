---
sidebar_position: 3
---

# Hello World

Let's create your first Graflow workflow.

## Create a Workflow File

Create a new file called `workflow.yaml`:

```yaml
name: hello-world
description: My first Graflow workflow

tasks:
  - name: greet
    script: |
      echo "Hello, Graflow!"
```

## Run the Workflow

Execute your workflow using the Graflow CLI:

```bash
graflow run workflow.yaml
```

You should see output similar to:

```
[2025-01-01 12:00:00] Starting workflow: hello-world
[2025-01-01 12:00:00] Running task: greet
Hello, Graflow!
[2025-01-01 12:00:01] Task completed: greet
[2025-01-01 12:00:01] Workflow completed successfully
```

## Understanding the Output

Graflow provides detailed logging for every step:

- **Timestamps**: When each task started and completed
- **Task names**: Which task is currently running
- **Output**: The actual output from your scripts

## Next Steps

Congratulations! You've run your first Graflow workflow. Continue to the [Tutorial](/docs/tutorial) to learn more advanced features.
