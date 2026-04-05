---
slug: introducing-graflow
title: "Introducing Graflow: An Orchestration Engine for AI Agent Workflows"
authors: [graflow]
tags: [announcement]
---

Graflow is a Python-based orchestration engine for **Agentic Workflows** — the sweet spot between deterministic pipelines and fully autonomous agents. Built with **developer experience** as a first-class concern, Graflow lets you write production-grade AI workflows that are readable, flexible, and easy to operate.

<!-- truncate -->

## Why Agentic Workflow?

The choice between AI workflows and autonomous agents isn't binary — it's a [spectrum of autonomy](https://www.decodingai.com/p/ai-workflows-vs-agents-the-autonomy), or what Andrej Karpathy calls an [Autonomy Slider](https://andrewships.substack.com/p/autonomy-sliders): a continuous dial calibrated by trust and risk. Andrew Ng's take is pragmatic: most enterprises should bet on **controlled autonomy** — agentic workflows where humans set the structure — rather than chasing full autonomy. In his [Agentic AI course](https://learn.deeplearning.ai/courses/agentic-ai/information), he identifies four design patterns — **Reflection, Tool Use, Planning, and Multi-Agent coordination** — that let LLMs handle complex tasks through iterative, multi-step workflows rather than single-shot prompting. His [advice](https://www.insightpartners.com/ideas/andrew-ng-why-agentic-ai-is-the-smart-bet-for-most-enterprises/): use the best model available, start building, and layer in agentic capabilities where they deliver real value.

### The Production Gap

Autonomous coding agents like Claude Code and OpenClaw show how far the slider can go. But in enterprise environments — where compliance, approval flows, and audit trails are non-negotiable — cranking the slider to maximum autonomy rarely works. You need to **control where the slider sits**, per task, per workflow, per use case.

This is the gap: most existing tools force you to choose. Deterministic workflow engines (Airflow, Dagster) can't express agent reasoning loops. Fully autonomous agent frameworks give you the ReAct loop but lack orchestration primitives — checkpointing, HITL, distributed execution, error policies — that production demands.

### Where Graflow Fits

Graflow sits in the middle of Karpathy's slider — the **Agentic Workflow** zone:

- **Deterministic workflows** (slider at minimum): Traditional ETL, RPA. Fully pre-defined, no AI decision-making.
- **Agentic Workflows** (slider in the middle): Structured orchestration + localized agent autonomy. Humans design the overall flow; agents operate autonomously *within* each task — applying Ng's Reflection, Tool Use, Planning, and Multi-Agent patterns where they fit.
- **Fully autonomous agents** (slider at maximum): The agent decides everything — tool selection, execution order, when to stop.

Graflow gives you **controlled autonomy**: the overall flow is human-designed and auditable, while individual tasks can leverage the full power of LLM-based agents internally. And crucially, you can **dial the autonomy up or down per task** — some tasks are pure deterministic logic, others delegate to a SuperAgent with full ReAct capabilities.

## Developer Experience First

Graflow is designed so that **the code you write looks like the workflow you're thinking about**. Three features embody this philosophy:

### 1. Fat Node Design — Use the Best Agent Framework for the Job

Some frameworks express a SuperAgent's internal reasoning loop — tool selection, execution, re-evaluation — as nodes and edges in the workflow graph. Tool-calling logic leaks into the workflow definition, making graphs harder to read.

Graflow treats **SuperAgents as fat nodes**: the ReAct loop stays *inside* the agent; the workflow graph only expresses task-level dependencies.

```python
from google.adk.agents import LlmAgent
from graflow.llm.agents.adk_agent import AdkLLMAgent

# Create a SuperAgent with Google ADK
adk_agent = LlmAgent(
    name="researcher",
    model="gemini-2.5-flash",
    tools=[search_tool, calculator_tool],
    sub_agents=[analyst_agent]
)

# Wrap and register — one line
context.register_llm_agent("researcher", AdkLLMAgent(adk_agent))

# Use in a task — the entire ReAct loop is handled by ADK
@task(inject_llm_agent="researcher")
def research(agent, query: str) -> str:
    return agent.run(query)["output"]
```

Because Graflow delegates the SuperAgent to specialized frameworks, you can use **Google ADK, PydanticAI, OpenAI Agents SDK, Strands Agents** — or mix them in the same workflow. Swapping the agent framework doesn't touch your workflow code.

For simpler LLM calls that don't need a ReAct loop, `inject_llm_client` provides direct access via [LiteLLM](https://docs.litellm.ai/) — switching between OpenAI, Claude, Gemini, Bedrock, or local models by changing one string:

```python
@task(inject_llm_client=True)
def summarize(llm: LLMClient, text: str) -> str:
    return llm.completion_text(
        [{"role": "user", "content": f"Summarize: {text}"}],
        model="gpt-4o-mini"  # or "claude-sonnet-4-20250514", "gemini-2.5-flash", ...
    )
```

### 2. Pythonic DSL + State Machine — Write What You Mean

Graflow's execution model combines a **static DAG skeleton** with **runtime dynamic transitions**, inspired by the shift from TensorFlow 1.x (define-and-run) to PyTorch (define-by-run).

**The DAG part** — Pythonic operators make pipeline structure visible at a glance:

```python
# >> for sequential, | for parallel — diamond pattern in one line
fetch >> (validate | enrich) >> process >> save
```

**The State Machine part** — tasks control flow dynamically using plain Python:

```python
@task(inject_context=True)
def process(context: TaskExecutionContext):
    result = run_processing()
    if result.score < 0.8:
        context.next_iteration()                    # self-loop
    elif result.has_error:
        context.next_task(error_handler, goto=True)  # jump
    else:
        context.next_task(finalize_task)             # dynamic branch
```

No compile step, no pre-defined conditional edges, no routing functions. Runtime decisions are just `if` statements. This hybrid gives you **static readability** and **dynamic flexibility** in one model.

## Production Features

Beyond the two pillars above, Graflow provides a full set of production capabilities:

| Feature | What it does |
|---|---|
| **Human-in-the-Loop** | `request_feedback()` with timeout-aware checkpointing and built-in Feedback API (REST + UI) |
| **Channel-based data sharing** | Key-value store (`set`/`get`) for inter-task communication with auto keyword argument resolution and thread-safe primitives (`atomic_add`, `append`, `lock`) |
| **User-controlled checkpoints** | Save state explicitly at important points via `context.checkpoint()` — local filesystem or S3 |
| **Parallel group error policies** | Per-group failure handling: Strict, Best-effort, At-least-N, Critical, or custom |
| **Distributed execution** | Redis-based workers for horizontal scaling — switch from local with one line |
| **Docker task handlers** | Run tasks in containers for GPU access, dependency isolation, or sandboxed execution |
| **Tracing via Langfuse (OSS)** | OpenTelemetry-based observability — self-hostable and free |
| **Type-safe channels** | `TypedDict`-backed channels with IDE autocomplete and compile-time checking |

For the full feature list, see [Key Features](/docs/getting-started/features).

## What's Next

For a detailed, side-by-side comparison with LangGraph — covering graph definition, data sharing, branching, HITL, distributed execution, LLM integration, and hands-on examples — see our three-part series:

- **[Part 1](/blog/langgraph-vs-graflow-part1)**: Design philosophy and core workflow features
- **[Part 2](/blog/langgraph-vs-graflow-part2)**: Production features — HITL, checkpoints, error policies, distributed execution
- **[Part 3](/blog/langgraph-vs-graflow-part3)**: LLM integration, tracing, and hands-on examples
