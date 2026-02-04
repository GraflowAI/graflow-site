---
sidebar_position: 2
---

# Your First Workflow

Connect multiple tasks together in a workflow.

## Complete Workflow Example

```python
from graflow.core.workflow import workflow
from graflow.core.decorators import task

with workflow("simple_pipeline") as wf:
    @task
    def start():
        print("Starting!")

    @task
    def middle():
        print("Middle!")

    @task
    def end():
        print("Ending!")

    # Connect tasks: start → middle → end
    start >> middle >> end

    # Execute the workflow
    wf.execute()
```

**Output:**
```
Starting!
Middle!
Ending!
```

**What's happening:**
- `with workflow("name")` creates a workflow context
- Tasks defined inside are automatically registered
- `>>` connects tasks sequentially (start → middle → end)
- `wf.execute()` runs the workflow

**Key Takeaways:**
- Use `with workflow("name")` to create workflows
- Define tasks inside the workflow context
- Use `>>` to connect tasks sequentially
- Call `wf.execute()` to run the workflow
