---
sidebar_position: 1
---

# Dynamic Task Generation

Modify the workflow graph during execution for advanced control flow.

## Why Runtime Dynamics?

Many workflow systems require defining all branches and loops at compile time. Graflow lets you write normal Python conditionals and generate tasks on-the-fly.

## Adding Tasks at Runtime

Use `context.next_task()` to add tasks dynamically or jump to existing tasks.

### The goto Parameter

- **`ctx.next_task(task, goto=False)`** (default):
  - Enqueue the task to the execution queue
  - Continue to normal successors after current task completes
  - Use for adding additional work without changing control flow

- **`ctx.next_task(task, goto=True)`**:
  - Jump to the specified task immediately
  - Skip normal successors of current task
  - Designed for jumping to existing tasks already in the graph

### Example: Jumping to Existing Tasks

```python
with workflow("error_handling") as wf:
    @task(inject_context=True)
    def risky_operation(ctx: TaskExecutionContext):
        """Process data with potential errors."""
        try:
            if random.random() < 0.3:  # 30% chance of error
                raise CriticalError("Critical failure!")
            print("Operation succeeded")
        except CriticalError:
            # Jump to existing emergency handler task
            emergency_task = ctx.graph.get_node("emergency_handler")
            ctx.next_task(emergency_task, goto=True)

    @task
    def emergency_handler():
        """Handle emergency situations."""
        print("Emergency handler activated!")

    @task
    def normal_continuation():
        """This runs only if risky_operation succeeds."""
        print("Continuing normal flow")

    risky_operation >> normal_continuation

    wf.execute()
```

### Example: Enqueue Additional Work

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

**Key Differences:**
- **`goto=False`** (default): "Do this task AND continue normally"
- **`goto=True`**: "Jump to this existing task INSTEAD of continuing normally"

## Self-Looping with next_iteration

Use `context.next_iteration()` for retry/convergence patterns:

```python
@task(inject_context=True)
def optimize(ctx: TaskExecutionContext):
    """Optimize until convergence."""
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

**Use Cases:**
- Retry logic with max attempts
- ML hyperparameter tuning
- Convergence-based algorithms
- Progressive enhancement

## Early Termination

### Normal Termination: terminate_workflow

Use when you want to exit successfully:

```python
@task(inject_context=True)
def check_cache(ctx: TaskExecutionContext, key: str):
    """Check cache before processing."""
    cached = get_from_cache(key)

    if cached is not None:
        # Cache hit - no need to continue
        print(f"Cache hit: {cached}")
        ctx.terminate_workflow("Data found in cache")
        return cached

    # Cache miss - continue to next tasks
    print("Cache miss, proceeding...")
    return None

@task
def expensive_processing():
    """This won't run if cache hits."""
    print("Expensive processing...")
    return "processed"

with workflow("caching") as wf:
    check_cache(task_id="cache", key="my_key") >> expensive_processing
    wf.execute()
```

### Abnormal Termination: cancel_workflow

Use when an error occurs:

```python
@task(inject_context=True)
def validate_data(ctx: TaskExecutionContext, data: dict):
    """Validate data before processing."""
    if not data.get("valid"):
        # Invalid data - cancel entire workflow
        ctx.cancel_workflow("Data validation failed")

    return data

@task
def process_data(data: dict):
    print("Processing data...")
    return data

with workflow("validation") as wf:
    validate = validate_data(task_id="validate", data={"valid": False})
    validate >> process_data

    try:
        wf.execute()
    except Exception as e:
        print(f"Workflow canceled: {e}")
```

**Differences:**

| Method | Task Completes? | Successors Run? | Error Raised? |
|--------|----------------|----------------|---------------|
| `terminate_workflow` | Yes | No | No |
| `cancel_workflow` | No | No | Yes (GraflowWorkflowCanceledError) |

**Key Takeaways:**
- `next_task(task)` enqueues task and continues to normal successors
- `next_task(task, goto=True)` jumps to task, skipping normal successors
- `next_iteration()` creates self-loops for retry/convergence
- `terminate_workflow()` exits successfully
- `cancel_workflow()` exits with error
