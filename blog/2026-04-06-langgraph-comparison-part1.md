---
slug: langgraph-vs-graflow-part1
title: "Graflow vs LangGraph Part 1: Design Philosophy and Core Workflow Features"
authors: [graflow]
tags: [comparison, tutorial]
---

A side-by-side comparison of LangGraph and Graflow, covering design philosophy, graph definition, parallelism, data sharing, and dynamic control flow.

<!-- truncate -->

## Introduction

Autonomous coding agents like Claude Code (including [Cowork](https://docs.anthropic.com/en/docs/claude-code/cowork)) and OpenClaw are gaining traction. However, in enterprise environments — where compliance, approval flows, and audit trails are non-negotiable — fully autonomous agents rarely work out of the box. The realistic middle ground is **Agentic Workflow**: AI handles the processing while humans make decisions at key checkpoints.

This three-part series compares [LangGraph](https://langchain-ai.github.io/langgraph/) and [Graflow](https://graflow.ai/) for building agentic workflows. Part 1 covers design philosophy and core workflow features.

**Series overview:**
- **Part 1** (this post): Design philosophy, graph definition, parallelism, data sharing, branching & loops
- **[Part 2](/blog/langgraph-vs-graflow-part2)**: Production features — HITL, checkpointing, error policies, distributed execution, task handlers
- **[Part 3](/blog/langgraph-vs-graflow-part3)**: LLM integration, tracing, hands-on example, and summary

---

## Five Walls You Hit with LangGraph

LangGraph is a capable framework, but production use reveals friction points that Graflow was designed to address.

### Wall 1: Verbose Graph Definitions

LangGraph requires `add_node` → `add_edge` → `compile` — three steps, and the edge count grows with every node.

```python
# LangGraph: 5 lines
graph.add_edge(START, "fetch")
graph.add_edge("fetch", "transform_a")
graph.add_edge("fetch", "transform_b")
graph.add_edge("transform_a", "store")
graph.add_edge("transform_b", "store")

# Graflow: 1 line
fetch >> (transform_a | transform_b) >> store
```

> **Why is LangGraph verbose?** It needs to support cyclic graphs (loops), which DAG syntax can't express. Graflow handles loops via runtime dynamic control instead (see Wall 2), keeping graph definitions as clean DAGs.

### Wall 2: Branching and Loops Must Be Pre-Defined

`add_conditional_edges` requires all branch paths to be declared at compile time.

```python
# LangGraph: routing function + pre-defined branch targets
graph.add_conditional_edges(
    "evaluate", route_after_eval,
    {"publish": "publish", "retry": "retry", "fallback": "fallback"}
)
graph.add_edge("retry", "generate")  # loop must be pre-defined too

# Graflow: runtime dynamic control
@task(inject_context=True)
def evaluate(context: TaskExecutionContext, row):
    if row["score"] >= 0.8:
        context.next_task(publish_task)
    elif row["retry_count"] < 3:
        context.next_iteration()        # self-loop
    else:
        context.next_task(fallback_task)
```

### Wall 3: No User-Controlled Checkpointing

LangGraph auto-saves checkpoints at every step. This is heavy (full State serialization + storage write) and there's no way to control when saves happen. Graflow lets you **explicitly checkpoint at important points only** via `context.checkpoint()`.

### Wall 4: No Distributed Execution

LangGraph runs in a single process. Parallelism is limited to in-process thread parallelism via `Send`. [LangGraph Platform](https://langchain-ai.github.io/langgraph/concepts/langgraph_platform/) hosts workflows but is not a task-level distribution engine.

Graflow ships with **Redis-based distributed workers** as a standard OSS feature, similar to Apache Airflow's Celery Executor. Switching from local to distributed execution is a one-line change.

### Wall 5: Locked into the LangChain Ecosystem

LangGraph sits atop a dependency chain: LangGraph → LangChain → `langchain-openai` / `langchain-anthropic` → LLM APIs. Switching providers requires adding packages and changing code.

Graflow breaks this chain with **LiteLLM integration** for provider-independent LLM access, and supports **Google ADK, PydanticAI**, and other SuperAgent frameworks directly ([Strands Agents support planned](https://github.com/GraflowAI/graflow/issues/44)).

---

## Design Philosophy: Define-and-Run vs Define-by-Run

The difference between LangGraph and Graflow mirrors the split between **TensorFlow 1.x (Define-and-Run)** and **PyTorch (Define-by-Run)** in deep learning.

**LangGraph: Define-and-Run**
1. Define all nodes, edges, and conditional edges upfront
2. `compile()` to freeze the graph
3. `invoke()` to execute

**Graflow: Define-by-Run ([DAG × State Machine Hybrid](https://graflow.ai/docs/getting-started/introduction#dynamic-transitions-at-runtime))**
1. `>>` / `|` operators define the DAG skeleton (static structure)
2. `next_task()` / `next_iteration()` enable runtime dynamic transitions (State Machine)
3. The graph is built as it executes

```python
# Static skeleton (DAG)
fetch >> (validate | enrich) >> process >> save

# Dynamic transitions (State Machine)
@task(inject_context=True)
def process(context: TaskExecutionContext):
    result = run_processing()
    if result.score < 0.8:
        context.next_iteration()                        # self-loop
    elif result.has_error:
        context.next_task(error_handler, goto=True)     # jump
    else:
        context.next_task(finalize_task)                # dynamic branch
```

This **"static readability + dynamic flexibility"** is the core of Graflow's developer experience.

### Concept Mapping

| LangGraph | Graflow | Role |
|---|---|---|
| State (`TypedDict`) | Channel (Key-Value store) | Data sharing |
| Node (function) | Task (`@task` decorator) | Processing unit |
| Edge (`add_edge`) | Operators (`>>`, `\|`) | Flow definition |
| `StateGraph` + `compile()` | `workflow()` context | Graph construction |
| `conditional_edges` | `next_task()` / `next_iteration()` | Branching & loops |
| Reducer (`Annotated`) | Channel `set` / `get` | State update method |

---

## 1. Your First Graph — No State Pre-Definition Required

### LangGraph

```python
from langgraph.graph import START, StateGraph
from typing_extensions import TypedDict

class State(TypedDict):
    text: str

def node_a(state: State) -> dict:
    return {"text": state["text"] + "a"}

def node_b(state: State) -> dict:
    return {"text": state["text"] + "b"}

graph = StateGraph(State)
graph.add_node("node_a", node_a)
graph.add_node("node_b", node_b)
graph.add_edge(START, "node_a")
graph.add_edge("node_a", "node_b")

compiled = graph.compile()
result = compiled.invoke({"text": ""})
print(result)  # {'text': 'ab'}
```

Four steps: (1) define State as TypedDict, (2) node functions take State and return update dicts, (3) build graph with `add_node`/`add_edge`, (4) `compile()` then `invoke()`.

### Graflow

```python
from graflow.core.context import TaskExecutionContext
from graflow.core.decorators import task
from graflow.core.workflow import workflow

with workflow("my_pipeline") as ctx:

    @task(inject_context=True)
    def task_a(context: TaskExecutionContext):
        channel = context.get_channel()
        text = channel.get("text", "")
        channel.set("text", text + "a")

    @task(inject_context=True)
    def task_b(context: TaskExecutionContext):
        channel = context.get_channel()
        text = channel.get("text", "")
        channel.set("text", text + "b")

    task_a >> task_b
    results = ctx.execute("task_a")
    print(results.channel.get("text"))  # 'ab'
```

Three steps: (1) `@task` to wrap functions, (2) `>>` for dependencies, (3) `ctx.execute()`. **No TypedDict, no `add_node`/`add_edge`, no `compile()` step.**

---

## 2. Parallel Execution — One Line for Structure

### LangGraph

```python
graph = StateGraph(State)
graph.add_node("fetch", fetch_fn)
graph.add_node("transform_a", transform_a_fn)
graph.add_node("transform_b", transform_b_fn)
graph.add_node("store", store_fn)

graph.add_edge(START, "fetch")
graph.add_edge("fetch", "transform_a")
graph.add_edge("fetch", "transform_b")
graph.add_edge("transform_a", "store")
graph.add_edge("transform_b", "store")

app = graph.compile()
```

### Graflow

```python
with workflow("diamond") as ctx:
    @task
    def fetch(): print("Fetching data")

    @task
    def transform_a(): print("Transform A")

    @task
    def transform_b(): print("Transform B")

    @task
    def store(): print("Storing")

    # Diamond pattern in one line
    fetch >> (transform_a | transform_b) >> store
    ctx.execute("fetch")
```

`>>` for sequential, `|` for parallel. **Diamond (Fan-out → Fan-in) in one line.** For dynamic task lists:

```python
from graflow.core.task import parallel

tasks = [create_task(i) for i in range(10)]
parallel(*tasks)  # 10 tasks in parallel
```

---

## 3. Data Sharing — No Reducers Needed

In LangGraph, all nodes share a single `State` (TypedDict) and you control update merging with Reducers. When parallel nodes update the same field, Reducers are **mandatory** — without them, you get: `"Already found path for node. For multiple edges, use StateGraph with an annotated state key."`

Graflow uses **Channels** (a key-value store) for explicit data reads and writes. No Reducers needed.

### LangGraph: State + Reducer

```python
from typing import Annotated
from langgraph.graph.message import add_messages

class State(TypedDict):
    messages: Annotated[list, add_messages]  # Reducer: append messages
    counter: int                              # No Reducer: overwrite
```

### Graflow: Channel

```python
@task(inject_context=True)
def producer(context: TaskExecutionContext):
    channel = context.get_channel()
    channel.set("config", {"batch_size": 100})
    channel.set("counter", 1)

@task(inject_context=True)
def consumer(context: TaskExecutionContext):
    channel = context.get_channel()
    config = channel.get("config")
    channel.set("counter", channel.get("counter") + 1)
```

The Channel API uses `set` / `get` / `delete` / `exists` — a standard key-value store interface familiar to anyone who has used Redis, Memcached, or Python dicts. Unlike LangGraph's `State` (TypedDict + Reducer + `Annotated`), there are no framework-specific concepts to learn.

### Concurrency-Safe Primitives

For parallel execution, Graflow provides thread-safe channel operations ([Concurrency Safety](https://graflow.ai/docs/concepts/channels#concurrency-safety)):

```python
@task(inject_context=True)
def safe_counter(context: TaskExecutionContext):
    channel = context.get_channel()

    # Atomic counter update (no lost updates)
    channel.atomic_add("processed_count", 1)

    # Thread-safe list operations (equivalent to LangGraph's add_messages Reducer)
    channel.append("logs", "Processing completed")
    channel.prepend("priority_queue", "urgent_item")

    # Advisory lock for compound read-modify-write
    with channel.lock("counter"):
        val = channel.get("counter")
        if val >= 100:
            channel.set("counter", 0)
            channel.atomic_add("overflow", 1)
        else:
            channel.set("counter", val + 1)
```

| Primitive | Use Case | MemoryChannel | RedisChannel |
|---|---|---|---|
| `append(key, value)` | Log collection, FIFO queues | GIL + `setdefault` | `RPUSH` (server-side atomic) |
| `prepend(key, value)` | Priority queues, LIFO stacks | GIL + `setdefault` | `LPUSH` (server-side atomic) |
| `atomic_add(key, amount)` | Counters, metrics, scores | per-key `RLock` | `INCRBYFLOAT` (server-side atomic) |
| `lock(key)` | Conditional updates, multi-key consistency | per-key `RLock` | Distributed lock (`SET NX` + Lua) |

LangGraph's Reducer is **implicit conflict avoidance declared in the State schema**. Graflow's approach is **explicit operations where you need them**. Start with zero overhead for serial workflows, add `atomic_add`, `append`, or `lock` only when parallelism requires it.

### Auto Keyword Argument Resolution

You don't even need `inject_context` for simple data passing:

```python
@task(inject_context=True)
def setup(context: TaskExecutionContext):
    channel = context.get_channel()
    channel.set("user_name", "Alice")
    channel.set("user_city", "Tokyo")

@task
def greet(user_name: str, user_city: str = "Unknown"):
    # No inject_context! Argument names auto-match channel keys
    print(f"Hello, {user_name} from {user_city}!")
```

Under the hood, Graflow inspects the task function's signature via `inspect.signature()` and auto-injects values from the Channel for matching argument names.

### MemoryChannel vs RedisChannel

LangGraph's State is an **in-memory dict** — single process only, lost on exit. Graflow's Channel supports **swappable backends**:

| Backend | Characteristics | Use Case |
|---|---|---|
| **MemoryChannel** (default) | Fast, no infra needed, auto-saved with checkpoints | Local dev & testing |
| **RedisChannel** | Shared across workers, persistent, large data support | Production, distributed execution |

The same API works for both — switch from local to distributed by changing one line.

---

## 4. Branching and Loops — No Pre-Definition Required

This is the biggest design difference between LangGraph and Graflow.

### LangGraph: Pre-define All Paths at Compile Time

```python
graph.add_conditional_edges(
    "process", should_retry,
    {"retry": "retry", "continue": "finalize"}
)
graph.add_edge("retry", "process")  # loop also pre-defined
app = graph.compile()               # structure frozen here
```

### Graflow: Runtime Dynamic Control

```python
@task(inject_context=True)
def process_data(context: TaskExecutionContext):
    result = run_processing()
    if result.score < 0.8:
        context.next_iteration()         # re-execute self
    else:
        context.next_task(finalize_task)  # proceed
```

**No need to pre-define paths.** Tasks themselves can be dynamically generated at runtime:

```python
@task(inject_context=True)
def process_directory(context: TaskExecutionContext):
    files = list_files()  # file count known only at runtime
    for file in files:
        context.next_task(
            TaskWrapper(f"process_{file}", lambda f=file: process_file(f))
        )
```

| Method | Behavior | Use Case |
|---|---|---|
| `next_task(task)` | Add a new task | Dynamic branching, Fan-out |
| `next_task(task, goto=True)` | Jump to existing task (skip successors) | Early exit, error handling |
| `next_iteration()` | Re-execute self | Convergence loops, polling |
| `terminate_workflow()` | Normal termination | Early completion |
| `cancel_workflow(reason)` | Abnormal termination | Error cancellation |

### Iteration Control and Retry

LangGraph can achieve iteration by pre-defining cycles with `add_conditional_edges`, managing a counter in State, and setting `recursion_limit`. It works, but requires three separate concerns to align.

Graflow makes this declarative:

```python
# Iteration: max 20 cycles, stop on convergence
@task(inject_context=True, max_cycles=20)
def optimize(ctx: TaskExecutionContext, data=None):
    loss = (data or {}).get("loss", 1.0) * 0.5
    if loss < 0.05:
        return  # converged → proceed to next task
    if ctx.can_iterate():
        ctx.next_iteration({"loss": loss})

# Retry: exponential backoff on exception
@task(retry_policy=RetryPolicy(max_retries=3, initial_interval=1.0, backoff_factor=2.0))
def call_api():
    return requests.get("https://api.example.com/data").json()
```

| Feature | LangGraph | Graflow |
|---|---|---|
| **Retry (on failure)** | `RetryPolicy` (on `add_node`) | `RetryPolicy` (on `@task`) + `default_max_retries` |
| **Iteration (intentional repetition)** | `add_conditional_edges` cycle + State counter + `recursion_limit` | `@task(max_cycles=N)` + `next_iteration()` |

See [Task Retries](https://graflow.ai/docs/tutorial/advanced/retries) and [Task Iterations](https://graflow.ai/docs/tutorial/advanced/iterations) for details.

---

## What's Next

In **[Part 2](/blog/langgraph-vs-graflow-part2)**, we cover production features: Human-in-the-Loop, checkpoint/resume, parallel error policies, distributed execution, and task handlers.

