---
sidebar_position: 4
---

# Task Handlers

Swap execution strategies per task — run in-process, inside Docker containers, or with custom handlers.

## Overview

By default, Graflow executes every task in the current process (the `direct` handler). Task handlers let you change **how** a task runs without changing **what** it does. This is useful for:

- Timing and logging instrumentation
- Running tasks in isolated Docker containers (GPU, sandboxed execution)
- Delegating to remote execution environments (Cloud Run, Lambda, etc.)

| Handler | Description | Use Case |
|---------|-------------|----------|
| `direct` | In-process execution (default) | General tasks |
| `docker` | Docker container execution | GPU processing, dependency isolation, sandboxed execution |
| Custom | Implement your own | Timing, logging, remote execution, etc. |

## Specifying a Handler

Use the `handler` parameter on the `@task` decorator:

```python
from graflow import task

# Default: in-process execution
@task
def simple_task():
    return "result"

# Explicit direct handler
@task(handler="direct")
def also_in_process():
    return "result"

# Custom handler (must be registered with the engine)
@task(handler="timing")
def measured_task():
    return "result"
```

## Writing a Custom Handler

To create a custom handler, subclass `TaskHandler` and implement `execute_task()`. Then register it with the `WorkflowEngine` before execution.

### Example: Timing Handler

This handler measures and prints the execution time of each task:

```python
import time

from graflow import task, workflow
from graflow.core.context import ExecutionContext
from graflow.core.engine import WorkflowEngine
from graflow.core.handler import TaskHandler
from graflow.core.task import Executable


class TimingHandler(TaskHandler):
    """Measures and prints task execution time."""

    def execute_task(self, task: Executable, context: ExecutionContext):
        task_id = task.task_id
        start = time.perf_counter()
        try:
            result = task.run()
            elapsed = time.perf_counter() - start
            print(f"  [TimingHandler] {task_id} completed in {elapsed:.3f}s")
            context.set_result(task_id, result)
            return result
        except Exception as e:
            context.set_result(task_id, e)
            raise
```

### Registering and Using the Handler

Register the handler with `WorkflowEngine` and reference it by name in `@task(handler="...")`:

```python
with workflow("handler_demo") as ctx:

    @task(handler="direct")
    def fetch_data() -> dict:
        print("fetch_data: fetching...")
        return {"values": [1, 2, 3, 4, 5]}

    @task(handler="timing")
    def process_data(fetch_data: dict) -> float:
        print("process_data: computing...")
        time.sleep(0.1)  # Simulate heavy computation
        return sum(fetch_data["values"]) / len(fetch_data["values"])

    @task(handler="timing")
    def format_result(process_data: float) -> str:
        print("format_result: formatting...")
        return f"Average: {process_data:.1f}"

    fetch_data >> process_data >> format_result

    # Register the custom handler and execute
    engine = WorkflowEngine()
    engine.register_handler("timing", TimingHandler())

    exec_context = ExecutionContext.create(ctx.graph, "fetch_data")
    result = engine.execute(exec_context)

print(f"\nResult: {result}")
```

**Output:**
```
fetch_data: fetching...
process_data: computing...
  [TimingHandler] process_data completed in 0.100s
format_result: formatting...
  [TimingHandler] format_result completed in 0.000s

Result: Average: 3.0
```

`fetch_data` runs with the default `direct` handler, while `process_data` and `format_result` use the custom `TimingHandler`.

### Handler Interface

Every custom handler must implement one method:

```python
class TaskHandler(ABC):

    def get_name(self) -> str:
        """Handler name for registration (defaults to class name)."""
        ...

    @abstractmethod
    def execute_task(self, task: Executable, context: ExecutionContext) -> Any:
        """Execute the task and store its result in context."""
        ...
```

Inside `execute_task()`, you **must** call `context.set_result(task_id, result)` to make the result available to downstream tasks. On failure, call `context.set_result(task_id, exception)` and re-raise.

## Docker Task Handler

`DockerTaskHandler` runs tasks inside Docker containers — ideal for GPU workloads, dependency isolation, or sandboxed execution of untrusted code (e.g., LLM-generated code).

### Basic Usage

```python
from graflow import task, workflow
from graflow.core.handlers.docker import DockerTaskHandler
from graflow.core.engine import WorkflowEngine
from graflow.core.context import ExecutionContext


with workflow("docker_demo") as ctx:

    @task(handler="docker")
    def compute_in_container():
        return sum(range(1_000_000))

    engine = WorkflowEngine()
    engine.register_handler("docker", DockerTaskHandler(image="python:3.11-slim"))

    exec_context = ExecutionContext.create(ctx.graph, "compute_in_container")
    result = engine.execute(exec_context)

print(f"Result: {result}")
```

The task function is serialized, sent to the container, executed, and the result is returned to the host process.

### GPU Support

Pass `device_requests` to enable GPU access inside the container:

```python
from docker.types import DeviceRequest

engine.register_handler(
    "gpu",
    DockerTaskHandler(
        image="pytorch/pytorch:2.0-gpu",
        device_requests=[DeviceRequest(count=1, capabilities=[["gpu"]])],
    ),
)

@task(handler="gpu")
def train_on_gpu():
    import torch
    device = torch.device("cuda")
    # ... training logic
    return model_accuracy
```

### Volume Mounts

Mount host directories into the container for data access:

```python
engine.register_handler(
    "docker",
    DockerTaskHandler(
        image="python:3.11-slim",
        volumes={
            "/data/input": {"bind": "/workspace/input", "mode": "ro"},
            "/data/output": {"bind": "/workspace/output", "mode": "rw"},
        },
    ),
)
```

### Constructor Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `image` | `"python:3.11-slim"` | Docker image to use |
| `auto_remove` | `True` | Remove container after execution |
| `environment` | `{}` | Environment variables passed to the container |
| `volumes` | `{}` | Volume mounts (`{host_path: {"bind": container_path, "mode": "rw"}}`) |
| `device_requests` | `[]` | GPU/device requests |
| `auto_mount_graflow` | `True` | Auto-mount graflow source if running from source |

:::note
`DockerTaskHandler` requires the `docker` Python package. Install it with:
```bash
pip install docker
```
:::

### Using `@task` with `handler_kwargs`

Instead of registering a handler manually, you can pass handler configuration directly via `handler_kwargs`:

```python
@task(handler="docker", handler_kwargs={
    "image": "pytorch/pytorch:2.0-gpu",
    "gpu": True,
    "volumes": {"/data": "/workspace/data"},
})
def train_on_gpu():
    return train_model()
```

## Summary

- Use `@task(handler="name")` to select an execution strategy per task
- Create custom handlers by subclassing `TaskHandler` and implementing `execute_task()`
- Register handlers with `engine.register_handler("name", handler_instance)`
- Use `DockerTaskHandler` for container isolation, GPU access, and sandboxed execution
- Mix handlers freely in the same workflow — each task can use a different strategy
