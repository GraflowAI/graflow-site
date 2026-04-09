---
slug: hands-on-graflow-colab
title: "Hands-On with Graflow: Run AI Workflows with Local LLMs in Google Colab"
authors: [graflow]
tags: [tutorial, announcement]
---

Want to try Graflow without installing anything? We've published a **Google Colab notebook** that walks you through building and running agentic workflows — right in your browser, completely free.

<!-- truncate -->

## Try It Now

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/GraflowAI/graflow-examples/blob/main/notebooks/hands_on_guide.ipynb)

The notebook covers **9 topics** with runnable examples — from your first graph to LLM-powered agents:

| # | Topic | What You'll Learn |
|---|-------|-------------------|
| 1 | **Your First Graph** | Define tasks with `@task` and wire them with `>>` — no upfront state schema needed |
| 2 | **Parallel Execution** | Fan-out / fan-in patterns using the `\|` operator, plus dynamic task generation with `chain()` and `parallel()` |
| 3 | **Data Sharing** | Channel-based inter-task communication with concurrency-safe primitives (`atomic_add`, `append`, `lock`) and `TypedChannel` |
| 4 | **Branching & Loops** | Runtime control flow with `next_iteration()` for retries and `next_task()` for dynamic routing |
| 5 | **Error Policies** | Parallel group policies — Strict, Best-effort, At-least-N, and Critical |
| 6 | **Exercise** | Build a data analysis pipeline combining everything above |
| 7 | **Checkpoint / Resume** | Suspend and resume workflows with `checkpoint()` and `CheckpointManager` |
| 8 | **Custom Task Handlers** | Swappable execution strategies via `TaskHandler` subclassing |
| 9 | **LLM Integration** | Local LLMs with LiteLLM + Ollama, and Google ADK agents with tool calling |

## Local LLMs: Privacy Without Compromise

The notebook includes examples using **[Gemma 4](https://ollama.com/library/gemma4:e4b)** (Google's recently released 4.5B-parameter multimodal model with 128K context) and other local models through [Ollama](https://ollama.com/). Two integration approaches are demonstrated:

1. **`inject_llm_client`** — Call any LLM directly from a task handler via [LiteLLM](https://docs.litellm.ai/), which provides a unified API across 100+ providers. Point it at a local Ollama endpoint and no API key is required.

2. **`inject_llm_agent`** — Wrap a [Google ADK](https://google.github.io/adk-docs/) agent as a Graflow fat node, complete with tool calling and the ReAct pattern.

Running models locally means **sensitive data never leaves your environment** — no API keys, no external calls, full control over your inference stack. This matters for enterprise workflows where compliance and data sovereignty are non-negotiable. And because Graflow is framework-agnostic, swapping between local and cloud models requires zero changes to your workflow code.

## Get Involved

Graflow is Apache 2.0 licensed and open source. We welcome issues and pull requests.

- [GitHub](https://github.com/GraflowAI/graflow)
- [Documentation](https://graflow.ai)
- [Examples & Notebooks](https://github.com/GraflowAI/graflow-examples)
