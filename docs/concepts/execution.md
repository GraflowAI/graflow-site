---
sidebar_position: 3
---

# Execution

Understanding how Graflow executes your workflows.

## Execution Model

Graflow uses a directed acyclic graph (DAG) to determine task execution order. Tasks without dependencies run in parallel, while dependent tasks wait for their prerequisites to complete.

## Execution Flow

1. **Parse**: Graflow reads and validates your workflow definition
2. **Plan**: Dependencies are analyzed and an execution plan is created
3. **Execute**: Tasks are run according to the plan
4. **Report**: Results and logs are collected and reported

## Parallel Execution

```yaml
tasks:
  - name: task-a
    script: echo "A"

  - name: task-b
    script: echo "B"

  - name: task-c
    depends_on: [task-a, task-b]
    script: echo "C"
```

In this example, `task-a` and `task-b` run in parallel, then `task-c` runs after both complete.

## Error Handling

When a task fails, Graflow:

1. Marks the task as failed
2. Skips any dependent tasks
3. Reports the error with detailed logs

## Next Steps

See the [Reference](../reference) section for detailed configuration options.
