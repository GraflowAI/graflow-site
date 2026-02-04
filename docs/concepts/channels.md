---
sidebar_position: 3
---

# Channels

Channels enable inter-task communication and state sharing in Graflow workflows.

## Overview

Tasks communicate by reading and writing to a shared channel — a key-value store accessible via the execution context.

```python
from graflow.core.context import TaskExecutionContext

@task(inject_context=True)
def producer(ctx: TaskExecutionContext):
    channel = ctx.get_channel()
    channel.set("user_id", "user_123")

@task(inject_context=True)
def consumer(ctx: TaskExecutionContext):
    channel = ctx.get_channel()
    user_id = channel.get("user_id")
    print(f"User: {user_id}")  # "user_123"
```

## Channel Backends

Graflow supports two backends for seamless local-to-distributed transition:

### MemoryChannel (Default)

For local execution:

- Fast: In-memory, minimal latency
- Simple: No infrastructure required
- Checkpoint-compatible: Auto-saved with checkpoints
- **Limitation**: Single process only

### RedisChannel

For distributed execution:

- Distributed: Share state across workers/machines
- Persistent: Redis persistence for fault tolerance
- Scalable: Consistent data across many workers
- **Requires**: Redis server

**Switching backends:**

```python
# Local execution (default) - uses MemoryChannel
with workflow("local") as wf:
    task_a >> task_b
    wf.execute()

# Distributed execution - uses RedisChannel
from graflow.channels.factory import ChannelFactory, ChannelBackend

channel = ChannelFactory.create_channel(
    backend=ChannelBackend.REDIS,
    redis_client=redis_client
)

with workflow("distributed") as wf:
    task_a >> task_b
    wf.execute()
```

## Basic Channel Operations

### Set and Get

```python
@task(inject_context=True)
def basic_operations(ctx: TaskExecutionContext):
    channel = ctx.get_channel()

    # Store values
    channel.set("user_id", "user_123")
    channel.set("score", 95.5)
    channel.set("active", True)
    channel.set("profile", {"name": "Alice", "age": 30})

    # Retrieve values
    user_id = channel.get("user_id")        # "user_123"
    score = channel.get("score")            # 95.5
    active = channel.get("active")          # True
    profile = channel.get("profile")        # dict

    # With default value
    setting = channel.get("setting", default="default_value")
```

### List Operations

Channels support list operations for collecting multiple values:

```python
@task(inject_context=True)
def list_operations(ctx: TaskExecutionContext):
    channel = ctx.get_channel()

    # Append to end of list (FIFO queue)
    channel.append("logs", "Log entry 1")
    channel.append("logs", "Log entry 2")
    channel.append("logs", "Log entry 3")
    logs = channel.get("logs")  # ["Log entry 1", "Log entry 2", "Log entry 3"]

    # Prepend to beginning of list (LIFO stack)
    channel.prepend("stack", "First")
    channel.prepend("stack", "Second")
    channel.prepend("stack", "Third")
    stack = channel.get("stack")  # ["Third", "Second", "First"]
```

**Use cases:**
- `append()`: Build logs, collect results from parallel tasks, FIFO queues
- `prepend()`: LIFO stacks, priority items, reverse-order collection

### Time-to-Live (TTL)

Automatically expire temporary data:

```python
@task(inject_context=True)
def ttl_example(ctx: TaskExecutionContext):
    channel = ctx.get_channel()

    # Cache for 5 minutes (300 seconds)
    channel.set("api_response", {"data": "..."}, ttl=300)

    # Temporary flag expires in 60 seconds
    channel.set("processing", True, ttl=60)

    # Collect logs that expire after 10 minutes
    channel.append("recent_logs", "Error occurred", ttl=600)
```

**TTL Behavior:**
- TTL is in **seconds**
- Key expires and is automatically deleted after TTL
- Calling `get()` on expired key returns `None` (or default value)
- Useful for temporary caches, rate limiting, session data

### Channel Methods Reference

| Method | Description | Example |
|--------|-------------|---------|
| `set(key, value)` | Store a value | `channel.set("count", 42)` |
| `set(key, value, ttl)` | Store with expiration | `channel.set("temp", 100, ttl=300)` |
| `get(key)` | Retrieve a value | `value = channel.get("count")` |
| `get(key, default)` | Retrieve with fallback | `value = channel.get("count", default=0)` |
| `append(key, value)` | Append to list | `channel.append("logs", "entry")` |
| `prepend(key, value)` | Prepend to list | `channel.prepend("queue", "item")` |
| `delete(key)` | Remove a key | `channel.delete("count")` |
| `exists(key)` | Check if key exists | `if channel.exists("count"):` |

## Type-Safe Channels

Use typed channels for compile-time type checking and IDE autocomplete:

```python
from typing import TypedDict

class UserProfile(TypedDict):
    user_id: str
    name: str
    email: str
    age: int
    premium: bool

@task(inject_context=True)
def collect_user_data(ctx: TaskExecutionContext):
    # Get typed channel
    typed_channel = ctx.get_typed_channel(UserProfile)

    # IDE autocompletes fields!
    user_profile: UserProfile = {
        "user_id": "user_123",
        "name": "Alice",
        "email": "alice@example.com",
        "age": 30,
        "premium": True
    }

    # Type-checked storage
    typed_channel.set("current_user", user_profile)

@task(inject_context=True)
def process_user_data(ctx: TaskExecutionContext):
    typed_channel = ctx.get_typed_channel(UserProfile)

    # Retrieve with type hints
    user: UserProfile = typed_channel.get("current_user")

    # IDE knows the structure!
    print(user["name"])    # IDE autocompletes "name"
    print(user["email"])   # IDE autocompletes "email"
```

**Benefits of Typed Channels:**

- **IDE Autocomplete**: Field names and types suggested
- **Type Checking**: mypy/pyright catches type errors
- **Self-Documenting**: TypedDict serves as API contract
- **Refactoring Safety**: Rename fields with IDE support

### When to Use Each

| Use Case | Method | Why |
|----------|--------|-----|
| Simple values (strings, numbers) | `get_channel()` | Less overhead |
| Ad-hoc data exchange | `get_channel()` | No schema needed |
| Structured data | `get_typed_channel()` | Type safety |
| Team collaboration | `get_typed_channel()` | Shared schema |
| Large projects | `get_typed_channel()` | Maintainability |

## Task Results in Channels

When tasks return values, Graflow stores them in the channel automatically:

```python
@task
def calculate():
    return 42

# Stored as: channel.set("calculate.__result__", 42)
# Access: ctx.get_result("calculate") → 42
```

**Result storage format:** `{task_id}.__result__`

Access results using `ctx.get_result()`:

```python
@task(inject_context=True)
def use_previous_result(ctx: TaskExecutionContext):
    # Get result from another task
    previous = ctx.get_result("calculate")
    return previous * 2
```

## Collecting Parallel Task Results

Collect results from parallel tasks using channels:

```python
@task(inject_context=True)
def fetch_data(ctx: TaskExecutionContext, source: str):
    channel = ctx.get_channel()
    data = f"Data from {source}"

    # Collect results with 1-hour expiration
    channel.append("fetch_results", data, ttl=3600)

    return data

with workflow("collect_results") as wf:
    fetch_a = fetch_data(task_id="fetch_a", source="api")
    fetch_b = fetch_data(task_id="fetch_b", source="db")
    fetch_c = fetch_data(task_id="fetch_c", source="cache")

    parallel(fetch_a, fetch_b, fetch_c)

    _, ctx = wf.execute(ret_context=True)

    # All results collected in list
    results = ctx.get_channel().get("fetch_results")
    print(results)  # ["Data from api", "Data from db", "Data from cache"]
```

## Next Steps

- Explore [Execution](./execution) patterns for dynamic control flow
- Learn about [Human-in-the-Loop](./hitl) workflows
