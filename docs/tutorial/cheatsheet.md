---
sidebar_position: 99
---

# Cheatsheet

A quick reference for Graflow syntax and APIs.

## Tasks

| Syntax | Purpose | Learn More |
|--------|---------|------------|
| `@task` | Convert function to task | [Your First Task](./basics/first-task) |
| `@task(task_id="id")` | Set explicit task identifier | [Your First Task](./basics/first-task) |
| `@task(inject_context=True)` | Access channels/workflow control | [Channels and Context](./core-concepts/channels-context) |
| `@task(inject_llm_client=True)` | Direct LLM API calls | [Channels and Context](./core-concepts/channels-context) |
| `@task(inject_llm_agent="name")` | Inject SuperAgent with tools | [Channels and Context](./core-concepts/channels-context) |
| `task.run(param=value)` | Test task directly | [Your First Task](./basics/first-task) |
| `task(task_id="id", param=value)` | Create task instance with bound parameters | [Task Instances](./core-concepts/task-instances) |

## Workflows

| Syntax | Purpose | Learn More |
|--------|---------|------------|
| `with workflow("name") as wf:` | Define workflow context | [Your First Workflow](./basics/first-workflow) |
| `task_a >> task_b` | Sequential execution | [Task Composition](./basics/task-composition) |
| `task_a \| task_b` | Parallel execution | [Task Composition](./basics/task-composition) |
| `chain(task_a, task_b, task_c)` | Create sequential chain | [Task Composition](./basics/task-composition) |
| `parallel(task_a, task_b, task_c)` | Create parallel group | [Task Composition](./basics/task-composition) |
| `group.set_group_name("name")` | Rename parallel group | [Task Composition](./basics/task-composition) |
| `group.with_execution(policy=...)` | Set error handling policy | [Task Composition](./basics/task-composition) |

## Execution

| Syntax | Purpose | Learn More |
|--------|---------|------------|
| `wf.execute()` | Execute workflow (auto-detect start) | [Execution Patterns](./core-concepts/execution-patterns) |
| `wf.execute(start_node="task_id")` | Start from specific task | [Execution Patterns](./core-concepts/execution-patterns) |
| `wf.execute(initial_channel={...})` | Set initial parameters | [Passing Parameters](./basics/passing-parameters) |
| `wf.execute(ret_context=True)` | Return `(result, context)` tuple | [Execution Patterns](./core-concepts/execution-patterns) |

## Channels

| Syntax | Purpose | Learn More |
|--------|---------|------------|
| `ctx.get_channel()` | Access key-value channel | [Channels and Context](./core-concepts/channels-context) |
| `channel.set(key, value)` | Store a value | [Channels and Context](./core-concepts/channels-context) |
| `channel.set(key, value, ttl=300)` | Store with expiration (seconds) | [Channels and Context](./core-concepts/channels-context) |
| `channel.get(key)` | Retrieve a value | [Channels and Context](./core-concepts/channels-context) |
| `channel.get(key, default=val)` | Retrieve with fallback | [Channels and Context](./core-concepts/channels-context) |
| `channel.append(key, value)` | Add to end of list | [Channels and Context](./core-concepts/channels-context) |
| `channel.prepend(key, value)` | Add to beginning of list | [Channels and Context](./core-concepts/channels-context) |
| `ctx.get_typed_channel(Schema)` | Type-safe channel access | [Channels and Context](./core-concepts/channels-context) |
| `ctx.get_result(task_id)` | Retrieve specific task result | [Execution Patterns](./core-concepts/execution-patterns) |

## Dynamic Control Flow

| Syntax | Purpose | Learn More |
|--------|---------|------------|
| `ctx.next_task(task)` | Enqueue task, continue normally | [Dynamic Tasks](./advanced/dynamic-tasks) |
| `ctx.next_task(task, goto=True)` | Jump to task, skip successors | [Dynamic Tasks](./advanced/dynamic-tasks) |
| `ctx.graph.get_node("task_id")` | Get existing task from graph | [Dynamic Tasks](./advanced/dynamic-tasks) |
| `ctx.next_iteration()` | Self-loop (retry/convergence) | [Dynamic Tasks](./advanced/dynamic-tasks) |
| `ctx.terminate_workflow()` | Exit successfully | [Dynamic Tasks](./advanced/dynamic-tasks) |
| `ctx.cancel_workflow(reason)` | Exit with error | [Dynamic Tasks](./advanced/dynamic-tasks) |

## Human-in-the-Loop

| Syntax | Purpose |
|--------|---------|
| `ctx.request_feedback(feedback_type="approval", ...)` | Yes/No decision |
| `ctx.request_feedback(feedback_type="text", ...)` | Free-form text input |
| `ctx.request_feedback(feedback_type="selection", options=[...])` | Single selection |
| `ctx.request_feedback(feedback_type="multi_selection", options=[...])` | Multiple selection |

## Prompt Management

| Syntax | Purpose | Learn More |
|--------|---------|------------|
| `PromptManagerFactory.create("yaml", prompts_dir=...)` | Create YAML prompt manager | [Channels and Context](./core-concepts/channels-context) |
| `ctx.prompt_manager` | Access prompt manager | [Channels and Context](./core-concepts/channels-context) |
| `pm.get_text_prompt("name")` | Get text prompt template | [Channels and Context](./core-concepts/channels-context) |
| `pm.get_chat_prompt("name")` | Get chat prompt template | [Channels and Context](./core-concepts/channels-context) |
| `prompt.render(var=value)` | Substitute template variables | [Channels and Context](./core-concepts/channels-context) |

## Parallel Group Policies

| Policy | Behavior | Learn More |
|--------|----------|------------|
| `"strict"` (default) | All tasks must succeed | [Task Composition](./basics/task-composition) |
| `"best_effort"` | Continue even if tasks fail | [Task Composition](./basics/task-composition) |
| `AtLeastNGroupPolicy(min_success=N)` | At least N tasks must succeed | [Task Composition](./basics/task-composition) |
| `CriticalGroupPolicy(critical_task_ids=[...])` | Only specified tasks must succeed | [Task Composition](./basics/task-composition) |

## LLM Integration

| Syntax | Purpose |
|--------|---------|
| `llm.completion_text(messages, model="...")` | Simple LLM completion |
| `ctx.llm_client` | Access LLM client via context |
| `ctx.register_llm_agent("name", agent)` | Register SuperAgent |
| `ctx.get_llm_agent("name")` | Get registered agent |
| `agent.run(query)` | Execute agent |

## Checkpoints

| Syntax | Purpose |
|--------|---------|
| `ctx.checkpoint(path="/path")` | Save checkpoint |
| `ctx.checkpoint(path="s3://bucket/path")` | Save to S3 |
| `CheckpointManager.resume_from_checkpoint(path)` | Resume from checkpoint |

## Distributed Execution

| Syntax | Purpose |
|--------|---------|
| `group.with_execution(backend=CoordinationBackend.REDIS, ...)` | Enable Redis coordination |
| `python -m graflow.worker.main --worker-id X --redis-host Y` | Start worker |

## Tracing

| Syntax | Purpose |
|--------|---------|
| `LangFuseTracer(enable_runtime_graph=True)` | Create LangFuse tracer |
| `workflow("name", tracer=tracer)` | Enable tracing for workflow |
