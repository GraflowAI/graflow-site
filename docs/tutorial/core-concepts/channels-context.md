---
sidebar_position: 2
---

# Channels and Context

Learn inter-task communication, dependency injection, and prompt management.

## Channel Backends

Graflow supports two backends for seamless local-to-distributed transition:

**1. MemoryChannel (Default)** - For local execution:
- Fast: In-memory, minimal latency
- Simple: No infrastructure required
- Checkpoint-compatible: Auto-saved with checkpoints
- Limitation: Single process only

**2. RedisChannel** - For distributed execution:
- Distributed: Share state across workers/machines
- Persistent: Redis persistence for fault tolerance
- Scalable: Consistent data across many workers
- Requires: Redis server

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

## Working with Channels

### Basic Channel: ctx.get_channel()

Access the basic channel for simple key-value storage:

```python
@task(inject_context=True)
def producer(ctx: TaskExecutionContext):
    """Write data to channel."""
    channel = ctx.get_channel()

    # Store simple values
    channel.set("user_id", "user_123")
    channel.set("score", 95.5)
    channel.set("active", True)

    # Store complex objects
    channel.set("user_profile", {
        "name": "Alice",
        "email": "alice@example.com",
        "age": 30
    })

@task(inject_context=True)
def consumer(ctx: TaskExecutionContext):
    """Read data from channel."""
    channel = ctx.get_channel()

    # Retrieve values
    user_id = channel.get("user_id")        # "user_123"
    score = channel.get("score")            # 95.5
    active = channel.get("active")          # True
    profile = channel.get("user_profile")   # dict

    # With default value
    setting = channel.get("setting", default="default_value")
```

**Channel Methods:**

| Method | Description | Example |
|--------|-------------|---------|
| `set(key, value)` | Store a value | `channel.set("count", 42)` |
| `set(key, value, ttl)` | Store with expiration (seconds) | `channel.set("temp", 100, ttl=300)` |
| `get(key)` | Retrieve a value | `value = channel.get("count")` |
| `get(key, default)` | Retrieve with fallback | `value = channel.get("count", default=0)` |
| `append(key, value)` | Append to list | `channel.append("logs", "entry")` |
| `prepend(key, value)` | Prepend to list | `channel.prepend("queue", "item")` |
| `delete(key)` | Remove a key | `channel.delete("count")` |
| `exists(key)` | Check if key exists | `if channel.exists("count"):` |

### List Operations

Channels support list operations for collecting multiple values:

```python
@task(inject_context=True)
def collect_logs(ctx: TaskExecutionContext):
    channel = ctx.get_channel()

    # Append to end of list (FIFO queue)
    channel.append("logs", "Log entry 1")
    channel.append("logs", "Log entry 2")
    channel.append("logs", "Log entry 3")

    logs = channel.get("logs")
    print(logs)  # ["Log entry 1", "Log entry 2", "Log entry 3"]

@task(inject_context=True)
def use_stack(ctx: TaskExecutionContext):
    channel = ctx.get_channel()

    # Prepend to beginning of list (LIFO stack)
    channel.prepend("stack", "First")
    channel.prepend("stack", "Second")
    channel.prepend("stack", "Third")

    stack = channel.get("stack")
    print(stack)  # ["Third", "Second", "First"]
```

### Time-to-Live (TTL)

Use TTL to automatically expire temporary data:

```python
@task(inject_context=True)
def cache_data(ctx: TaskExecutionContext):
    channel = ctx.get_channel()

    # Cache for 5 minutes (300 seconds)
    channel.set("api_response", {"data": "..."}, ttl=300)

    # Temporary flag expires in 60 seconds
    channel.set("processing", True, ttl=60)
```

**TTL Behavior:**
- TTL is in **seconds**
- Key expires and is automatically deleted after TTL
- Calling `get()` on expired key returns `None` (or default value)

### Type-Safe Channel

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
    typed_channel = ctx.get_typed_channel(UserProfile)

    # IDE autocompletes fields!
    user_profile: UserProfile = {
        "user_id": "user_123",
        "name": "Alice",
        "email": "alice@example.com",
        "age": 30,
        "premium": True
    }

    typed_channel.set("current_user", user_profile)
```

## Dependency Injection

Graflow provides three types of dependency injection:

### 1. Context Injection

```python
@task(inject_context=True)
def my_task(ctx: TaskExecutionContext, value: int):
    channel = ctx.get_channel()
    channel.set("result", value * 2)
    return value * 2
```

### 2. LLM Client Injection

```python
from graflow.llm.client import LLMClient

@task(inject_llm_client=True)
def analyze_text(llm: LLMClient, text: str) -> str:
    response = llm.completion_text(
        messages=[{"role": "user", "content": f"Analyze: {text}"}],
        model="gpt-4o-mini"
    )
    return response
```

### 3. LLM Agent Injection

```python
from graflow.llm.agents.base import LLMAgent

# First, register the agent in workflow
context.register_llm_agent("supervisor", my_agent)

# Then inject into task
@task(inject_llm_agent="supervisor")
def supervise_task(agent: LLMAgent, query: str) -> str:
    result = agent.run(query)
    return result["output"]
```

| Injection Type | Parameter | Use Case |
|----------------|-----------|----------|
| `inject_context=True` | `ctx: TaskExecutionContext` | Channels, workflow control, results |
| `inject_llm_client=True` | `llm: LLMClient` | Simple LLM API calls |
| `inject_llm_agent="name"` | `agent: LLMAgent` | Complex agent tasks with tools |

## Prompt Management

Use `PromptManagerFactory` to create a prompt manager:

```python
from pathlib import Path
from graflow.prompts.factory import PromptManagerFactory

# Create YAML-based prompt manager
prompts_dir = Path(__file__).parent / "prompts"
pm = PromptManagerFactory.create("yaml", prompts_dir=str(prompts_dir))

# Or create Langfuse-based prompt manager
pm = PromptManagerFactory.create("langfuse")

# Pass to workflow
with workflow("my_workflow", prompt_manager=pm) as ctx:
    ...
```

**Using prompts in tasks:**

```python
@task(inject_context=True)
def greet(ctx: TaskExecutionContext) -> str:
    pm = ctx.prompt_manager

    # Get text prompt and render
    prompt = pm.get_text_prompt("greeting")
    return prompt.render(name="Alice", product="Graflow")

@task(inject_context=True)
def generate_conversation(ctx: TaskExecutionContext) -> list:
    pm = ctx.prompt_manager

    # Get chat prompt for LLM APIs
    prompt = pm.get_chat_prompt("assistant")
    messages = prompt.render(domain="Python", task="debugging")
    return messages
```
