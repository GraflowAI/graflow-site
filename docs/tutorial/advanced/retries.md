---
sidebar_position: 2
---

# Task Retries

Automatically retry failed tasks to handle transient errors gracefully.

## Overview

When a task raises an exception, Graflow can automatically re-enqueue it for another attempt. This is useful for handling transient failures like network timeouts or rate-limited APIs without adding retry logic inside every task.

**Key concepts:**

| API | Description |
|-----|-------------|
| `@task(max_retries=N)` | Allow up to N retry attempts after the initial failure |
| `ctx.retry_count` | Number of retries so far (0 on the first attempt) |
| `ctx.max_retries` | The configured retry limit for the current task |
| `default_max_retries` | Global default applied to all tasks (default: 0 = no retries) |

## Basic Retry

Use `@task(max_retries=N)` to allow a task to be retried up to N times after failure. Retry is **automatic** -- the engine re-enqueues the task when it raises an exception.

```python
from graflow.core.context import ExecutionContext, TaskExecutionContext
from graflow.core.decorators import task
from graflow.core.engine import WorkflowEngine
from graflow.core.graph import TaskGraph

graph = TaskGraph()
attempts = 0

@task(inject_context=True, max_retries=3)
def flaky_api(ctx: TaskExecutionContext):
    global attempts
    attempts += 1
    print(f"  attempt {attempts} (retry_count={ctx.retry_count})")
    if attempts < 3:
        raise ConnectionError(f"Connection refused (attempt {attempts})")
    return "ok"

graph.add_node(flaky_api, "flaky_api")
context = ExecutionContext.create(graph, start_node="flaky_api")
WorkflowEngine().execute(context)
print(f"Result: {context.get_result('flaky_api')}")
```

**Output:**
```
  attempt 1 (retry_count=0)
  attempt 2 (retry_count=1)
  attempt 3 (retry_count=2)
Result: ok
```

The task fails twice and succeeds on the third attempt. Since `max_retries=3`, there is still one retry remaining.

## Retry Exhaustion

If a task fails on every attempt and exhausts all retries, the engine raises a `GraflowRuntimeError`.

```python
from graflow.exceptions import GraflowRuntimeError

graph = TaskGraph()
attempts = 0

@task(max_retries=2)
def always_fails():
    global attempts
    attempts += 1
    raise ValueError(f"fail #{attempts}")

graph.add_node(always_fails, "always_fails")
try:
    WorkflowEngine().execute(
        ExecutionContext.create(graph, start_node="always_fails")
    )
except GraflowRuntimeError:
    print(f"Failed after {attempts} attempts (1 initial + 2 retries)")
```

**Output:**
```
Failed after 3 attempts (1 initial + 2 retries)
```

## Retry in a Pipeline

Retries are scoped to the failing task. Other tasks in the pipeline are not affected.

```python
graph = TaskGraph()
middle_attempts = 0

@task
def step_1():
    print("  [step_1] ok")
    return "data"

@task(max_retries=2)
def step_2():
    global middle_attempts
    middle_attempts += 1
    print(f"  [step_2] attempt {middle_attempts}")
    if middle_attempts < 2:
        raise RuntimeError("transient")
    return "processed"

@task
def step_3():
    print("  [step_3] ok")
    return "done"

graph.add_node(step_1, "step_1")
graph.add_node(step_2, "step_2")
graph.add_node(step_3, "step_3")
graph.add_edge("step_1", "step_2")
graph.add_edge("step_2", "step_3")

context = ExecutionContext.create(graph, start_node="step_1")
WorkflowEngine().execute(context)
print(f"Pipeline result: {context.get_result('step_3')}")
```

**Output:**
```
  [step_1] ok
  [step_2] attempt 1
  [step_2] attempt 2
  [step_3] ok
Pipeline result: done
```

`step_1` runs once, `step_2` retries once and then succeeds, and `step_3` runs normally.

## Global Default Retries

Set `default_max_retries` on `ExecutionContext.create()` to apply a retry limit to all tasks that don't specify their own.

```python
graph = TaskGraph()
attempts = 0

@task
def unstable():
    global attempts
    attempts += 1
    if attempts < 3:
        raise RuntimeError(f"fail #{attempts}")
    return "recovered"

graph.add_node(unstable, "unstable")
# All tasks get 3 retries by default
context = ExecutionContext.create(
    graph, start_node="unstable", default_max_retries=3
)
WorkflowEngine().execute(context)
print(f"Recovered after {attempts} attempts")
```

**Output:**
```
Recovered after 3 attempts
```

:::tip
Per-task `max_retries` takes precedence over `default_max_retries`. Use the global default for a baseline, and override on individual tasks as needed.
:::

## Retry vs. Iteration

Retries and iterations are distinct mechanisms:

| | Retry | Iteration |
|---|---|---|
| **Trigger** | Automatic on exception | Manual via `ctx.next_iteration()` |
| **Purpose** | Recover from transient failures | Repeat logic until a condition is met |
| **Limit parameter** | `max_retries` | `max_cycles` |
| **Counter** | `ctx.retry_count` (0-based) | `ctx.cycle_count` (1-based) |
| **Data passing** | Same input on each retry | Pass new data via `next_iteration(data)` |

See [Task Iterations](./iterations.md) for details on iterative execution.
