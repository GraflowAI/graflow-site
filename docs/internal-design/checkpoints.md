# Checkpoints

Graflow provides checkpoint/resume functionality for saving and restoring workflow state, enabling fault tolerance and recovery for long-running workflows.

## Use Cases

- **Long-running workflows**: ML training, data pipelines running for hours/days
- **Fault tolerance**: Resume after infrastructure failures or crashes
- **Distributed execution**: Workers pick up from checkpoints after restarts
- **Cost optimization**: Pause expensive workflows and resume later

## Key Design Decisions

| Decision | Description |
|----------|-------------|
| **Explicit checkpoints** | Users call `context.checkpoint()` explicitly |
| **Deferred execution** | Checkpoint created AFTER task completes, not during |
| **Three-file structure** | `.pkl` + `.state.json` + `.meta.json` |
| **Full TaskSpec persistence** | Saves complete task state (data, retry count, strategy) |
| **Backend agnostic** | Works with MemoryChannel and RedisChannel |

## Checkpoint Flow

```
Task Execution                     WorkflowEngine
      │                                  │
      ├── context.checkpoint()           │
      │   (sets flag only)               │
      │                                  │
      ├── return result                  │
      │                                  │
      └──────────────────────────────────►
                                         │
                              mark_task_completed()
                                         │
                              if checkpoint_requested:
                                  create_checkpoint()
                                         │
                              get_next_task()
```

> **Note:** `context.checkpoint()` sets a flag. The actual checkpoint is created by the engine after the task completes successfully.

## File Structure

Three files per checkpoint:

| File | Contents |
|------|----------|
| `{base}.pkl` | ExecutionContext pickle (graph, channel data for Memory) |
| `{base}.state.json` | Session info, steps, completed tasks, pending TaskSpecs |
| `{base}.meta.json` | Checkpoint ID, timestamps, user metadata |

**State JSON Schema**:
```json
{
  "schema_version": "1.0",
  "session_id": "12345",
  "steps": 42,
  "completed_tasks": ["task1", "task2"],
  "cycle_counts": {"task1": 3},
  "pending_tasks": [
    {"task_id": "task3", "retry_count": 0, "...": "..."}
  ]
}
```

## Basic Usage

### Create Checkpoint

```python
@task("process", inject_context=True)
def process(ctx):
    do_work()
    ctx.checkpoint(metadata={"stage": "step1"})
    # Task continues; checkpoint created after return
```

### Resume from Checkpoint

```python
from graflow.core.checkpoint import CheckpointManager
from graflow.core.engine import WorkflowEngine

# Load checkpoint
context, metadata = CheckpointManager.resume_from_checkpoint(
    "checkpoints/session_12345.pkl"
)

# Resume execution (auto-resume from queue)
engine = WorkflowEngine()
engine.execute(context)
```

## State Machine Pattern

For iterative tasks using `next_iteration()`, use channel-based state:

```python
@task("order_processor", inject_context=True)
def process_order(ctx):
    channel = ctx.execution_context.channel
    state = channel.get("order_state") or "NEW"

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

On resume, the task re-executes but skips to the correct state via channel data.

## Backend Comparison

| Feature | MemoryChannel | RedisChannel |
|---------|---------------|--------------|
| **Checkpoint size** | Larger (includes channel data) | Smaller (only session_id) |
| **Portability** | Self-contained file | Requires same Redis instance |
| **Multi-worker resume** | Not supported | Any worker can resume |
| **Queue restoration** | Re-queued from state.json | Already persisted in Redis |

### MemoryChannel Flow

```
Checkpoint:
  └── Save channel data to .pkl
  └── Save pending_tasks to .state.json

Resume:
  └── Load .pkl (restores channel data)
  └── Re-queue pending_tasks from .state.json
```

### RedisChannel Flow

```
Checkpoint:
  └── Save session_id to .pkl (data already in Redis)
  └── Save pending_tasks to .state.json

Resume:
  └── Load .pkl (reconnect to Redis with session_id)
  └── Data available via same Redis keys
```

## API Reference

### CheckpointManager

```python
class CheckpointManager:
    @classmethod
    def create_checkpoint(
        cls,
        context: ExecutionContext,
        path: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> tuple[str, CheckpointMetadata]:
        """Create checkpoint. Path auto-generated if None."""

    @classmethod
    def resume_from_checkpoint(
        cls,
        checkpoint_path: str
    ) -> tuple[ExecutionContext, CheckpointMetadata]:
        """Resume from checkpoint file."""
```

### TaskExecutionContext

```python
def checkpoint(self, metadata: Optional[dict] = None) -> None:
    """Request checkpoint (created after task completes).

    Automatically includes: task_id, cycle_count, elapsed_time
    """
```

## Best Practices

| Practice | Description |
|----------|-------------|
| **Use channel for state** | Store progress in channel for idempotent re-execution |
| **Checkpoint at boundaries** | After expensive operations or state transitions |
| **Use RedisChannel for distributed** | MemoryChannel not portable across workers |
| **Keep workflows consistent** | Graph changes between checkpoint/resume may fail |
| **Manage checkpoint files** | No automatic cleanup; user manages retention |

## Limitations

- **No automatic checkpoint**: Must call `context.checkpoint()` explicitly
- **No automatic cleanup**: Old checkpoints accumulate
- **Graph consistency required**: Workflow code changes may break resume
- **MemoryChannel not portable**: Use RedisChannel for multi-worker scenarios
