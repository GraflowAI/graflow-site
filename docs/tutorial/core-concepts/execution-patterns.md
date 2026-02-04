---
sidebar_position: 3
---

# Execution Patterns

Learn how to get results and control workflow execution.

## Understanding Task Results

When tasks return values, Graflow stores them in the channel using the task's `task_id`:

```python
# Auto-generated task_id (function name)
@task
def calculate():
    return 42

# Stored as: channel.set("calculate.__result__", 42)
# Access: ctx.get_result("calculate") → 42

# Custom task_id
task1 = calculate(task_id="calc1")
task2 = calculate(task_id="calc2")

# Stored as: channel.set("calc1.__result__", 42)
#            channel.set("calc2.__result__", 42)
# Access: ctx.get_result("calc1"), ctx.get_result("calc2")
```

**Result storage format:** `{task_id}.__result__`

## Pattern 1: Get Final Result

```python
with workflow("simple") as wf:
    @task
    def compute():
        return 42

    result = wf.execute()
    print(result)  # 42 (last task's return value)
```

## Pattern 2: Get All Results

Get results from all tasks using execution context:

```python
with workflow("all_results") as wf:
    @task
    def task_a():
        return "A"

    @task
    def task_b():
        return "B"

    task_a >> task_b

    # Get execution context to access all results
    _, ctx = wf.execute(ret_context=True)

    # Access individual task results
    print(ctx.get_result("task_a"))  # Output: A
    print(ctx.get_result("task_b"))  # Output: B
```

**Key Points:**
- `ret_context=True` returns tuple: `(final_result, execution_context)`
- Use `ctx.get_result(task_id)` to get any task's result
- Results are automatically stored when tasks return values

## Pattern 3: Start from Specific Task

### Auto-Detection (No argument)

When you call `wf.execute()` without arguments, Graflow automatically finds the start node:

```python
with workflow("auto_start") as wf:
    @task
    def step1():
        print("Step 1")

    @task
    def step2():
        print("Step 2")

    step1 >> step2

    # Auto-detects step1 (node with no predecessors)
    wf.execute()
```

**How auto-detection works:**
1. Finds all nodes with **no incoming edges** (no predecessors)
2. If **exactly one** node found → use it as start node
3. If **none** found → raises `GraphCompilationError`
4. If **multiple** found → raises `GraphCompilationError`

### Multiple Entry Points

```python
with workflow("ambiguous") as wf:
    @task
    def task_a():
        print("A")

    @task
    def task_b():
        print("B")

    @task
    def task_c():
        print("C")

    # Two separate chains - two entry points!
    task_a >> task_c
    task_b >> task_c

    # ERROR: Multiple start nodes found (task_a and task_b)
    # wf.execute()  # Raises GraphCompilationError

    # Solution: Specify start node explicitly
    wf.execute(start_node="task_a")
```

### Manual Start Node

Skip earlier tasks by specifying a start node:

```python
with workflow("skip") as wf:
    @task
    def step1():
        print("Step 1")

    @task
    def step2():
        print("Step 2")

    @task
    def step3():
        print("Step 3")

    step1 >> step2 >> step3

    # Start from step2 (skip step1)
    wf.execute(start_node="step2")
```

**Output:**
```
Step 2
Step 3
```

**Key Takeaways:**
- `wf.execute()` auto-detects start node (node with no predecessors)
- Raises error if zero or multiple start nodes found
- `wf.execute(start_node="task_id")` explicitly sets start point
- `wf.execute(ret_context=True)` returns `(result, context)`
- Use `ctx.get_result(task_id)` to get specific task results
