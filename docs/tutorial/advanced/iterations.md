---
sidebar_position: 3
---

# Task Iterations

Execute a task repeatedly with cycle control for convergence, accumulation, and polling patterns.

## Overview

Use `ctx.next_iteration()` to re-enqueue the current task for another execution cycle. Combined with `@task(max_cycles=N)`, this gives you controlled loops within a workflow graph.

**Key concepts:**

| API | Description |
|-----|-------------|
| `@task(max_cycles=N)` | Allow exactly N executions of the task |
| `ctx.cycle_count` | 1-based counter (1 on first execution) |
| `ctx.can_iterate()` | Returns `True` if cycle budget remains |
| `ctx.next_iteration(data)` | Queue another execution, optionally passing data |

## Basic Iteration

Use `max_cycles` to limit how many times a task can execute, and `can_iterate()` to check if another cycle is allowed.

```python
from graflow.core.context import ExecutionContext, TaskExecutionContext
from graflow.core.decorators import task
from graflow.core.engine import WorkflowEngine
from graflow.core.graph import TaskGraph

graph = TaskGraph()

@task(inject_context=True, max_cycles=5)
def counter(ctx: TaskExecutionContext):
    print(f"  cycle {ctx.cycle_count}/{ctx.max_cycles}")
    if ctx.can_iterate():
        ctx.next_iteration()

graph.add_node(counter, "counter")
context = ExecutionContext.create(graph, start_node="counter")
WorkflowEngine().execute(context)
```

**Output:**
```
  cycle 1/5
  cycle 2/5
  cycle 3/5
  cycle 4/5
  cycle 5/5
```

## Passing Data Between Iterations

Pass a dictionary to `next_iteration(data)` to carry state across cycles. The data is available as the `data` parameter of the next invocation.

```python
graph = TaskGraph()

@task(inject_context=True, max_cycles=4)
def accumulator(ctx: TaskExecutionContext, data=None):
    total = (data or {}).get("total", 0) + 10
    print(f"  cycle {ctx.cycle_count}: total={total}")
    ctx.get_channel().set("total", total)
    if ctx.can_iterate():
        ctx.next_iteration({"total": total})

graph.add_node(accumulator, "accumulator")
context = ExecutionContext.create(graph, start_node="accumulator")
WorkflowEngine().execute(context)
print(f"Final total: {context.channel.get('total')}")
```

**Output:**
```
  cycle 1: total=10
  cycle 2: total=20
  cycle 3: total=30
  cycle 4: total=40
Final total: 40
```

## Early Exit on Convergence

You don't have to use all available cycles. Simply don't call `next_iteration()` when a convergence condition is met.

```python
graph = TaskGraph()

@task(inject_context=True, max_cycles=20)
def optimizer(ctx: TaskExecutionContext, data=None):
    loss = (data or {}).get("loss", 1.0) * 0.5
    print(f"  cycle {ctx.cycle_count}: loss={loss:.4f}")
    if loss < 0.05:
        print(f"  Converged at cycle {ctx.cycle_count}")
        return
    if ctx.can_iterate():
        ctx.next_iteration({"loss": loss})

graph.add_node(optimizer, "optimizer")
WorkflowEngine().execute(
    ExecutionContext.create(graph, start_node="optimizer")
)
```

**Output:**
```
  cycle 1: loss=0.5000
  cycle 2: loss=0.2500
  cycle 3: loss=0.1250
  cycle 4: loss=0.0625
  cycle 5: loss=0.0313
  Converged at cycle 5
```

The task stops after 5 cycles even though `max_cycles=20`, because the convergence condition was met.

## Iteration in a Pipeline

An iterating task collects data across cycles, then hands off to downstream tasks as usual.

```python
graph = TaskGraph()

@task(inject_context=True, max_cycles=3)
def collect(ctx: TaskExecutionContext, data=None):
    items = list((data or {}).get("items", []))
    items.append(f"item_{ctx.cycle_count}")
    print(f"  [collect] cycle {ctx.cycle_count}: gathered {items[-1]}")
    ctx.get_channel().set("items", items)
    if ctx.can_iterate():
        ctx.next_iteration({"items": items})

@task(inject_context=True)
def summarize(ctx: TaskExecutionContext):
    items = ctx.get_channel().get("items")
    print(f"  [summarize] collected {len(items)} items: {items}")

graph.add_node(collect, "collect")
graph.add_node(summarize, "summarize")
graph.add_edge("collect", "summarize")

WorkflowEngine().execute(
    ExecutionContext.create(graph, start_node="collect")
)
```

**Output:**
```
  [collect] cycle 1: gathered item_1
  [collect] cycle 2: gathered item_2
  [collect] cycle 3: gathered item_3
  [summarize] collected 3 items: ['item_1', 'item_2', 'item_3']
```

The `summarize` task runs only after `collect` has finished all its iterations.

## Use Cases

- **Retry logic with max attempts** -- poll an external service until it responds
- **ML training loops** -- iterate until loss converges below a threshold
- **Data collection** -- gather items across multiple pages or batches
- **Progressive enhancement** -- refine results over successive passes

:::tip
For automatic retry on exceptions, see [Task Retries](./retries.md). Iterations are for **intentional** repetition with explicit control flow, while retries are for **recovering from failures**.
:::
