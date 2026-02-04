---
sidebar_position: 4
---

# Passing Parameters

Learn how to pass data between tasks using channels and parameter binding.

## Using Channels for Inter-Task Communication

Tasks communicate by reading and writing to a shared channel:

```python
from graflow.core.context import TaskExecutionContext

with workflow("channel_communication") as wf:
    @task(inject_context=True)
    def producer(ctx: TaskExecutionContext):
        channel = ctx.get_channel()
        channel.set("user_id", "user_123")

    @task(inject_context=True)
    def consumer(ctx: TaskExecutionContext):
        channel = ctx.get_channel()
        user_id = channel.get("user_id")
        print(f"User: {user_id}")

    producer >> consumer
    wf.execute()
```

## Partial Parameter Binding

You can bind some parameters at task creation, while others come from the channel:

```python
with workflow("partial_binding") as wf:
    @task
    def calculate(base: int, multiplier: int, offset: int) -> int:
        result = base * multiplier + offset
        print(f"calculate: {base} * {multiplier} + {offset} = {result}")
        return result

    # Bind only 'base', others come from channel
    task_instance = calculate(task_id="calc", base=10)

    # Execute with channel values for multiplier and offset
    _, ctx = wf.execute(
        ret_context=True,
        initial_channel={"multiplier": 3, "offset": 5}
    )

    result = ctx.get_result("calc")
    print(f"Result: {result}")
```

**Output:**
```
calculate: 10 * 3 + 5 = 35
Result: 35
```

**What happened:**
- `base=10` is bound at task creation (takes priority)
- `multiplier=3` and `offset=5` come from channel
- Bound parameters always override channel values

## Parameter Priority

When resolving parameters: **Injection > Bound > Channel**

```python
@task
def calculate(value: int, multiplier: int) -> int:
    return value * multiplier

# Bind value=10, multiplier from channel
task = calculate(task_id="calc", value=10)

wf.execute(initial_channel={"value": 100, "multiplier": 5})
# Result: 10 × 5 = 50 (bound value beats channel value)
```

**Key Takeaways:**
- Tasks can communicate via channels (see [Channels and Context](../core-concepts/channels-context) for details)
- Bind some parameters at task creation, let others come from channel
- Bound parameters have higher priority than channel values
