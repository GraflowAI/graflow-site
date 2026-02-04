---
sidebar_position: 2
---

# Tasks

Tasks are the building blocks of workflows in Graflow — Python functions decorated with `@task`.

## Defining Tasks

### The @task Decorator

Convert any Python function into a Graflow task:

```python
from graflow.core.decorators import task

@task
def hello():
    """A simple task."""
    print("Hello, Graflow!")
    return "success"
```

**What happens:**
- `@task` converts a regular function into a Graflow task
- The task can be used in workflows or executed directly
- The function name becomes the default task ID

### Custom Task IDs

Specify a custom ID for the task:

```python
# Default: task_id is "hello"
@task
def hello():
    print("Hello!")

# Custom: task_id is "greeting_task"
@task(task_id="greeting_task")
def hello():
    print("Hello!")
```

### Type Hints

Always use type hints for better IDE support and documentation:

```python
@task
def calculate(x: int, y: int) -> int:
    """Add two numbers."""
    return x + y
```

## Task Instances

Create multiple instances from one task definition with different parameters.

### The Problem

Without task instances, you need to duplicate code:

```python
# Repetitive - avoid this
@task
def fetch_tokyo():
    return fetch("Tokyo")

@task
def fetch_paris():
    return fetch("Paris")
```

### The Solution

Create task instances with bound parameters:

```python
@task
def fetch_weather(city: str) -> str:
    return f"Weather for {city}"

# Create instances with different parameters
tokyo = fetch_weather(task_id="tokyo", city="Tokyo")
paris = fetch_weather(task_id="paris", city="Paris")
london = fetch_weather(task_id="london", city="London")

with workflow("weather") as wf:
    # Use instances in workflow
    tokyo >> paris >> london
    wf.execute()
```

### Auto-Generated Task IDs

Omit `task_id` for auto-generated unique IDs:

```python
@task
def process(value: int) -> int:
    return value * 2

# Auto-generated IDs: process_{random_uuid}
task1 = process(value=10)  # task_id: process_a3f2b9c1
task2 = process(value=20)  # task_id: process_b7e8f4d2
```

### Unique Task ID Requirement

Each task instance must have a unique `task_id`:

```python
# Good: Unique task_ids
tokyo = fetch_weather(task_id="tokyo", city="Tokyo")
paris = fetch_weather(task_id="paris", city="Paris")

# Bad: Duplicate task_ids cause conflicts
task1 = fetch_weather(task_id="fetch", city="Tokyo")
task2 = fetch_weather(task_id="fetch", city="Paris")  # ERROR!

# Good: Auto-generated IDs are always unique
task1 = fetch_weather(city="Tokyo")   # Auto: fetch_weather_a3f2b9c1
task2 = fetch_weather(city="Paris")   # Auto: fetch_weather_b7e8f4d2
```

## Testing Tasks

### Direct Execution with .run()

Test tasks in isolation using `.run()`:

```python
@task
def calculate(x: int, y: int) -> int:
    """Add two numbers."""
    return x + y

# Test the task directly
result = calculate.run(x=5, y=3)
print(result)  # Output: 8
```

**When to use `.run()`:**
- Unit testing individual tasks
- Quick verification of task logic
- Debugging task behavior
- **Not** for production workflows (use `workflow.execute()`)

### Testing with Parameters

```python
@task
def process_data(data: list[int], multiplier: int = 2) -> list[int]:
    """Process data with a multiplier."""
    return [x * multiplier for x in data]

# Test with different parameters
result1 = process_data.run(data=[1, 2, 3])
print(result1)  # [2, 4, 6]

result2 = process_data.run(data=[1, 2, 3], multiplier=3)
print(result2)  # [3, 6, 9]
```

## Dependency Injection

Graflow provides automatic dependency injection for common resources.

### Context Injection

Access channels, results, and workflow control:

```python
from graflow.core.context import TaskExecutionContext

@task(inject_context=True)
def my_task(ctx: TaskExecutionContext, value: int):
    # Access channel
    channel = ctx.get_channel()
    channel.set("result", value * 2)

    # Access session info
    print(f"Session: {ctx.session_id}")

    # Access other task results
    previous = ctx.get_result("previous_task")

    return value * 2
```

### LLM Client Injection

Direct LLM API calls without agent loops:

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

### LLM Agent Injection

Full-featured agent with ReAct loops and tools:

```python
from graflow.llm.agents.base import LLMAgent

# Register agent first
context.register_llm_agent("supervisor", my_agent)

@task(inject_llm_agent="supervisor")
def supervise_task(agent: LLMAgent, query: str) -> str:
    result = agent.run(query)
    return result["output"]
```

### Injection Summary

| Injection Type | Parameter | Use Case |
|----------------|-----------|----------|
| `inject_context=True` | `ctx: TaskExecutionContext` | Channels, workflow control, results |
| `inject_llm_client=True` | `llm: LLMClient` | Simple LLM API calls |
| `inject_llm_agent="name"` | `agent: LLMAgent` | Complex agent tasks with tools |

## Parameter Resolution

When resolving parameters, Graflow uses this priority (highest wins):

```
Injection > Bound > Channel
   (ctx)    (task_id)  (initial_channel)
```

**Example:**

```python
@task
def calculate(value: int, multiplier: int) -> int:
    return value * multiplier

# Bind value=10, multiplier from channel
task = calculate(task_id="calc", value=10)

wf.execute(initial_channel={"value": 100, "multiplier": 5})
# Result: 10 × 5 = 50 (bound value=10 beats channel value=100)
```

## Best Practices

### Use Task Instances for Reusability

```python
# Good - Reusable task definition
@task
def fetch_data(source: str):
    return fetch(source)

api = fetch_data(task_id="api", source="api")
db = fetch_data(task_id="db", source="database")

# Avoid - Duplicated definitions
@task
def fetch_api():
    return fetch("api")

@task
def fetch_db():
    return fetch("database")
```

### Inject Context Only When Needed

```python
# Simple computation - no context needed
@task
def add(x: int, y: int) -> int:
    return x + y

# Inter-task communication - needs context
@task(inject_context=True)
def share_data(ctx: TaskExecutionContext, value: int):
    ctx.get_channel().set("shared", value)
```

### Use Descriptive Task IDs

```python
# Good - Clear and descriptive
fetch_user_profile = fetch(task_id="fetch_user_profile")
validate_email = validate(task_id="validate_email")

# Avoid - Generic names
task1 = fetch(task_id="t1")
task2 = validate(task_id="t2")
```

## Next Steps

- Learn about [Channels](./channels) for inter-task communication
- Explore [Execution](./execution) patterns for dynamic control flow
