---
sidebar_position: 6
---

# Checkpoints

Checkpoints enable workflow state persistence and recovery in Graflow — save progress at any point and resume later.

## Overview

Checkpoints allow you to:

- **Save workflow state** at specific points during execution
- **Resume execution** from a saved checkpoint after interruption or failure
- **Implement fault tolerance** for long-running workflows
- **Support state machine workflows** with iterative checkpoints

```python
from graflow.core.context import TaskExecutionContext

@task(inject_context=True)
def expensive_task(ctx: TaskExecutionContext):
    # Perform expensive computation
    result = train_model()

    # Request checkpoint after expensive work
    ctx.checkpoint(metadata={"stage": "training_complete"})

    return result
```

## Creating Checkpoints

### Basic Checkpoint

Use `ctx.checkpoint()` within a task to request a checkpoint:

```python
from graflow.core.context import TaskExecutionContext
from graflow.core.decorators import task
from graflow.core.workflow import workflow

with workflow("checkpoint_demo") as wf:

    @task(inject_context=True)
    def process_data(ctx: TaskExecutionContext):
        # Do important work
        result = expensive_computation()

        # Request checkpoint
        ctx.checkpoint(metadata={"records_processed": 1000})

        return result

    wf.execute("process_data")
```

### Checkpoint with Custom Path

Specify a custom path for the checkpoint:

```python
@task(inject_context=True)
def save_progress(ctx: TaskExecutionContext):
    process_batch()

    # Save to specific location
    ctx.checkpoint(
        path="/checkpoints/batch_1",
        metadata={"batch_id": 1}
    )
```

### Deferred Checkpoint Execution

**Important**: `ctx.checkpoint()` does **not** create the checkpoint immediately.

1. `ctx.checkpoint()` sets a flag in the execution context
2. Task continues to completion
3. Engine creates checkpoint **after** task completes successfully
4. Task is marked as completed in the checkpoint

This ensures checkpoints represent consistent states — tasks are either completed or pending.

```python
@task(inject_context=True)
def example_task(ctx: TaskExecutionContext):
    step_1()
    ctx.checkpoint()  # Sets flag, doesn't create checkpoint yet
    step_2()          # Task continues
    return "done"     # Checkpoint created HERE by engine
```

## Resuming from Checkpoints

Use `CheckpointManager.resume_from_checkpoint()` to restore and continue execution:

```python
from graflow.core.checkpoint import CheckpointManager
from graflow.core.engine import WorkflowEngine

# Resume from checkpoint
context, metadata = CheckpointManager.resume_from_checkpoint(
    "checkpoints/my_checkpoint.pkl"
)

print(f"Resuming from step {metadata.steps}")
print(f"Completed tasks: {context.completed_tasks}")

# Continue execution
engine = WorkflowEngine()
result = engine.execute(context)
```

### Metadata Access

Checkpoint metadata contains useful information:

```python
context, metadata = CheckpointManager.resume_from_checkpoint(checkpoint_path)

print(metadata.session_id)      # Workflow session ID
print(metadata.steps)           # Steps executed at checkpoint
print(metadata.created_at)      # ISO 8601 timestamp
print(metadata.user_metadata)   # Your custom metadata
```

## Checkpoint Files

Each checkpoint creates three files:

| File | Contents |
|------|----------|
| `.pkl` | Serialized ExecutionContext (graph, channel data) |
| `.state.json` | Execution state (completed tasks, pending tasks, cycle counts) |
| `.meta.json` | Metadata (checkpoint ID, timestamps, user metadata) |

**Example:**
```
checkpoints/session_12345_step_10.pkl
checkpoints/session_12345_step_10.state.json
checkpoints/session_12345_step_10.meta.json
```

### What Gets Saved

- **Task graph structure** — Workflow definition
- **Channel data** — Inter-task communication state (MemoryChannel) or session ID (RedisChannel)
- **Completed tasks** — Which tasks have finished
- **Pending tasks** — Full TaskSpec for tasks waiting to execute
- **Cycle counts** — For iterative tasks using `next_iteration()`
- **Task results** — Stored in channel as `{task_id}.__result__`

## Idempotency: Critical User Responsibility

**Tasks must be idempotent** — executing the same task multiple times produces the same result as executing it once.

### Why Idempotency Matters

When resuming from a checkpoint, **tasks always re-execute from the beginning**. This is by design:

- Saving intermediate task state is complex and error-prone
- Fully restoring local variables is difficult
- Keeping only consistent states (before/after task completion) keeps the system simple

### Non-Idempotent Task (Bad)

```python
# ❌ Dangerous: Not idempotent
@task(inject_context=True)
def process_orders(ctx: TaskExecutionContext):
    orders = fetch_new_orders()
    for order in orders:
        charge_customer(order)  # Double charge on re-execution!
        ship_product(order)     # Double shipment!
    ctx.checkpoint()
```

### Idempotent Task with Channel State (Good)

```python
# ✅ Safe: Track state in channel
@task(inject_context=True)
def process_orders(ctx: TaskExecutionContext):
    channel = ctx.get_channel()
    processed_ids = channel.get("processed_order_ids", set())

    orders = fetch_new_orders()
    for order in orders:
        if order.id in processed_ids:
            continue  # Skip already processed

        charge_customer(order)
        ship_product(order)

        processed_ids.add(order.id)
        channel.set("processed_order_ids", processed_ids)

    ctx.checkpoint()
```

### Idempotent Task with State Machine (Good)

```python
# ✅ Safe: State machine pattern
@task(inject_context=True)
def multi_stage_task(ctx: TaskExecutionContext):
    channel = ctx.get_channel()
    state = channel.get("state", "INIT")

    if state == "INIT":
        initialize_resources()
        channel.set("state", "PROCESSING")
        ctx.checkpoint()
        ctx.next_iteration()

    elif state == "PROCESSING":
        process_data()
        channel.set("state", "FINALIZING")
        ctx.checkpoint()
        ctx.next_iteration()

    elif state == "FINALIZING":
        finalize()
        return "COMPLETE"
```

### Idempotency with External APIs

Use idempotency keys for external API calls:

```python
# ✅ Safe: Idempotency key prevents duplicate execution
@task(inject_context=True)
def call_payment_api(ctx: TaskExecutionContext):
    channel = ctx.get_channel()

    # Generate or retrieve idempotency key
    idempotency_key = channel.get("idempotency_key")
    if not idempotency_key:
        idempotency_key = str(uuid.uuid4())
        channel.set("idempotency_key", idempotency_key)

    # Same key prevents duplicate charges
    result = payment_api.charge(
        amount=100,
        idempotency_key=idempotency_key
    )

    ctx.checkpoint()
    return result
```

### Idempotency Checklist

When implementing tasks, verify:

- [ ] Is the task safe to re-execute?
- [ ] Will writes to external resources not duplicate?
- [ ] Are you tracking processed state in the channel?
- [ ] For financial operations, do you prevent double execution?

## Common Patterns

### Pattern 1: State Machine with Checkpoints

Checkpoint at each state transition for recovery at any stage:

```python
@task(inject_context=True)
def order_processor(ctx: TaskExecutionContext):
    channel = ctx.get_channel()
    state = channel.get("order_state", "NEW")

    if state == "NEW":
        validate_order()
        channel.set("order_state", "VALIDATED")
        ctx.checkpoint(metadata={"stage": "validated"})
        ctx.next_iteration()

    elif state == "VALIDATED":
        process_payment()
        channel.set("order_state", "PAID")
        ctx.checkpoint(metadata={"stage": "paid"})
        ctx.next_iteration()

    elif state == "PAID":
        ship_order()
        return "ORDER_COMPLETE"
```

### Pattern 2: Periodic Checkpoints

For long-running iterative tasks:

```python
@task(inject_context=True)
def ml_training(ctx: TaskExecutionContext):
    channel = ctx.get_channel()
    epoch = channel.get("epoch", 0)

    while epoch < 100:
        train_epoch(epoch)
        epoch += 1
        channel.set("epoch", epoch)

        # Checkpoint every 10 epochs
        if epoch % 10 == 0:
            ctx.checkpoint(metadata={"epoch": epoch})

    return "TRAINING_COMPLETE"
```

### Pattern 3: Fault Recovery

Checkpoint before expensive or unreliable operations:

```python
@task(inject_context=True)
def fault_tolerant_pipeline(ctx: TaskExecutionContext):
    channel = ctx.get_channel()

    # Step 1: Data preparation (idempotent)
    if not channel.get("data_prepared"):
        prepare_data()
        channel.set("data_prepared", True)
        ctx.checkpoint(metadata={"stage": "data_prepared"})

    # Step 2: Expensive computation
    if not channel.get("computed"):
        result = expensive_computation()
        channel.set("computed", True)
        channel.set("result", result)
        ctx.checkpoint(metadata={"stage": "computed"})

    # Step 3: External API call (may fail)
    if not channel.get("uploaded"):
        upload_result(channel.get("result"))
        channel.set("uploaded", True)

    return "COMPLETE"
```

## Backend Support

| Feature | MemoryChannel | RedisChannel |
|---------|---------------|--------------|
| State persistence | Saved to pickle | Persisted in Redis |
| Checkpoint size | Larger (includes all data) | Smaller (only session ID) |
| Multi-worker resume | Not supported | Supported |

**RedisChannel** enables distributed checkpoint/resume — any worker can resume from a checkpoint by reconnecting to the same Redis session.

## Best Practices

### 1. Checkpoint After Expensive Operations

```python
@task(inject_context=True)
def expensive_task(ctx: TaskExecutionContext):
    expensive_computation()  # Hours of work
    ctx.checkpoint()         # Save progress!
```

### 2. Include Meaningful Metadata

```python
ctx.checkpoint(metadata={
    "stage": "validation_complete",
    "records_processed": 10000,
    "accuracy": 0.95
})
```

### 3. Design Tasks for Idempotency

Always use channel-based state to track progress and skip completed work on re-execution.

### 4. Use State Machine Pattern for Complex Flows

Break complex tasks into discrete states with checkpoints at each transition.

## Troubleshooting

### Checkpoint Files Not Created

- Ensure task completes successfully (checkpoint created **after** completion)
- Check write permissions for checkpoint directory
- Verify no exceptions during task execution

### Resume Fails

- Check all three checkpoint files exist (`.pkl`, `.state.json`, `.meta.json`)
- Verify files are not corrupted
- Ensure same Python environment and Graflow version

### Task Re-executes on Resume

This is **expected behavior**. Use channel-based state to skip already-completed work. See the idempotency patterns above.

## Next Steps

- Explore [Execution](./execution) patterns for dynamic control flow
- Learn about [Human-in-the-Loop](./hitl) workflows with automatic checkpointing
