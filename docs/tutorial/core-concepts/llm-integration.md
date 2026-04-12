---
sidebar_position: 5
---

# LLM Integration

Integrate LLMs into your workflows — from simple completions to full agent reasoning loops.

Graflow provides two injection modes for LLM access, both **provider-independent**:

| Mode | Use case | Injected type |
|---|---|---|
| `inject_llm_client=True` | Simple prompt → response calls | `LLMClient` (LiteLLM wrapper) |
| `inject_llm_agent="name"` | Agent reasoning with tools (ReAct loops) | `LLMAgent` (ADK / PydanticAI / ...) |

## Mode 1: `inject_llm_client` — Simple LLM Calls

For straightforward prompt-based tasks that don't need tool calling or multi-turn reasoning.

### Setup

```python
from graflow.llm.client import LLMClient
from graflow.core.decorators import task
from graflow.core.workflow import workflow

# LLMClient is auto-created with GRAFLOW_LLM_MODEL env var (default: "gpt-5-mini").
# Or pass llm_client explicitly to workflow.execute():
llm_client = LLMClient(model="gpt-4o-mini", temperature=0.7)
```

### Basic Usage

```python
@task(inject_llm_client=True)
def summarize(llm: LLMClient, text: str) -> str:
    return llm.completion_text(
        [{"role": "user", "content": f"Summarize: {text}"}]
    )

with workflow("summarizer") as wf:
    summarize
    wf.execute("summarize")
```

`LLMClient` is a thin wrapper around [LiteLLM](https://docs.litellm.ai/), so you can call **any provider** (OpenAI, Anthropic, Google, AWS Bedrock, Azure, Ollama, etc.) through a unified API.

### Switching Models Per Call

A single `LLMClient` instance is shared across all tasks, but you can override the model on every call:

```python
@task(inject_llm_client=True)
def multi_model_task(llm: LLMClient):
    # Fast and cheap
    draft = llm.completion_text(
        [{"role": "user", "content": "Draft an outline"}],
        model="gpt-4o-mini"
    )
    # High quality
    final = llm.completion_text(
        [{"role": "user", "content": f"Polish this: {draft}"}],
        model="claude-sonnet-4-20250514"
    )
    return final
```

### Key Methods

| Method | Returns | Description |
|---|---|---|
| `completion(messages, model=..., **params)` | `ModelResponse` | Full LiteLLM response object |
| `completion_text(messages, **params)` | `str` | Text content from first choice (convenience) |

---

## Mode 2: `inject_llm_agent` — Agent Dependency Injection

For complex tasks that need **ReAct loops, tool calling, and multi-turn interaction**. Graflow delegates agent reasoning to specialized frameworks and wraps them as "fat nodes" in the workflow.

### Supported Agent Frameworks

| Framework | Wrapper class | Install |
|---|---|---|
| [Google ADK](https://google.github.io/adk-docs/) | `AdkLLMAgent` | `pip install graflow[adk]` |
| [PydanticAI](https://ai.pydantic.dev/) | `PydanticLLMAgent` | `pip install graflow[pydantic-ai]` |

All wrappers implement the same `LLMAgent` base class, so **workflow code stays the same** regardless of which framework you choose.

```python
from graflow.llm.agents.base import LLMAgent

# Both AdkLLMAgent and PydanticLLMAgent are LLMAgent
# Tasks use the same interface:
@task(inject_llm_agent="my_agent")
def my_task(agent: LLMAgent, query: str) -> str:
    result = agent.run(query)
    return result["output"]
```

---

### Google ADK Agent

[Google ADK](https://google.github.io/adk-docs/) provides context caching, sub-agent orchestration, and native Gemini support.

#### Basic Example

```python
from google.adk.agents import LlmAgent
from graflow.llm.agents.adk_agent import AdkLLMAgent
from graflow.core.context import ExecutionContext, TaskExecutionContext
from graflow.core.decorators import task
from graflow.core.workflow import workflow

with workflow("research_report") as wf:

    # Register agent with factory pattern (receives ExecutionContext at runtime)
    def create_agent(exec_context: ExecutionContext) -> AdkLLMAgent:
        adk_agent = LlmAgent(
            name="researcher",
            model="gemini-2.5-flash",
            instruction="You are a research assistant. Search and analyze topics thoroughly.",
            tools=[search_tool, calculator_tool],
        )
        return AdkLLMAgent(adk_agent, app_name=exec_context.session_id)

    wf.register_llm_agent("researcher", create_agent)

    @task(inject_llm_agent="researcher", inject_context=True)
    def research(agent, context: TaskExecutionContext):
        """Agent searches and reasons about the topic"""
        result = agent.run("Compare Python async frameworks for web scraping")
        context.get_channel().set("research", result["output"])

    @task(inject_llm_client=True)
    def format_report(llm: LLMClient, research: str) -> str:
        """Simple LLM call to format the research into a report"""
        return llm.completion_text(
            [{"role": "user", "content": f"Format as a markdown report:\n{research}"}],
            model="gpt-4o-mini"
        )

    research >> format_report
    wf.execute("research")
```

#### With Sub-Agents

ADK supports hierarchical agent orchestration:

```python
analyst = LlmAgent(
    name="analyst",
    model="gemini-2.5-flash",
    instruction="Analyze data and provide insights.",
    tools=[query_db],
)

writer = LlmAgent(
    name="writer",
    model="gemini-2.5-flash",
    instruction="Write reports based on analysis.",
)

supervisor = LlmAgent(
    name="supervisor",
    model="gemini-2.5-flash",
    instruction="Coordinate analysis and report writing.",
    sub_agents=[analyst, writer],
)

agent = AdkLLMAgent(supervisor)
wf.register_llm_agent("supervisor", agent)
```

#### Factory Pattern vs Direct Instance

```python
# Direct instance — simpler, but no access to runtime context
agent = AdkLLMAgent(adk_agent)
wf.register_llm_agent("assistant", agent)

# Factory — receives ExecutionContext, useful for session_id, config, etc.
def create_agent(exec_context: ExecutionContext) -> AdkLLMAgent:
    return AdkLLMAgent(adk_agent, app_name=exec_context.session_id)

wf.register_llm_agent("assistant", create_agent)
```

Both forms are supported by `register_llm_agent`.

---

### PydanticAI Agent

[PydanticAI](https://ai.pydantic.dev/) provides **type-safe structured output** via Pydantic models, multi-provider support, and decorator-based tool registration.

#### Basic Example

```python
from pydantic import BaseModel
from pydantic_ai import Agent
from graflow.llm.agents import PydanticLLMAgent
from graflow.core.context import TaskExecutionContext
from graflow.core.decorators import task
from graflow.core.workflow import workflow

class ReviewResult(BaseModel):
    approved: bool
    issues: list[str]
    suggestion: str

with workflow("code_review") as wf:

    review_agent = Agent(
        model="openai:gpt-4o",
        output_type=ReviewResult,
        system_prompt="You are a code reviewer. Identify issues and suggest improvements.",
    )
    wf.register_llm_agent("reviewer", PydanticLLMAgent(review_agent, name="reviewer"))

    @task(inject_context=True)
    def fetch_diff(context: TaskExecutionContext):
        """Fetch the code diff to review"""
        diff = get_pr_diff(pr_number=42)  # your function
        context.get_channel().set("diff", diff)

    @task(inject_llm_agent="reviewer", inject_context=True)
    def review(agent, context: TaskExecutionContext, diff: str):
        """Agent reviews the code — output is a validated ReviewResult"""
        result = agent.run(f"Review this diff:\n{diff}")
        output: ReviewResult = result["output"]  # Type-safe!
        context.get_channel().set("review", output.model_dump())
        print(f"Approved: {output.approved}, Issues: {len(output.issues)}")

    @task
    def notify(review: dict):
        """Post review comment (auto keyword resolution from channel)"""
        post_review_comment(review)

    fetch_diff >> review >> notify
    wf.execute("fetch_diff")
```

#### Structured Output

PydanticAI's standout feature — the agent output is a **validated Pydantic model**:

```python
from pydantic import BaseModel
from pydantic_ai import Agent
from graflow.llm.agents import PydanticLLMAgent

class SentimentAnalysis(BaseModel):
    sentiment: str        # "positive", "negative", "neutral"
    confidence: float     # 0.0 to 1.0
    key_points: list[str]

pydantic_agent = Agent(
    model="openai:gpt-4o",
    output_type=SentimentAnalysis,
    system_prompt="Analyze the sentiment of the given text.",
)

agent = PydanticLLMAgent(pydantic_agent, name="analyzer")
wf.register_llm_agent("analyzer", agent)

@task(inject_llm_agent="analyzer")
def analyze(agent, text: str) -> dict:
    result = agent.run(text)
    output: SentimentAnalysis = result["output"]  # Type-safe!
    print(f"Sentiment: {output.sentiment} ({output.confidence:.0%})")
    return output.model_dump()
```

#### Tool Registration

PydanticAI uses `@agent.tool` decorators:

```python
from pydantic_ai import Agent, RunContext

pydantic_agent = Agent(
    model="openai:gpt-4o",
    system_prompt="You are a weather assistant.",
)

@pydantic_agent.tool
def get_weather(ctx: RunContext, city: str) -> dict:
    """Get current weather for a city."""
    # Call your weather API here
    return {"city": city, "temp": 22.5, "condition": "Sunny"}

@pydantic_agent.tool
def get_forecast(ctx: RunContext, city: str, days: int = 3) -> dict:
    """Get weather forecast."""
    return {"city": city, "days": days, "forecast": "Partly cloudy"}

agent = PydanticLLMAgent(pydantic_agent, name="weather")
wf.register_llm_agent("weather", agent)
```

#### LiteLLM Backend

Use `create_pydantic_ai_agent_with_litellm` to route PydanticAI through LiteLLM for unified provider access:

```python
from graflow.llm.agents import PydanticLLMAgent, create_pydantic_ai_agent_with_litellm

pydantic_agent = create_pydantic_ai_agent_with_litellm(
    model="openai/gpt-4o",          # LiteLLM format: 'provider/model'
    instructions="You are a helpful assistant.",
    name="assistant",
    instrument=True,                  # Enable tracing
)

agent = PydanticLLMAgent(pydantic_agent, name="assistant")
```

---

## Swapping Frameworks — Same Workflow

The key design benefit: **only the agent registration changes** when switching frameworks. Workflow tasks remain identical.

```python
# --- ADK version ---
from google.adk.agents import LlmAgent
from graflow.llm.agents.adk_agent import AdkLLMAgent

adk_agent = LlmAgent(
    name="assistant", model="gemini-2.5-flash",
    instruction="You are a helpful assistant.",
    tools=[search_tool],
)
wf.register_llm_agent("assistant", AdkLLMAgent(adk_agent))

# --- PydanticAI version ---
from pydantic_ai import Agent
from graflow.llm.agents import PydanticLLMAgent

pydantic_agent = Agent(
    model="openai:gpt-4o",
    system_prompt="You are a helpful assistant.",
)
@pydantic_agent.tool
def search_tool(ctx, query: str) -> str: ...

wf.register_llm_agent("assistant", PydanticLLMAgent(pydantic_agent, name="assistant"))

# --- The workflow task is IDENTICAL for both ---
@task(inject_llm_agent="assistant")
def ask(agent, query: str) -> str:
    result = agent.run(query)
    return result["output"]
```

---

## Combining Both Modes

You can use `inject_llm_client` and `inject_llm_agent` in the same workflow — or even in the same task with `inject_context`:

```python
with workflow("combined") as wf:

    wf.register_llm_agent("researcher", agent)

    @task(inject_llm_agent="researcher", inject_llm_client=True)
    def research_and_summarize(agent, llm: LLMClient, topic: str) -> str:
        # Agent does the heavy lifting (tool calls, reasoning)
        research = agent.run(f"Research: {topic}")

        # Simple LLM call for summarization
        summary = llm.completion_text(
            [{"role": "user", "content": f"Summarize: {research['output']}"}],
            model="gpt-4o-mini"
        )
        return summary
```

Or access `LLMClient` through context when using `inject_context`:

```python
@task(inject_context=True)
def my_task(context: TaskExecutionContext):
    llm = context.llm_client
    result = llm.completion_text(
        [{"role": "user", "content": "Hello"}]
    )
```

---

## Comparison: When to Use Which

| | `inject_llm_client` | `inject_llm_agent` |
|---|---|---|
| **Use case** | Single prompt → response | Multi-step reasoning with tools |
| **Complexity** | Low — one function call | High — agent manages ReAct loop |
| **Tool calling** | Manual (you parse and call) | Automatic (agent handles it) |
| **Multi-turn** | Manual message history | Agent manages conversation |
| **Output type** | Raw text / `ModelResponse` | `str` or Pydantic `BaseModel` (PydanticAI) |
| **Provider** | Any LiteLLM-supported model | Depends on agent framework |
| **Setup** | Zero config (auto-created) | Register agent explicitly |
