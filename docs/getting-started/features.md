---
sidebar_position: 2
---

# Key Features

Graflow is designed from the ground up for production AI — combining simplicity with robust, scalable execution.

## Challenges Graflow Solves

Graflow addresses real-world pain points that developers encounter when building agentic workflows. Here's how Graflow solves each challenge:

### Challenge 1: Graph-based ReAct Loops Hurt Readability

**The Problem**: When SuperAgent internal reasoning loops (tool calls, retries) are expressed as graph nodes, workflow definitions become complex and hard to maintain.

**Graflow's Solution: Fat Node Design**

Graflow treats SuperAgents as **fat nodes** — self-contained tasks that encapsulate their internal logic. Instead of graphing every tool call, wrap existing agent frameworks:

```python
from graflow.llm.agents.adk_agent import AdkLLMAgent

# Wrap Google ADK agent
agent = AdkLLMAgent(adk_agent)
context.register_llm_agent("supervisor", agent)

# Use as a single task (fat node)
@task(inject_llm_agent="supervisor")
def supervise_task(agent: LLMAgent, query: str) -> str:
    result = agent.run(query)  # Internal ReAct loop hidden
    return result["output"]
```

**Benefits**: Use best-in-class agent frameworks (Google ADK, PydanticAI) while keeping workflow definitions clean and focused on task orchestration.

### Challenge 2: Pre-defined Branching Limits Runtime Flexibility

**The Problem**: Systems like LangGraph require defining all conditional edges at compile time. You can't dynamically adjust based on runtime conditions (file count, data quality, API responses).

**Graflow's Solution: Runtime Dynamic Transitions**

Write normal Python conditionals and generate tasks on-the-fly:

```python
@task(inject_context=True)
def process_data(context: TaskExecutionContext):
    result = run_processing()

    # Decide at runtime based on actual results
    if result.score < 0.8:
        context.next_iteration()  # Self-loop retry
    else:
        context.next_task(finalize_task())

@task(inject_context=True)
def process_directory(context: TaskExecutionContext):
    files = list_files()  # File count known only at runtime

    # Dynamically generate tasks based on actual data
    for file in files:
        context.next_task(process_file(file))
```

**Benefits**: No need to pre-define all paths. Handle variable file counts, data-driven branching, and adaptive processing naturally.

### Challenge 3: Long Workflows Crash and Restart from Scratch

**The Problem**: Auto-checkpoint-only systems don't let you control when to save state. A crash at epoch 90 means restarting from epoch 0.

**Graflow's Solution: User-Controlled Checkpoints**

Save state at critical points you choose:

```python
@task(inject_context=True)
def train_model(context):
    for epoch in range(100):
        train_one_epoch(epoch)

        if epoch % 10 == 0:
            # Checkpoint at important milestones
            context.checkpoint(
                path="/tmp/checkpoint",
                metadata={"epoch": epoch}
            )

# Resume from checkpoint
CheckpointManager.resume_from_checkpoint("/tmp/checkpoint")
```

**Benefits**: Crash at epoch 90? Resume from epoch 90. Supports local filesystem and S3.

### Challenge 4: Approval Waits Block Processes for Hours

**The Problem**: Human-in-the-loop workflows block indefinitely waiting for approval, wasting compute resources.

**Graflow's Solution: HITL with Timeout and Auto-Checkpoint**

```python
@task(inject_context=True)
def request_approval(context):
    response = context.request_feedback(
        feedback_type="approval",
        prompt="Approve deployment to production?",
        timeout=300,  # 5 minutes
        notification_config={
            "type": "webhook",
            "url": "https://hooks.slack.com/services/XXX",
            "message": "Approval required"
        }
    )
```

**Flow**:
1. Approved within 5 minutes → Continue immediately
2. Timeout → Auto-checkpoint created, workflow pauses
3. Approval via API hours later → Resume from checkpoint

**Benefits**: No blocked processes. Efficient resource usage. Supports Slack/webhook notifications.

### Challenge 5: No Parallel Processing or Horizontal Scaling

**The Problem**: Processing hundreds of agents or files in parallel requires complex distributed infrastructure setup.

**Graflow's Solution: Redis-based Distributed Execution**

Switch from local to distributed with one line:

```python
# Local → Distributed in one line
parallel = (task_a | task_b | task_c).with_execution(
    backend=CoordinationBackend.REDIS,
    backend_config={"redis_client": redis_client}
)
```

Scale by adding workers:

```bash
python -m graflow.worker.main --worker-id worker-1 --redis-host localhost
python -m graflow.worker.main --worker-id worker-2 --redis-host localhost
```

**Benefits**: Works with Kubernetes HPA or ECS Auto Scaling. Scale from 1 to 1000+ workers without changing workflow code.

---

## Pythonic Operators DSL: DAG × State Machine Hybrid

Graflow's core innovation is its **DAG × State Machine hybrid design**. Using operator overloading (`>>`, `|`), you can describe both DAGs and cycles mathematically and intuitively.

### The Hybrid Design

Graflow combines two complementary approaches:

- **DAG (Static Structure)**: Operators (`>>`, `|`) define the task graph skeleton
- **State Machine (Dynamic Transitions)**: `next_task()`, `next_iteration()` enable runtime state transitions

This combination achieves both **static readability** and **dynamic flexibility**.

```python
with workflow("etl_pipeline") as wf:
    # DAG: Define static structure with operators
    # Sequential execution: >>
    fetch >> transform >> load

    # Parallel execution: |
    (transform_a | transform_b | transform_c) >> merge

    # Complex flows
    fetch >> (validate | enrich) >> process >> (save_db | save_cache)

# State Machine: Dynamic transitions within tasks
@task(inject_context=True)
def adaptive_task(context: TaskExecutionContext):
    result = process_data()

    # Determine next state at runtime (like a State Machine)
    if result.needs_retry:
        context.next_iteration()  # Self-loop
    elif result.quality > 0.9:
        context.next_task(premium_task)  # Dynamic branching
    else:
        context.next_task(standard_task)  # Alternative branch

# Goto pattern: Jump to existing task (skip successors)
@task(inject_context=True)
def error_handler(context: TaskExecutionContext):
    try:
        risky_operation()
    except CriticalError:
        emergency_task = context.graph.get_node("emergency_handler")
        context.next_task(emergency_task, goto=True)  # Skip successors
```

### Function-Style Alternatives

For dynamic task list construction or improved readability:

```python
from graflow.core.task import chain, parallel

# Operator style
fetch >> transform >> load

# Function style (equivalent)
chain(fetch, transform, load)

# Dynamic task list
tasks = [create_task(i) for i in range(10)]
parallel(*tasks)  # Run 10 tasks in parallel
```

### Comparison with LangChain/LangGraph

| Tool | Approach |
|------|----------|
| **LangChain** | DAG only (no cycles, no State Machine) |
| **LangGraph** | StateGraph supports cycles, but requires pre-defining all paths with `add_node`, `add_edge`, `add_conditional_edges` |
| **Graflow** | Operator-based DAG skeleton + runtime dynamic transitions (hybrid) |

### State Machine Execution

Build complex state machines with explicit control flow:

- Cycle control via `next_iteration()`
- Early termination via `terminate_workflow()`
- Cancellation via `cancel_workflow()`
- Jump to existing tasks via `next_task(task, goto=True)`

## Scalable Fleet Execution

Go from local multithreading to a distributed fleet of agents with a single line of code:

```python
# Switch from local to distributed execution
parallel = (task_a | task_b | task_c).with_execution(
    backend=CoordinationBackend.REDIS,
    backend_config={"redis_client": redis_client}
)
```

Scale horizontally by adding workers:

```bash
python -m graflow.worker.main --worker-id worker-1 --redis-host localhost
python -m graflow.worker.main --worker-id worker-2 --redis-host localhost
```

Works with Kubernetes HPA or ECS Auto Scaling for automatic worker scaling based on queue depth.

## User-Controlled Checkpoints

Unlike auto-checkpoint-only systems, Graflow lets you control exactly when to save state:

```python
@task(inject_context=True)
def train_model(context):
    for epoch in range(100):
        train_one_epoch(epoch)

        if epoch % 10 == 0:
            # Checkpoint at critical points
            context.checkpoint(
                path="/tmp/checkpoint",
                metadata={"epoch": epoch}
            )

# Resume from checkpoint
CheckpointManager.resume_from_checkpoint("/tmp/checkpoint")
```

Full state preservation: graph, channels, pending tasks. Supports local filesystem and S3.

## Human-in-the-Loop (HITL)

Long-running approval workflows with intelligent timeout handling:

```python
@task(inject_context=True)
def request_approval(context):
    response = context.request_feedback(
        feedback_type="approval",
        prompt="Approve deployment to production?",
        timeout=300,  # 5 minutes
        notification_config={
            "type": "webhook",
            "url": "https://hooks.slack.com/services/XXX",
            "message": "Approval required"
        }
    )

    if not response.approved:
        context.cancel_workflow("Approval rejected")
```

**Flow**: Approved within timeout → continue. Timeout → auto-checkpoint → resume later when approved via API.

## Parallel Group Error Policies

Fine-grained control over parallel task failure handling:

```python
from graflow.core.handlers.group_policy import (
    BestEffortGroupPolicy,
    AtLeastNGroupPolicy,
    CriticalGroupPolicy
)

# Best-effort: Continue even if some tasks fail
notifications = (send_email | send_sms | send_slack).with_execution(
    policy=BestEffortGroupPolicy()
)

# At-least-N: Require minimum successful tasks
parallel = (task_a | task_b | task_c | task_d).with_execution(
    policy=AtLeastNGroupPolicy(min_success=2)
)

# Critical: Only specified tasks must succeed
parallel = (extract | validate | enrich).with_execution(
    policy=CriticalGroupPolicy(critical_task_ids=["extract", "validate"])
)
```

| Policy | Use Case |
|--------|----------|
| **Strict** (default) | All tasks must succeed |
| **Best-effort** | Partial success acceptable (notifications, enrichment) |
| **At-least-N** | Quorum/redundancy (multi-region deploy) |
| **Critical** | Mixed priority (required + optional steps) |

## LLM Integration

### Lightweight: inject_llm_client

For simple LLM calls without ReAct loops:

```python
@task(inject_llm_client=True)
def summarize(llm: LLMClient, text: str) -> str:
    return llm.completion_text(
        [{"role": "user", "content": f"Summarize: {text}"}],
        model="gpt-4o-mini"
    )
```

### SuperAgent: inject_llm_agent

Wrap existing agent frameworks (Google ADK, PydanticAI):

```python
from graflow.llm.agents.adk_agent import AdkLLMAgent

agent = AdkLLMAgent(adk_agent)
context.register_llm_agent("supervisor", agent)

@task(inject_llm_agent="supervisor")
def supervise(agent: LLMAgent, query: str) -> str:
    return agent.run(query)["output"]
```

## Type-Safe Channels

Share state between tasks with type-checked, named Key-Value Store:

```python
from typing import TypedDict

class AnalysisData(TypedDict):
    summary: str
    score: float

@task(inject_context=True)
def producer(context):
    channel = context.get_typed_channel(AnalysisData)
    channel.set("result", {"summary": "...", "score": 0.95})  # Type-checked

@task(inject_context=True)
def consumer(context):
    channel = context.get_typed_channel(AnalysisData)
    result = channel.get("result")  # IDE autocomplete works
```

Supports **MemoryChannel** (local) and **RedisChannel** (distributed).

## Isolated Container Execution

Run tasks in sandboxed environments — essential for LLM-generated code:

```python
@task(handler="docker", handler_kwargs={
    "image": "pytorch/pytorch:2.0-gpu",
    "gpu": True,
    "volumes": {"/data": "/workspace/data"},
})
def train_on_gpu():
    return train_model()
```

- **Direct**: In-process execution (default)
- **Docker**: Container isolation with GPU support
- **Custom**: Implement handlers for Cloud Run, Lambda, etc.

## Full Observability

OpenTelemetry + LangFuse integration for complete tracing:

```python
from graflow.trace.langfuse import LangFuseTracer

tracer = LangFuseTracer(enable_runtime_graph=True)

with workflow("my_workflow", tracer=tracer) as wf:
    search >> analyze >> report
```

- **Auto-instrumentation**: Task start/end and LLM calls captured automatically
- **Context propagation**: LiteLLM/ADK calls automatically linked to workflow traces
- **Distributed tracing**: Trace IDs propagate across Redis workers
- **Runtime graph export**: Visualize actual execution paths
