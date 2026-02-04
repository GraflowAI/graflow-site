---
sidebar_position: 4
---

# Execution

Understanding how Graflow executes workflows and provides dynamic control flow.

## Execution Model

Graflow uses a **DAG × State Machine hybrid design**:

- **DAG (Static Structure)**: Operators (`>>`, `|`) define the task graph skeleton
- **State Machine (Dynamic Transitions)**: `next_task()`, `next_iteration()` enable runtime state transitions

This combination achieves both **static readability** and **dynamic flexibility**.

## Basic Execution

### Auto-Detection of Start Node

When you call `wf.execute()` without arguments, Graflow automatically finds the start node:

```python
with workflow("auto_start") as wf:
    step1 >> step2 >> step3

    # Auto-detects step1 (node with no predecessors)
    wf.execute()
```

**How auto-detection works:**
1. Finds all nodes with **no incoming edges** (no predecessors)
2. If **exactly one** node found → use it as start node
3. If **none** found → raises `GraphCompilationError` (cyclic graph or empty)
4. If **multiple** found → raises `GraphCompilationError` (ambiguous start point)

### Manual Start Node

Specify a start node explicitly:

```python
with workflow("skip") as wf:
    step1 >> step2 >> step3

    # Start from step2 (skip step1)
    wf.execute(start_node="step2")
```

### Getting Results

```python
with workflow("results") as wf:
    @task
    def task_a():
        return "A"

    @task
    def task_b():
        return "B"

    task_a >> task_b

    # Option 1: Get final result only
    result = wf.execute()  # "B" (last task's result)

    # Option 2: Get all results via context
    _, ctx = wf.execute(ret_context=True)
    print(ctx.get_result("task_a"))  # "A"
    print(ctx.get_result("task_b"))  # "B"
```

## Dynamic Task Generation

Modify the workflow graph during execution using runtime control methods.

### Adding Tasks with next_task()

Use `context.next_task()` to add tasks dynamically:

**The `goto` parameter:**

- **`ctx.next_task(task, goto=False)`** (default):
  - Enqueue the task to the execution queue
  - Continue to normal successors after current task completes
  - Use for adding additional work without changing control flow

- **`ctx.next_task(task, goto=True)`**:
  - Jump to the specified task immediately
  - Skip normal successors of current task
  - **Designed for jumping to existing tasks already in the graph**

### Example: Jumping to Existing Tasks

Use `goto=True` to jump to tasks already defined in the workflow:

```python
with workflow("error_handling") as wf:
    @task(inject_context=True)
    def risky_operation(ctx: TaskExecutionContext):
        try:
            if random.random() < 0.3:  # 30% chance of error
                raise CriticalError("Critical failure!")
            print("Operation succeeded")
        except CriticalError:
            # Jump to existing emergency handler task
            emergency_task = ctx.graph.get_node("emergency_handler")
            ctx.next_task(emergency_task, goto=True)  # Skip normal successors

    @task
    def emergency_handler():
        print("Emergency handler activated!")

    @task
    def normal_continuation():
        print("Continuing normal flow")

    risky_operation >> normal_continuation

    wf.execute()
```

**On error:** `Emergency handler activated!`
**On success:** `Operation succeeded` → `Continuing normal flow`

### Example: Conditional Branching

```python
with workflow("conditional") as wf:
    @task(inject_context=True)
    def router(ctx: TaskExecutionContext, user_type: str):
        if user_type == "premium":
            premium_task = ctx.graph.get_node("premium_flow")
            ctx.next_task(premium_task, goto=True)
        elif user_type == "basic":
            basic_task = ctx.graph.get_node("basic_flow")
            ctx.next_task(basic_task, goto=True)

    @task
    def premium_flow():
        print("Premium user processing")

    @task
    def basic_flow():
        print("Basic user processing")

    router >> premium_flow  # Default path (skipped when goto=True)

    wf.execute(initial_channel={"user_type": "premium"})
```

### Example: Enqueue Additional Work

Use `goto=False` (default) to add tasks without changing control flow:

```python
@task(inject_context=True)
def process(ctx: TaskExecutionContext):
    @task
    def extra_logging():
        print("Extra logging task")

    # Enqueue: Add extra_logging, then continue to normal successors
    ctx.next_task(extra_logging)  # goto=False is default

    print("Main processing")

@task
def continuation():
    print("Normal continuation")

with workflow("enqueue_demo") as wf:
    process >> continuation
    wf.execute()
```

**Output:**
```
Main processing
Extra logging task
Normal continuation
```

## Self-Looping with next_iteration()

Use `context.next_iteration()` for retry and convergence patterns:

```python
@task(inject_context=True)
def optimize(ctx: TaskExecutionContext):
    channel = ctx.get_channel()
    iteration = channel.get("iteration", default=0)
    accuracy = channel.get("accuracy", default=0.5)

    # Training step
    new_accuracy = train_step(accuracy)
    print(f"Iteration {iteration}: accuracy={new_accuracy:.2f}")

    if new_accuracy >= 0.95:
        # Converged!
        print("Converged!")
        channel.set("final_accuracy", new_accuracy)
    else:
        # Continue iterating
        channel.set("iteration", iteration + 1)
        channel.set("accuracy", new_accuracy)
        ctx.next_iteration()

with workflow("optimization") as wf:
    wf.execute()
```

**Output:**
```
Iteration 0: accuracy=0.65
Iteration 1: accuracy=0.78
Iteration 2: accuracy=0.88
Iteration 3: accuracy=0.96
Converged!
```

**Use cases:**
- Retry logic with max attempts
- ML hyperparameter tuning
- Convergence-based algorithms
- Progressive enhancement

## Early Termination

### Normal Termination: terminate_workflow()

Exit successfully without running remaining tasks:

```python
@task(inject_context=True)
def check_cache(ctx: TaskExecutionContext, key: str):
    cached = get_from_cache(key)

    if cached is not None:
        print(f"Cache hit: {cached}")
        ctx.terminate_workflow("Data found in cache")
        return cached

    print("Cache miss, proceeding...")
    return None

@task
def expensive_processing():
    print("Expensive processing...")
    return "processed"

with workflow("caching") as wf:
    check_cache(task_id="cache", key="my_key") >> expensive_processing
    wf.execute()
```

### Abnormal Termination: cancel_workflow()

Exit with an error:

```python
@task(inject_context=True)
def validate_data(ctx: TaskExecutionContext, data: dict):
    if not data.get("valid"):
        ctx.cancel_workflow("Data validation failed")

    return data

with workflow("validation") as wf:
    validate = validate_data(task_id="validate", data={"valid": False})
    validate >> process_data

    try:
        wf.execute()
    except Exception as e:
        print(f"Workflow canceled: {e}")
```

### Termination Comparison

| Method | Task Completes? | Successors Run? | Error Raised? |
|--------|----------------|----------------|---------------|
| `terminate_workflow()` | Yes | No | No |
| `cancel_workflow()` | No | No | Yes (`GraflowWorkflowCanceledError`) |

## Control Flow Summary

| Method | Purpose |
|--------|---------|
| `next_task(task)` | Enqueue task, continue normally |
| `next_task(task, goto=True)` | Jump to task, skip successors |
| `next_iteration()` | Self-loop for retry/convergence |
| `terminate_workflow()` | Exit successfully |
| `cancel_workflow()` | Exit with error |

For human-in-the-loop workflows, see [Human-in-the-Loop (HITL)](./hitl).
