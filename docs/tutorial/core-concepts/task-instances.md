---
sidebar_position: 1
---

# Task Instances

Create multiple instances from one task definition for reusability.

## The Problem

You want to reuse the same task logic with different parameters:

```python
# Without task instances (repetitive)
@task
def fetch_tokyo():
    return fetch("Tokyo")

@task
def fetch_paris():
    return fetch("Paris")
```

## The Solution

Create task instances with bound parameters:

```python
# With task instances (reusable)
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

**Output:**
```
Weather for Tokyo
Weather for Paris
Weather for London
```

## Auto-Generated Task IDs

Don't want to name every task? Omit `task_id`:

```python
@task
def process(value: int) -> int:
    return value * 2

# Auto-generated IDs: process_{random_uuid}
task1 = process(value=10)  # task_id: process_a3f2b9c1
task2 = process(value=20)  # task_id: process_b7e8f4d2
task3 = process(value=30)  # task_id: process_c5d9e6f7

with workflow("auto_ids") as wf:
    task1 >> task2 >> task3
    wf.execute()
```

## Ensure Unique Task IDs

When creating multiple task instances, make sure each has a unique `task_id`:

```python
# Good: Unique task_ids
tokyo = fetch_weather(task_id="tokyo", city="Tokyo")
paris = fetch_weather(task_id="paris", city="Paris")
london = fetch_weather(task_id="london", city="London")

# Bad: Duplicate task_ids cause conflicts
task1 = fetch_weather(task_id="fetch", city="Tokyo")
task2 = fetch_weather(task_id="fetch", city="Paris")  # ERROR: "fetch" already exists!

# Good: Auto-generated IDs are always unique
task1 = fetch_weather(city="Tokyo")   # Auto: fetch_weather_a3f2b9c1
task2 = fetch_weather(city="Paris")   # Auto: fetch_weather_b7e8f4d2
```

## Dynamic Instances with chain() and parallel()

```python
@task
def fetch_weather(city: str) -> dict:
    return {"city": city, "temp": 20}

@task
def process_batch(batch_id: int, data: list) -> dict:
    return {"batch_id": batch_id, "count": len(data)}

# Generate task instances dynamically
cities = ["Tokyo", "Paris", "London", "NYC"]
fetch_tasks = [
    fetch_weather(task_id=f"fetch_{city.lower()}", city=city)
    for city in cities
]

batches = [1, 2, 3]
process_tasks = [
    process_batch(task_id=f"batch_{i}", batch_id=i, data=[])
    for i in batches
]

with workflow("dynamic") as wf:
    # Use parallel() with task instances
    all_fetches = parallel(*fetch_tasks)

    # Use chain() with task instances
    all_batches = chain(*process_tasks)

    # Combine
    all_fetches >> all_batches

    wf.execute()
```

**Key Takeaways:**
- Task instances reuse task logic with different parameters
- Specify `task_id` for named instances (must be unique!)
- Omit `task_id` for auto-generated IDs (guaranteed unique)
- Each instance is independent
