---
sidebar_position: 1
---

# Introduction

**Graflow** is the orchestration engine for production-grade agentic workflows, designed to be **reliable**, **explainable**, and **scalable**.

Building AI agents for PoCs is easy, but operating them reliably in production is hard — handling failures gracefully, handling errors and exceptions, scaling solutions for fleets of agents, and maintaining visibility into what's happening. Graflow bridges this gap with built-in checkpointing and flexible error handling policies (reliable), full observability (explainable), and horizontal scaling (scalable), helping you move from fragile prototypes to robust, scalable agent fleets with a great **developer experience**.

## Overview

At its core, Graflow combines an intuitive Pythonic DSL with production-grade capabilities — dynamic task generation, distributed execution, checkpointing, and human-in-the-loop support.

The key innovation is its **DAG × State Machine hybrid design**: define the workflow skeleton with pythonic DSLs (`>>`, `|`), then use `next_task()` and `next_iteration()` for runtime dynamic transitions. This achieves both static readability and dynamic flexibility, as demonstrated in the video below:

Watch the 10-minute introduction to see Graflow in action:

<iframe width="100%" style={{aspectRatio: '16/9'}} src="https://www.youtube.com/embed/OkJlpmdCCAg" title="Graflow Overview" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>

For detailed feature descriptions, see [Key Features](./features).

## Quick Example

### Static Workflow with Pythonic DSLs

Define workflows using simple operators: `>>` for sequential execution, `|` for parallel execution.

```python
from graflow import task, workflow

@task
def extract():
    return {"data": [1, 2, 3]}

@task
def transform(data):
    return [x * 2 for x in data["data"]]

@task
def load(data):
    print(f"Loaded: {data}")

# Define workflow with operators — no add_node()/add_edge() needed
with workflow("etl_pipeline") as wf:
    extract >> transform >> load
    wf.execute()
```

:::note
Note Graflow also provides low-level APIs to define task graphs as well. See the [Reference](/docs/reference/configuration) for details.
:::

### Dynamic Transitions at Runtime

Traditional DAG-based systems cannot express cycles by definition. With Graflow's **State Machine execution**, cycles and dynamic branching become natural:

```python
@task(inject_context=True)
def process_data(context: TaskExecutionContext):
    result = run_processing()

    if result.score < 0.8:
        context.next_iteration()  # Self-loop: retry until threshold met (cycle!)
    elif result.has_error:
        # Jump to existing handler — no add_conditional_edges() needed
        handler = context.graph.get_node("error_handler")
        context.next_task(handler, goto=True)  # Skip successors, jump directly
    else:
        context.next_task(finalize_task)

@task
def error_handler():
    print("Handling error, sending alert...")
    # Recovery logic here

with workflow("processing_pipeline") as wf:
    process_data >> finalize_task  # Static skeleton
    # error_handler is defined but not in the main flow
    # — it's reachable only via dynamic goto
    wf.execute()
```

This is the **DAG × State Machine hybrid** in action: define the static skeleton with operators, then use runtime transitions for cycles and dynamic branching that pure DAGs cannot express.

## When to Use Graflow

Graflow is the pragmatic choice for production AI:

- **Agentic Workflows** — Orchestrate AI agents with reliability, observability, and human oversight
- **Dynamic Workflows** — Conditional execution, convergence algorithms, adaptive processing
- **Long-Running Tasks** — ML training pipelines with checkpoints, approval workflows
- **Distributed Processing** — Horizontal scaling, specialized workers (GPU, high-memory)
- **Data Pipelines** — ETL workflows, batch processing, data analytics

## Next Steps

Ready to get started? Continue to the [Installation](./installation) guide.
