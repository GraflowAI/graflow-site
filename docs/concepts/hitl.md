---
sidebar_position: 5
---

# Human-in-the-Loop (HITL)

Graflow supports human-in-the-loop workflows, allowing you to request human feedback during workflow execution.

## Basic Usage

Use `ctx.request_feedback()` to pause execution and wait for human input:

```python
@task(inject_context=True)
def request_approval(ctx: TaskExecutionContext, deployment_plan: dict) -> bool:
    response = ctx.request_feedback(
        feedback_type="approval",
        prompt="Approve deployment to production?",
        timeout=300,  # Wait 5 minutes
        notification_config={
            "type": "slack",
            "webhook_url": "https://hooks.slack.com/services/XXX",
            "message": "Deployment approval needed!"
        }
    )

    if not response.approved:
        ctx.cancel_workflow("Deployment rejected by user")

    return response.approved
```

## Feedback Types

### 1. Approval

Yes/No decision:

```python
response = ctx.request_feedback(
    feedback_type="approval",
    prompt="Approve this action?"
)
# response.approved: bool
```

### 2. Text Input

Free-form text:

```python
response = ctx.request_feedback(
    feedback_type="text",
    prompt="Enter configuration value:"
)
# response.text: str
```

### 3. Selection

Choose one option:

```python
response = ctx.request_feedback(
    feedback_type="selection",
    prompt="Choose deployment environment:",
    options=["staging", "production"]
)
# response.selected: str
```

### 4. Multi-Selection

Choose multiple options:

```python
response = ctx.request_feedback(
    feedback_type="multi_selection",
    prompt="Select features to enable:",
    options=["feature_a", "feature_b", "feature_c"]
)
# response.selected: list[str]
```

## Timeout and Checkpoint Behavior

When timeout occurs, Graflow automatically creates a checkpoint and pauses:

1. Checkpoint is automatically created
2. Workflow pauses
3. User provides feedback later via API
4. Workflow resumes from checkpoint when feedback is received

```python
response = ctx.request_feedback(
    feedback_type="approval",
    prompt="Approve deployment?",
    timeout=300  # 5 minutes
)

# If no response within 5 minutes:
# 1. Checkpoint is automatically created
# 2. Workflow pauses
# 3. User can provide feedback later via API
# 4. Workflow resumes from checkpoint when feedback is received
```

## Notification Configuration

Notify users when feedback is required:

```python
response = ctx.request_feedback(
    feedback_type="approval",
    prompt="Approve deployment?",
    timeout=300,
    notification_config={
        "type": "webhook",
        "url": "https://hooks.slack.com/services/XXX",
        "message": "Approval required for deployment"
    }
)
```

Supported notification types:
- `webhook` — Send HTTP POST to specified URL
- `slack` — Slack webhook integration

## Idempotence Requirement

Tasks using `request_feedback()` must be **idempotent** because they may resume from checkpoint and re-execute.

### Why Idempotence Matters

When a task requests feedback and times out:
1. Checkpoint is automatically created
2. Workflow pauses
3. User provides feedback later
4. **Workflow resumes from checkpoint and re-executes the task**

This means the task may run multiple times, so it must be safe to re-execute.

### Bad Example (Not Idempotent)

```python
# ⚠️ NOT Idempotent - Dangerous with request_feedback
@task(inject_context=True)
def deploy_with_approval(ctx: TaskExecutionContext):
    # Deploy FIRST (wrong order!)
    deployment_id = api.deploy_to_production()

    # Then ask for approval
    response = ctx.request_feedback(
        feedback_type="approval",
        prompt="Approve deployment?"
    )

    # If timeout occurs and task resumes, deploy happens AGAIN!
    # This creates duplicate deployments!
```

### Good Example (Idempotent)

```python
# ✅ Idempotent - Safe with request_feedback
@task(inject_context=True)
def deploy_with_approval(ctx: TaskExecutionContext, deployment_plan: dict):
    channel = ctx.get_channel()

    # Check if already approved
    if not channel.get("deployment_approved"):
        response = ctx.request_feedback(
            feedback_type="approval",
            prompt="Approve deployment?",
            timeout=300
        )

        if not response.approved:
            ctx.cancel_workflow("Deployment rejected")

        channel.set("deployment_approved", True)

    # Check if already deployed
    if not channel.get("deployment_completed"):
        deployment_id = api.deploy_to_production(deployment_plan)
        channel.set("deployment_completed", True)
        channel.set("deployment_id", deployment_id)

    return channel.get("deployment_id")
```

## Best Practices

1. **Request feedback BEFORE side effects** — Ask for approval before performing irreversible actions
2. **Use channel flags** to track completion state
3. **Check flags before performing actions** to prevent duplicates
4. **Use idempotency keys** for external API calls
5. **Set appropriate timeouts** — Balance between user response time and resource usage

## Use Cases

- **Deployment approvals** — Require human sign-off before production deployments
- **Data validation reviews** — Have humans verify data quality before processing
- **Parameter tuning** — Let domain experts adjust parameters during ML training
- **Error recovery decisions** — Ask humans how to handle unexpected errors
- **Content moderation** — Human review of AI-generated content before publishing
