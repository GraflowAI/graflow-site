---
sidebar_position: 4
---

# Tutorial

This tutorial will guide you through building a more complex workflow with Graflow.

## Task Dependencies

Graflow allows you to define dependencies between tasks:

```yaml
name: data-pipeline
description: A simple data pipeline

tasks:
  - name: extract
    script: |
      echo "Extracting data..."
      # Your extraction logic here

  - name: transform
    depends_on: [extract]
    script: |
      echo "Transforming data..."
      # Your transformation logic here

  - name: load
    depends_on: [transform]
    script: |
      echo "Loading data..."
      # Your loading logic here
```

## Parallel Execution

Tasks without dependencies can run in parallel:

```yaml
name: parallel-tasks

tasks:
  - name: task-a
    script: echo "Running task A"

  - name: task-b
    script: echo "Running task B"

  - name: task-c
    depends_on: [task-a, task-b]
    script: echo "Running task C after A and B"
```

In this example, `task-a` and `task-b` will run in parallel, and `task-c` will wait for both to complete.

## Error Handling

Graflow provides built-in error handling:

```yaml
name: error-handling-example

tasks:
  - name: risky-task
    script: |
      echo "Attempting risky operation..."
      exit 1
    retry:
      max_attempts: 3
      delay: 5s
```

## Next Steps

You now have a solid foundation in Graflow. Explore the documentation to learn about:

- Advanced configuration options
- Containerized tasks
- Monitoring and observability
- Production deployment
