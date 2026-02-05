---
sidebar_position: 3
---

# Complex Workflows

Learn advanced patterns like diamond and multi-instance pipelines.

## Diamond Pattern

One task splits into parallel branches, then merges:

```python
@task(inject_context=True)
def source(ctx: TaskExecutionContext, value: int) -> int:
    ctx.get_channel().set("value", value)
    return value

@task(inject_context=True)
def double(ctx: TaskExecutionContext) -> int:
    value = ctx.get_channel().get("value")
    result = value * 2
    ctx.get_channel().set("doubled", result)
    return result

@task(inject_context=True)
def triple(ctx: TaskExecutionContext) -> int:
    value = ctx.get_channel().get("value")
    result = value * 3
    ctx.get_channel().set("tripled", result)
    return result

@task(inject_context=True)
def combine(ctx: TaskExecutionContext) -> int:
    doubled = ctx.get_channel().get("doubled")
    tripled = ctx.get_channel().get("tripled")
    return doubled + tripled

with workflow("diamond") as wf:
    src = source(task_id="src", value=5)

    # Diamond: src → (double | triple) → combine
    src >> (double | triple) >> combine

    result = wf.execute(start_node="src")
    print(result)  # Output: 25 (5*2 + 5*3)
```

**Execution flow:**
```
       source(5)
          │
    ┌─────┴─────┐
    │           │
double(10)  triple(15)
    │           │
    └─────┬─────┘
          │
     combine(25)
```

## Multi-Instance Pipeline

Process multiple items in parallel:

```python
@task
def fetch(source: str) -> dict:
    return {"source": source, "data": f"data_{source}"}

@task
def process(data: dict) -> str:
    return f"Processed {data['source']}"

with workflow("multi_pipeline") as wf:
    # Create instances
    fetch_a = fetch(task_id="fetch_a", source="api")
    fetch_b = fetch(task_id="fetch_b", source="db")
    fetch_c = fetch(task_id="fetch_c", source="file")

    # Run in parallel
    all_fetches = fetch_a | fetch_b | fetch_c

    _, ctx = wf.execute(
        start_node=all_fetches.task_id,
        ret_context=True
    )

    # Get results
    for task_id in ["fetch_a", "fetch_b", "fetch_c"]:
        print(ctx.get_result(task_id))
```

**Key Pattern:** Create task instances → Combine with `|` → Execute in parallel

## Fan-Out / Fan-In Pattern

```python
@task(inject_context=True)
def distribute(ctx: TaskExecutionContext, items: list):
    """Fan-out: Store items for parallel processing."""
    channel = ctx.get_channel()
    for i, item in enumerate(items):
        channel.set(f"item_{i}", item)
    channel.set("item_count", len(items))

@task(inject_context=True)
def process_item(ctx: TaskExecutionContext, index: int):
    """Process a single item."""
    channel = ctx.get_channel()
    item = channel.get(f"item_{index}")
    result = f"processed_{item}"
    channel.append("results", result)
    return result

@task(inject_context=True)
def aggregate(ctx: TaskExecutionContext):
    """Fan-in: Collect all results."""
    channel = ctx.get_channel()
    results = channel.get("results", default=[])
    return {"total": len(results), "items": results}

with workflow("fan_out_fan_in") as wf:
    dist = distribute(task_id="dist", items=["a", "b", "c"])

    # Create parallel processors
    p0 = process_item(task_id="p0", index=0)
    p1 = process_item(task_id="p1", index=1)
    p2 = process_item(task_id="p2", index=2)

    # Fan-out → parallel processing → fan-in
    dist >> (p0 | p1 | p2) >> aggregate

    result = wf.execute()
    print(result)  # {"total": 3, "items": ["processed_a", "processed_b", "processed_c"]}
```

## Pipeline with Conditional Branches

```python
@task(inject_context=True)
def validate(ctx: TaskExecutionContext, data: dict):
    """Validate input and set flag."""
    channel = ctx.get_channel()
    is_valid = data.get("valid", False)
    channel.set("is_valid", is_valid)
    channel.set("data", data)
    return is_valid

@task(inject_context=True)
def process_valid(ctx: TaskExecutionContext):
    """Process valid data."""
    data = ctx.get_channel().get("data")
    return {"status": "processed", "data": data}

@task(inject_context=True)
def handle_invalid(ctx: TaskExecutionContext):
    """Handle invalid data."""
    data = ctx.get_channel().get("data")
    return {"status": "rejected", "data": data}

@task(inject_context=True)
def router(ctx: TaskExecutionContext):
    """Route based on validation result."""
    is_valid = ctx.get_channel().get("is_valid")
    if is_valid:
        valid_task = ctx.graph.get_node("process_valid")
        ctx.next_task(valid_task, goto=True)
    else:
        invalid_task = ctx.graph.get_node("handle_invalid")
        ctx.next_task(invalid_task, goto=True)

with workflow("conditional") as wf:
    val = validate(task_id="validate", data={"valid": True, "value": 42})
    val >> router

    wf.execute()
```
