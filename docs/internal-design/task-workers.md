# Distributed Execution with Task Workers

Graflow provides a dedicated `TaskWorker` process for distributed parallel execution. Workers pull tasks from a shared Redis queue, making it trivial to scale horizontally.

## Architecture

```
┌─────────────┐
│ Main Process│  Submit tasks to Redis Queue
└─────┬───────┘
      │
      ▼
┌─────────────────────────────────────────┐
│         Redis Task Queue                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Task 1  │ │ Task 2  │ │ Task 3  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
└───────┬──────────┬──────────┬──────────┘
        │          │          │
   ┌────▼───┐ ┌───▼────┐ ┌──▼─────┐
   │Worker 1│ │Worker 2│ │Worker 3│
   │  4 CPUs│ │  8 CPUs│ │ 16 CPUs│
   └────────┘ └────────┘ └────────┘
```

> **Note:** Distributed execution is only available for `ParallelGroup` expressions (e.g., `task_a | task_b`). Sequential pipelines (`task_a >> task_b`) always run in-process. ParallelGroup follows the BSP (Bulk Synchronous Parallel) model: all branches complete and synchronize via a barrier before proceeding.

## Worker Features

### Autonomous Lifecycle Management

- **Graceful Shutdown**: Responds to SIGTERM/SIGINT signals
- **Current Task Completion**: Finishes in-flight tasks before stopping
- **Configurable Timeout**: `graceful_shutdown_timeout` parameter
- **ThreadPoolExecutor**: Concurrent task processing per worker

### Built-in Metrics

```python
worker.tasks_processed      # Total tasks executed
worker.tasks_succeeded      # Successful completions
worker.tasks_failed         # Failed tasks
worker.total_execution_time # Cumulative execution time
```

### Horizontal Scaling

- **Linear Scaling**: Add workers to increase throughput
- **No Coordination Required**: Workers independently poll Redis
- **Geographic Distribution**: Deploy workers across data centers
- **Specialized Workers**: GPU workers, I/O workers, compute workers

## BSP Execution Model

ParallelGroup uses the **Bulk Synchronous Parallel (BSP)** model:

```
Producer                    Workers                    Redis
   │                           │                         │
   ├── create_barrier(n) ──────┼────────────────────────►│
   ├── dispatch(task_1) ───────┼────────────────────────►│
   ├── dispatch(task_2) ───────┼────────────────────────►│
   ├── dispatch(task_n) ───────┼────────────────────────►│
   │                           │◄────── dequeue ─────────│
   │                           ├── execute task          │
   │                           ├── INCR barrier ────────►│
   │◄── wait_barrier ──────────┼─────────────────────────│
   ├── next tasks...           │                         │
```

## Content-Addressable Graph Storage

Graphs are stored using **content-addressable hashing** for deduplication:

- Same workflow definition = same hash = stored once (90%+ storage reduction)
- **Lazy Upload**: Graph saved only when ParallelGroup execution begins
- **Sliding TTL**: Extended on each access (default: 24 hours)
- **LRU Cache**: Local cache prevents memory leaks in long-running workers
- **zlib Compression**: 50-70% network/memory reduction

## Configuration

**Producer Setup**:
```python
context = ExecutionContext.create(
    graph=task_graph,
    start_node="start",
    channel_backend="redis",
    queue_backend="redis",
    config={
        "host": "localhost",
        "port": 6379,
        "key_prefix": "myapp:workflows"
    }
)
```

**Worker Startup**:
```bash
python -m graflow.worker.main \
  --worker-id worker-1 \
  --redis-host localhost \
  --redis-port 6379 \
  --redis-key-prefix myapp:workflows
```

## Namespace Isolation

Use `key_prefix` to isolate different applications or environments:

```bash
# App A workers (completely isolated from App B)
--redis-key-prefix app_a:workflows

# App B workers
--redis-key-prefix app_b:workflows

# Environment separation
--redis-key-prefix myapp:prod:workflows
--redis-key-prefix myapp:dev:workflows
```

**Important**: Producer and Workers must use the same `key_prefix` and identical Python environments (same requirements.txt).

## Production Deployment

### Minimal Setup (Single Server)

```
┌─────────────────────────────────┐
│       Single Server             │
│                                 │
│  ┌──────────┐  ┌────────────┐  │
│  │  Redis   │  │ Graflow    │  │
│  │  (Queue) │  │ Worker x3  │  │
│  └──────────┘  └────────────┘  │
│                                 │
│  ┌──────────────────────────┐  │
│  │  Main Application        │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
```

### Scalable Setup (Multi-Server)

```
┌──────────────┐
│ Redis Cluster│
│  (HA Setup)  │
└──────┬───────┘
       │
   ┌───┴───┬───────┬────────┐
   │       │       │        │
┌──▼───┐ ┌─▼────┐ ┌─▼─────┐ ┌─▼─────┐
│Server1│ │Server2│ │Server3│ │Server4│
│4 Work.│ │8 Work.│ │2 Work.│ │ GPU   │
└───────┘ └──────┘ └───────┘ └───────┘
```

### Docker Compose

```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes

  worker:
    image: graflow-worker:latest
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_KEY_PREFIX=myapp:workflows
      - MAX_CONCURRENT_TASKS=4
    deploy:
      replicas: 3
    depends_on:
      - redis
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: graflow-worker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: graflow-worker
  template:
    spec:
      containers:
      - name: worker
        image: graflow-worker:latest
        args:
          - --worker-id=$(POD_NAME)
          - --redis-host=redis-service
          - --redis-key-prefix=myapp:workflows
        env:
          - name: POD_NAME
            valueFrom:
              fieldRef:
                fieldPath: metadata.name
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "2000m"
            memory: "2Gi"
```

### Autoscaling with HPA

Scale workers based on Redis queue depth:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: graflow-worker-hpa
spec:
  scaleTargetRef:
    kind: Deployment
    name: graflow-worker
  minReplicas: 1
  maxReplicas: 20
  metrics:
  - type: External
    external:
      metric:
        name: graflow_queue_depth
      target:
        type: AverageValue
        averageValue: "10"  # 10 tasks per worker
```

Requires Prometheus + Prometheus Adapter with a metrics exporter:

```python
from prometheus_client import Gauge, generate_latest
from flask import Flask, Response
import redis, os

app = Flask(__name__)
gauge = Gauge('graflow_queue_depth', 'Queue depth', ['key_prefix'])

@app.route('/metrics')
def metrics():
    r = redis.Redis(host=os.getenv('REDIS_HOST'), port=6379)
    prefix = os.getenv('KEY_PREFIX', 'graflow')
    gauge.labels(key_prefix=prefix).set(r.llen(f"{prefix}:queue"))
    return Response(generate_latest(), mimetype='text/plain')
```

### Systemd Service

```ini
[Unit]
Description=Graflow Worker

[Service]
ExecStart=/usr/bin/python3 -m graflow.worker.main --worker-id worker-1
Restart=always

[Install]
WantedBy=multi-user.target
```

## Best Practices

| Practice | Description |
|----------|-------------|
| **Namespace isolation** | Separate `key_prefix` per application |
| **Environment consistency** | Same Python version and dependencies |
| **Stateless workers** | Easy horizontal scaling |
| **Avoid `goto` in ParallelGroup** | Can break barrier synchronization |
| **Limit nesting depth** | Keep ParallelGroup nesting to 2-3 levels |
| **Graceful shutdown** | Always handle SIGTERM properly |

## Comparison with Competitors

| Feature | Graflow | Celery | LangGraph | Airflow |
|---------|---------|--------|-----------|---------|
| **Built-in CLI** | ✅ `python -m graflow.worker.main` | ✅ `celery worker` | ❌ | ✅ |
| **Graceful Shutdown** | ✅ SIGTERM/SIGINT | ✅ | N/A | ✅ |
| **Metrics** | ✅ Built-in | ⚠️ Requires Flower | ❌ | ✅ |
| **Auto-scaling** | ✅ HPA + queue depth | ✅ | ❌ | ⚠️ Limited |
| **State Sharing** | ✅ Redis Channels | ⚠️ Via broker | ⚠️ State object | ⚠️ XCom |
