---
sidebar_position: 1
---

# Your First Task

Learn the basics of creating tasks with the `@task` decorator.

## The @task Decorator

Convert any Python function into a Graflow task:

```python
from graflow.core.decorators import task

@task
def hello():
    """A simple task."""
    print("Hello, Graflow!")
    return "success"
```

**What just happened?**
- `@task` converts a regular function into a Graflow task
- The task can be used in workflows or executed directly

## Custom Task IDs

By default, the function name becomes the task ID. You can specify a custom ID:

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

**Key Takeaways:**
- Use `@task` to create tasks
- Default `task_id` is the function name
- Use `@task(task_id="custom_id")` for explicit naming

## Testing Tasks with .run()

Tasks can be executed directly using `.run()` for testing:

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
- Not for production workflows (use `workflow.execute()`)

**Example: Testing with parameters**

```python
@task
def process_data(data: list[int], multiplier: int = 2) -> list[int]:
    """Process data with a multiplier."""
    return [x * multiplier for x in data]

# Test with different parameters
result1 = process_data.run(data=[1, 2, 3])
print(result1)  # Output: [2, 4, 6]

result2 = process_data.run(data=[1, 2, 3], multiplier=3)
print(result2)  # Output: [3, 6, 9]
```

**Key Takeaway:** Use `.run()` to test tasks in isolation before using them in workflows.
