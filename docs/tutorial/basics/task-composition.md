---
sidebar_position: 3
---

# Task Composition

Learn how to combine tasks using `>>` (sequential) and `|` (parallel) operators.

## Combining Sequential and Parallel

```python
with workflow("composition") as wf:
    @task
    def start():
        print("Start")

    @task
    def parallel_a():
        print("Parallel A")

    @task
    def parallel_b():
        print("Parallel B")

    @task
    def end():
        print("End")

    # Pattern: start → (parallel_a | parallel_b) → end
    start >> (parallel_a | parallel_b) >> end

    wf.execute()
```

**Execution Flow:**
1. `start` runs first
2. `parallel_a` and `parallel_b` run concurrently
3. `end` runs after both parallel tasks finish

**Output:**
```
Start
Parallel A
Parallel B
End
```

**Operators:**
- `>>` creates sequential dependencies (run in order)
- `|` creates parallel execution (run concurrently)
- Use parentheses to group: `(task_a | task_b)`

**Key Takeaways:**
- `task_a >> task_b` means "run a, then run b"
- `task_a | task_b` means "run a and b concurrently"
- Mix operators for complex patterns: `a >> (b | c) >> d`

## Helper Functions: chain() and parallel()

For creating sequences and groups with multiple tasks, use the helper functions:

```python
from graflow.core.task import chain, parallel

with workflow("helpers") as wf:
    @task
    def task_a():
        print("A")

    @task
    def task_b():
        print("B")

    @task
    def task_c():
        print("C")

    @task
    def task_d():
        print("D")

    # Using chain(*tasks) - equivalent to task_a >> task_b >> task_c
    seq = chain(task_a, task_b, task_c)

    # Using parallel(*tasks) - equivalent to task_a | task_b | task_c
    par = parallel(task_a, task_b, task_c)

    # Combine them
    _pipeline = seq >> par

    wf.execute()
```

**Function signatures:**
- `chain(*tasks)` - Takes 1 or more tasks as separate arguments
- `parallel(*tasks)` - Takes 2 or more tasks as separate arguments

**When to use:**
- `chain(*tasks)`: Cleaner when chaining 3+ tasks
- `parallel(*tasks)`: Cleaner when grouping 3+ tasks
- Operators (`>>`, `|`): More readable for 2 tasks or mixed patterns

## Dynamic Task Lists

If you have tasks in a list, unpack them:

```python
task_list = [task_a, task_b, task_c, task_d]

# Unpack the list into parallel()
parallel_group = parallel(*task_list)

# Or use operators in a loop
group = task_list[0]
for task in task_list[1:]:
    group = group | task
```

## Configuring Parallel Groups

Parallel groups can be customized with names and execution policies:

```python
with workflow("configured") as wf:
    @task
    def task_a():
        print("A")

    @task
    def task_b():
        print("B")

    @task
    def task_c():
        print("C")

    # Create parallel group with custom name
    group = (task_a | task_b | task_c).set_group_name("my_parallel_tasks")

    # Configure execution policy
    group.with_execution(policy="best_effort")  # Continue even if some tasks fail

    wf.execute()
```

**Available execution policies:**

| Policy | Behavior |
|--------|----------|
| `"strict"` (default) | All tasks must succeed, fail if any fails |
| `"best_effort"` | Continue even if tasks fail, collect results |
| `AtLeastNGroupPolicy(min_success=N)` | At least N tasks must succeed |
| `CriticalGroupPolicy(critical_task_ids=[...])` | Specific tasks must succeed |

**Example: Best-effort parallel execution**

```python
# Continue workflow even if some parallel tasks fail
(fetch_api | fetch_db | fetch_cache).with_execution(policy="best_effort")
```
