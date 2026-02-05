---
sidebar_position: 4
---

# Prompt Management

Learn how to manage and use prompts in your Graflow workflows.

## Creating a Prompt Manager

Use `PromptManagerFactory` to create a prompt manager:

```python
from pathlib import Path
from graflow.prompts.factory import PromptManagerFactory

# Create YAML-based prompt manager
prompts_dir = Path(__file__).parent / "prompts"
pm = PromptManagerFactory.create("yaml", prompts_dir=str(prompts_dir))

# Or create Langfuse-based prompt manager
pm = PromptManagerFactory.create("langfuse")

# Pass to workflow
with workflow("my_workflow", prompt_manager=pm) as ctx:
    ...
```

## Using Prompts in Tasks

```python
@task(inject_context=True)
def greet(ctx: TaskExecutionContext) -> str:
    pm = ctx.prompt_manager

    # Get text prompt and render
    prompt = pm.get_text_prompt("greeting")
    return prompt.render(name="Alice", product="Graflow")

@task(inject_context=True)
def generate_conversation(ctx: TaskExecutionContext) -> list:
    pm = ctx.prompt_manager

    # Get chat prompt for LLM APIs
    prompt = pm.get_chat_prompt("assistant")
    messages = prompt.render(domain="Python", task="debugging")
    return messages
```
