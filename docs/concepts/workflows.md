---
sidebar_position: 1
---

# Workflows

A workflow is the fundamental unit of execution in Graflow — a collection of tasks connected by dependencies.

## Creating a Workflow

Use the `workflow()` context manager to define workflows:

```python
from graflow.core.workflow import workflow
from graflow.core.decorators import task

with workflow("my_workflow") as wf:
    @task
    def start():
        print("Starting!")

    @task
    def process():
        print("Processing!")

    @task
    def finish():
        print("Finishing!")

    # Connect tasks: start → process → finish
    start >> process >> finish

    # Execute the workflow
    wf.execute()
```

**Output:**
```
Starting!
Processing!
Finishing!
```

## Task Composition Operators

Graflow provides intuitive operators for connecting tasks:

### Sequential Execution: `>>`

Run tasks in order:

```python
# task_a runs first, then task_b, then task_c
task_a >> task_b >> task_c
```

### Parallel Execution: `|`

Run tasks concurrently:

```python
# task_a and task_b run at the same time
task_a | task_b
```

### Combined Patterns

Mix operators for complex workflows:

```python
with workflow("complex_flow") as wf:
    @task
    def fetch():
        print("Fetching data")

    @task
    def validate():
        print("Validating")

    @task
    def enrich():
        print("Enriching")

    @task
    def save():
        print("Saving")

    # fetch → (validate | enrich) → save
    fetch >> (validate | enrich) >> save

    wf.execute()
```

**Execution Flow:**
1. `fetch` runs first
2. `validate` and `enrich` run concurrently
3. `save` runs after both parallel tasks complete

## Helper Functions

For dynamic task lists or improved readability:

```python
from graflow.core.task import chain, parallel

# Equivalent to: task_a >> task_b >> task_c
chain(task_a, task_b, task_c)

# Equivalent to: task_a | task_b | task_c
parallel(task_a, task_b, task_c)

# Dynamic task lists
tasks = [create_task(i) for i in range(10)]
parallel(*tasks)  # Run 10 tasks in parallel
```

## Workflow Execution

### Basic Execution

```python
with workflow("example") as wf:
    task_a >> task_b

    # Auto-detects start node and executes
    result = wf.execute()
```

### Start from Specific Task

Skip earlier tasks by specifying a start node:

```python
with workflow("skip_example") as wf:
    step1 >> step2 >> step3

    # Start from step2 (skip step1)
    wf.execute(start_node="step2")
```

### Get All Task Results

Use `ret_context=True` to access results from all tasks:

```python
with workflow("results_example") as wf:
    @task
    def task_a():
        return "Result A"

    @task
    def task_b():
        return "Result B"

    task_a >> task_b

    # Get execution context
    _, ctx = wf.execute(ret_context=True)

    # Access individual task results
    print(ctx.get_result("task_a"))  # "Result A"
    print(ctx.get_result("task_b"))  # "Result B"
```

### Initial Parameters

Pass initial values via channels:

```python
with workflow("params_example") as wf:
    @task
    def greet(name: str):
        return f"Hello, {name}!"

    wf.execute(initial_channel={"name": "Alice"})
```

## Configuring Parallel Groups

### Group Names

Give parallel groups meaningful names for logging and visualization:

```python
group = (task_a | task_b | task_c).set_group_name("data_fetches")
```

### Execution Policies

Control failure handling in parallel groups:

```python
from graflow.core.handlers.group_policy import (
    BestEffortGroupPolicy,
    AtLeastNGroupPolicy,
    CriticalGroupPolicy
)

# Continue even if some tasks fail
(task_a | task_b | task_c).with_execution(
    policy=BestEffortGroupPolicy()
)

# Require at least 2 successful tasks
(task_a | task_b | task_c | task_d).with_execution(
    policy=AtLeastNGroupPolicy(min_success=2)
)

# Only specified tasks must succeed
(extract | validate | enrich).with_execution(
    policy=CriticalGroupPolicy(critical_task_ids=["extract", "validate"])
)
```

| Policy | Behavior |
|--------|----------|
| **Strict** (default) | All tasks must succeed |
| **BestEffort** | Continue even if tasks fail |
| **AtLeastN** | At least N tasks must succeed |
| **Critical** | Only specified tasks must succeed |

## Low-Level TaskGraph API

The high-level `workflow()` context manager and operators (`>>`, `|`) are the recommended way to build workflows. However, Graflow also provides a **low-level TaskGraph API** for programmatic graph construction — similar to how [LangGraph](https://langchain-ai.github.io/langgraph/) lets you define agent workflows as explicit graph structures.

This is useful when you need:

- **Dynamic graph construction** based on runtime conditions or external configuration
- **Fine-grained control** over nodes and edges
- **Integration with external workflow definitions** (e.g., migrating from Airflow, Prefect)
- **Graph inspection and analysis** before execution

### Example: Diamond Pattern

```python
from graflow.core.context import ExecutionContext
from graflow.core.engine import WorkflowEngine
from graflow.core.graph import TaskGraph
from graflow.core.task import TaskWrapper

# Define tasks
fetch = TaskWrapper("fetch", func=lambda: print("Fetching data..."), register_to_context=False)
transform_a = TaskWrapper("transform_a", func=lambda: print("Transform A..."), register_to_context=False)
transform_b = TaskWrapper("transform_b", func=lambda: print("Transform B..."), register_to_context=False)
store = TaskWrapper("store", func=lambda: print("Storing results..."), register_to_context=False)

# Build graph explicitly
graph = TaskGraph()
graph.add_node(fetch, "fetch")
graph.add_node(transform_a, "transform_a")
graph.add_node(transform_b, "transform_b")
graph.add_node(store, "store")

graph.add_edge("fetch", "transform_a")
graph.add_edge("fetch", "transform_b")
graph.add_edge("transform_a", "store")
graph.add_edge("transform_b", "store")

# Execute
context = ExecutionContext.create(graph, "fetch", max_steps=10)
engine = WorkflowEngine()
engine.execute(context)
```

This is equivalent to the high-level version:

```python
fetch >> (transform_a | transform_b) >> store
```

:::tip
You can also mix both approaches — build an initial workflow with the high-level API, then modify the underlying graph programmatically:

```python
with workflow("mixed") as wf:
    task_a >> task_b

    # Access the underlying graph and extend it
    graph = wf.graph
    task_c = TaskWrapper("task_c", func=lambda: print("Task C"), register_to_context=False)
    graph.add_node(task_c, "task_c")
    graph.add_edge("task_b", "task_c")

    wf.execute()
```
:::

For more examples, see the [Low-Level TaskGraph API example](https://github.com/GraflowAI/graflow/blob/main/examples/02_workflows/task_graph_lowlevel_api.py).

## Next Steps

- Learn about [Tasks](./tasks) and how to define them
- Understand [Channels](./channels) for inter-task communication
- Explore [Execution](./execution) patterns for dynamic control flow
