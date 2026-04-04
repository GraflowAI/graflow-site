---
title: "LangGraphユーザーのためのGraflow入門 〜比較で学ぶハンズオンガイド〜"
emoji: "🌊"
type: "tech"
topics: ["python", "workflow", "ai", "graflow", "langgraph"]
published: false
---

## はじめに

本記事は、[@takuh](https://zenn.dev/takuh) さんの「[LangGraph 入門 〜初学者のためのハンズオンガイド〜](https://zenn.dev/takuh/articles/084dc043ffa56c)」にインスパイアされて執筆しました。LangGraphの概念を丁寧に解説されている素晴らしい記事ですので、LangGraphに興味がある方はぜひご一読ください。

Claude CodeやOpenHands（旧OpenDevin）のような**自律型コーディングエージェント**が注目を集めています。しかしエンタープライズの現場では、コンプライアンス要件、承認フロー、監査証跡といった制約から、**AIにすべてを任せきる完全自律型がそのまま適用できるケースは限られます**。むしろ「AIが処理を進めつつ、要所では人間が判断・承認する」**半自律型のアプローチ**——すなわち **Agentic Workflow** ——が、現実的な落としどころとして、特にエンタープライズなど制約の大きい領域では、完全自律型から半自律型へのゆり戻しが起きるのではないかと考えています。

本記事では、Agentic Workflowを構築するためのフレームワークとして、LangGraphと並べて **[Graflow](https://graflow.ai/)** を紹介します。両者を比較しながら、検討のきっかけになれば幸いです。

### Graflowとは

**[Graflow](https://github.com/GraflowAI/graflow)** は、AIエージェントワークフローのための Python ベースのオーケストレーションエンジンです。

- **GitHub**: https://github.com/GraflowAI/graflow
- **プロジェクトサイト**: https://graflow.ai/
- **ライセンス**: Apache License v2（OSS）

Graflowは、[2025年度上期 IPA 未踏アドバンスド事業](https://www.ipa.go.jp/jinzai/mitou/advanced/2025first/gaiyou-sd-3.html)の支援を受けて開発しました。

### LangGraphとの関係

[LangGraph](https://langchain-ai.github.io/langgraph/) は、LLMアプリケーションにおける代表的なオーケストレーションフレームワークです。State・Node・Edgeの3要素でグラフを構築し、条件分岐やHuman-in-the-Loopを実現できる強力なツールです。一方で、「学習曲線が急峻」「抽象化が深すぎて複雑」という声も少なくありません[^dev_voice]。

[^dev_voice]: [Grokでの開発者の声のまとめ](https://grok.com/share/c2hhcmQtMw_032907d4-882e-45fd-9ad4-ab7698e64c1b)。急峻な学習曲線、抽象化の層が深すぎて複雑といった意見が多い。

本記事では、LangGraphの各コンセプトに対してGraflowがどうアプローチするかを、コード比較を交えて紹介します。LangGraphを触ったことがある方なら、「あの概念がGraflowではこう書ける」という形で理解が進むはずです。

:::message
**Graflowの設計思想について**
本記事はハンズオン（使い方の比較）にフォーカスしています。Graflowの設計思想やポジショニングについては、[Graflowの設計解説記事](https://zenn.dev/myui/articles/27f69e5fe41345)をご覧ください。
:::

### 対象読者

- LangGraph を触ったことがある、または興味がある方
- Python ベースのワークフローエンジンを探している方
- AIエージェントワークフローをもっとシンプルに書きたい方

---

## なぜGraflowか？ 〜LangGraphで感じる5つの壁〜

LangGraphは優れたフレームワークですが、プロダクション環境で使い込むと以下のような壁にぶつかることがあります。Graflowはこれらの課題を解決するために設計されました。

### 壁1: グラフ定義が冗長で、構造が読み取りにくい

LangGraphでは `add_node` → `add_edge` → `compile` と3ステップを踏み、ノード数が増えるほど `add_edge` の行数も膨れ上がります。Graflowでは **`>>` と `|` 演算子で1行**でワークフロー構造が読めます。

```python
# LangGraph: 5行
graph.add_edge(START, "fetch")
graph.add_edge("fetch", "transform_a")
graph.add_edge("fetch", "transform_b")
graph.add_edge("transform_a", "store")
graph.add_edge("transform_b", "store")

# Graflow: 1行
fetch >> (transform_a | transform_b) >> store
```

### 壁2: 条件分岐とループを事前定義しなければならない

`add_conditional_edges` ですべての分岐パスをコンパイル時に固定する必要があり、実行時にデータ量やスコアに応じて柔軟に分岐するのが困難です。Graflowでは **`next_task()` / `next_iteration()` で実行時に動的に制御**できます。

### 壁3: チェックポイントの自動保存が重く、制御もできない

LangGraphのチェックポイントはステップごとに自動保存される設計ですが、State全体のシリアライズ+ストレージ書き込みは**重い処理**であり、ワークフローのスループットに影響します。一方でユーザーが保存タイミングを制御する手段はありません。Graflowでは **`context.checkpoint()` で重要なポイントだけを選んで明示的に保存**でき、パフォーマンスと信頼性を両立します。

### 壁4: タスクの分散実行の仕組みがない

LangGraphはシングルノード（単一プロセス）での実行を前提としており、**タスクを複数のワーカーマシンに分散する仕組みは用意されていません**。並列実行はノード内のスレッド並列（`Send` による同一プロセス内の並列実行）に限られます。[LangGraph Platform](https://langchain-ai.github.io/langgraph/concepts/langgraph_platform/) はワークフロー自体のホスティングサービスであり、タスクレベルの分散実行エンジンではありません。

Graflowは **Redisベースの分散ワーカーをOSSとして標準装備**しており、Apache Airflowの Celery Executor と同様に、タスクを複数のワーカーマシンに分散して水平スケールできます。ローカル実行から分散実行への切り替えは1行で可能です。

### 壁5: LangChainエコシステムに縛られる

LangGraphは以下のように **LangChainを前提とした階層構造**[^langgraph_hierarchy]の上に成り立っています:

```
LangGraph（オーケストレーション）
   ↓ 依存
LangChain（コンポーネント: プロンプト、ツール、メモリ等）
   ↓ 依存
langchain-openai / langchain-anthropic 等（LLMプロバイダー固有パッケージ）
   ↓ 呼び出し
OpenAI / Anthropic / Google 等（LLM API）
```

LLM呼び出しに `langchain-openai` 等が必要で、エージェント構築も `create_react_agent` という自前実装に誘導されます。LLMプロバイダーを変更するだけでも、対応する `langchain-*` パッケージの追加とコード変更が必要です。

Graflowはこの依存チェーンを断ち切り、**LiteLLM統合でプロバイダー非依存**を実現しています。SuperAgentは **Google ADK や PydanticAI 等の専門フレームワークをそのまま利用**できます。

```
Graflow（オーケストレーション）
   ├─→ LiteLLM（統一LLM API: OpenAI/Claude/Gemini等を同一インターフェースで利用）
   └─→ Google ADK / PydanticAI 等（SuperAgentフレームワーク: 好みのものを選択）
```

[^langgraph_hierarchy]: この階層構造は [@Takuya__ さんの解説](https://qiita.com/Takuya__/items/a6bc40462dd210134e18#122-langgraph%E3%81%A8langchain%E3%81%AE%E9%96%A2%E4%BF%82) に基づきます。

### 設計思想の根本的な違い: Define-and-Run vs Define-by-Run

LangGraphとGraflowの違いを一言で表すと、深層学習フレームワークにおける **Define-and-Run（TensorFlow 1.x）** と **Define-by-Run（PyTorch/Chainer）** の違いに対応します。

**LangGraph: Define-and-Run**
1. `add_node` / `add_edge` / `add_conditional_edges` でグラフ構造を**事前に完全定義**
2. `compile()` でグラフを**固定**
3. `invoke()` で実行

ノード（処理単位）はコンパイル時に静的に固定され、実行時に追加できません。エッジについては `conditional_edges` で動的に選択でき、さらに [`Send` API](https://zenn.dev/pharmax/articles/be6b57dc114496) を使えば**同一ノードを異なる入力で複数回並列実行**することも可能です[^send]。ただし、`Send`はあくまで事前定義済みのノードに対して動的にエッジを張る仕組みであり、**新しいノード自体を実行時に生成する**ことはできません。

[^send]: `Send` は `add_conditional_edges` のルーティング関数から `Send("node_name", state)` のリストを返すことで、同一ノードを異なるStateで並列実行します。Map-Reduceパターンの実装に有用ですが、グラフ全体のStateが自動的に渡されない、Reducer関数の定義が必要など、注意点もあります。詳しくは [pharmax さんの解説記事](https://zenn.dev/pharmax/articles/be6b57dc114496) を参照してください。

**Graflow: Define-by-Run（[DAG × State Machine ハイブリッド](https://graflow.ai/docs/getting-started/introduction#dynamic-transitions-at-runtime)）**
1. `>>` / `|` 演算子でDAGの**骨格**を定義（静的構造）
2. タスク内部の `next_task()` / `next_iteration()` で**実行時に動的遷移**（State Machine）
3. 実行しながらグラフを構築

PyTorchが計算グラフを実行しながら動的に構築するように、Graflowはワークフローグラフを**実行しながら動的に拡張**できます。事前に全パスを定義する必要がないため、実行時にデータ量やスコアに応じたタスク生成・分岐が自然に書けます。

```python
# 静的な骨格（DAG部分）
fetch >> (validate | enrich) >> process >> save

# 動的な遷移（State Machine部分）
@task(inject_context=True)
def process(context: TaskExecutionContext):
    result = run_processing()
    if result.score < 0.8:
        context.next_iteration()           # 自己ループ（リトライ）
    elif result.has_error:
        context.next_task(error_handler, goto=True)  # ジャンプ
    else:
        context.next_task(finalize_task)   # 動的分岐
```

この **「静的な可読性 + 動的な柔軟性」の両立** が、Graflowの開発者体験（DX）の核心です。

### Graflowの5つのコア価値

| # | コア価値 | 実現手段 |
|---|---|---|
| 1 | **直感的な記述** | `>>` / `\|` 演算子でワークフロー構造が1行で読める |
| 2 | **実行時の柔軟性（Define-by-Run）** | `next_task()` / `next_iteration()` で動的にタスクを生成・分岐 |
| 3 | **プロダクション対応** | ユーザー制御checkpoint、HITL + タイムアウト、Dockerハンドラー |
| 4 | **分散スケーリング** | Redisベースワーカー（OSS標準装備）で水平スケール |
| 5 | **フレームワーク非依存** | LLM/Agent統合は好みのツールを選択可能 |

---

以降の章では、LangGraphの各コンセプトに対応するGraflowのコードを比較しながら、これらの価値を具体的に見ていきます。

### 基本概念の対応関係

まず、両フレームワークの概念マッピングを押さえておきましょう。

| LangGraph | Graflow | 役割 |
|---|---|---|
| State（`TypedDict`） | Channel（Key-Valueストア） | データ共有 |
| Node（関数） | Task（`@task`デコレータ） | 処理の単位 |
| Edge（`add_edge`） | 演算子（`>>`、`\|`） | 処理の流れ |
| `StateGraph` + `compile()` | `workflow()` コンテキスト | グラフ構築 |
| `conditional_edges` | `next_task()` / `next_iteration()` | 条件分岐・ループ |
| Reducer（`Annotated`） | Channel の `set` / `get` | 状態の更新方法 |
| `interrupt` + `MemorySaver` | `request_feedback()` + `checkpoint()` | Human-in-the-Loop |

---

## 1. 環境構築

**LangGraph:**
```bash
pip install -U langgraph langchain-openai
```

**Graflow:**
```bash
pip install graflow
# または uv を使う場合
uv add graflow
```

Graflow は LangChain エコシステムへの依存がなく、単体で動作します。

---

## 2. 最初のグラフを作る — Stateの事前定義は不要

LangGraphの公式入門にある「文字列を順に連結する」サンプルで比較します。

### LangGraph

```python
from langgraph.graph import START, StateGraph
from typing_extensions import TypedDict

# State を TypedDict で定義
class State(TypedDict):
    text: str

# ノード: State を受け取り、更新する dict を返す
def node_a(state: State) -> dict:
    return {"text": state["text"] + "a"}

def node_b(state: State) -> dict:
    return {"text": state["text"] + "b"}

# グラフを組み立て
graph = StateGraph(State)
graph.add_node("node_a", node_a)
graph.add_node("node_b", node_b)
graph.add_edge(START, "node_a")
graph.add_edge("node_a", "node_b")

# コンパイルして実行
compiled = graph.compile()
result = compiled.invoke({"text": ""})
print(result)  # {'text': 'ab'}
```

LangGraphでは、(1) `TypedDict`でStateを定義、(2) ノード関数はStateを受け取り更新dictを返す、(3) `add_node`と`add_edge`でグラフを組み立て、(4) `compile()`後に`invoke()`で実行、という4ステップを踏みます。

### Graflow

```python
from graflow.core.context import TaskExecutionContext
from graflow.core.decorators import task
from graflow.core.workflow import workflow

with workflow("my_pipeline") as ctx:

    @task(inject_context=True)
    def task_a(context: TaskExecutionContext):
        channel = context.get_channel()
        text = channel.get("text", "")
        channel.set("text", text + "a")

    @task(inject_context=True)
    def task_b(context: TaskExecutionContext):
        channel = context.get_channel()
        text = channel.get("text", "")
        channel.set("text", text + "b")

    # >> 演算子で順序を定義
    task_a >> task_b

    # 実行
    results = ctx.execute("task_a")
    print(results.channel.get("text"))  # 'ab'
```

Graflowでは、(1) `@task`で関数をそのままタスク化、(2) `>>`演算子で依存関係を定義、(3) `ctx.execute()`で実行。**Stateの事前定義（TypedDict）、`add_node`/`add_edge`の個別呼び出し、`compile()`ステップが不要**です。タスク間のデータ共有は **Channel**（Key-Valueストア）を介して行います。

:::message
**ポイント**: LangGraphではすべてのノードが共有State（TypedDict）を介してデータをやり取りし、Stateスキーマの事前定義とReducerの設定が必要です。Graflowではタスクは**通常のPython関数**であり、データ共有が必要な場合だけChannelの `set`/`get` で明示的にやり取りします。Channelの詳細は[第4章](#4-タスク間のデータ共有--reducerは不要)で解説します。
:::

:::details Low-Level API: add_node / add_edge スタイルも使える
Graflowは `>>` / `|` 演算子による簡潔な記法を推奨していますが、LangGraphのような `add_node()` / `add_edge()` スタイルの**Low-Level API**もサポートしています。動的なグラフ構築、外部ワークフロー定義からの変換、グラフの分析・検証など、細かい制御が必要な場面で活用できます。

```python
from graflow.core.context import ExecutionContext
from graflow.core.engine import WorkflowEngine
from graflow.core.graph import TaskGraph
from graflow.core.task import TaskWrapper

# LangGraph風にグラフを構築
graph = TaskGraph()

extract = TaskWrapper("extract", func=extract_fn, register_to_context=False)
transform = TaskWrapper("transform", func=transform_fn, register_to_context=False)
load = TaskWrapper("load", func=load_fn, register_to_context=False)

graph.add_node(extract, "extract")
graph.add_node(transform, "transform")
graph.add_node(load, "load")

graph.add_edge("extract", "transform")
graph.add_edge("transform", "load")

# 実行
context = ExecutionContext.create(graph, "extract", max_steps=10)
engine = WorkflowEngine()
engine.execute(context)
```

High-Level APIとLow-Level APIを**混在させる**ことも可能です:

```python
# High-Level APIでベースを構築
with workflow("mixed") as ctx:
    task_a >> task_b

    # Low-Level APIでグラフを動的に拡張
    task_c = TaskWrapper("task_c", func=my_func, register_to_context=False)
    ctx.graph.add_node(task_c, "task_c")
    ctx.graph.add_edge("task_b", "task_c")

    ctx.execute("task_a")
```

詳細は [Low-Level TaskGraph API のサンプルコード](https://github.com/GraflowAI/graflow/blob/main/examples/02_workflows/task_graph_lowlevel_api.py) を参照してください。
:::

---

## 3. 並列実行 — 1行で構造が読める

### LangGraph

LangGraphで並列実行を行うには、分岐元から複数のノードにエッジを張り、合流先への依存を設定します。

```python
graph = StateGraph(State)
graph.add_node("fetch", fetch_fn)
graph.add_node("transform_a", transform_a_fn)
graph.add_node("transform_b", transform_b_fn)
graph.add_node("store", store_fn)

graph.add_edge(START, "fetch")
graph.add_edge("fetch", "transform_a")
graph.add_edge("fetch", "transform_b")
graph.add_edge("transform_a", "store")
graph.add_edge("transform_b", "store")

app = graph.compile()
```

ノード数が増えるほど `add_edge` の行数も増え、全体の構造が読み取りにくくなります。

### Graflow

```python
with workflow("diamond") as ctx:

    @task
    def fetch():
        print("データ取得")

    @task
    def transform_a():
        print("変換A")

    @task
    def transform_b():
        print("変換B")

    @task
    def store():
        print("保存")

    # Diamond パターンが1行で表現できる
    fetch >> (transform_a | transform_b) >> store

    ctx.execute("fetch")
```

`>>` が直列、`|` が並列。**Diamond（Fan-out → Fan-in）パターンが1行**で書けます。動的にタスクリストを構築する場合は関数スタイルも使えます:

```python
from graflow.core.task import chain, parallel

# 演算子スタイルと等価
chain(fetch, transform, load)
parallel(task_a, task_b, task_c)

# 動的なタスクリスト構築
tasks = [create_task(i) for i in range(10)]
parallel(*tasks)  # 10個のタスクを並列実行
```

---

## 4. タスク間のデータ共有 — Reducerは不要

LangGraphではグラフ全体で1つの `State`（TypedDict）を共有し、各ノードがその一部を更新する設計です。更新のマージ方法をReducerで制御する必要があります。Graflowでは **Channel**（Key-Valueストア）で明示的にデータを読み書きするため、Reducerという概念自体が不要です。

### LangGraph: State + Reducer

```python
from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages

class State(TypedDict):
    messages: Annotated[list, add_messages]  # Reducer: メッセージは追加
    counter: int                              # Reducerなし: 上書き

def node_a(state: State) -> dict:
    return {"counter": state["counter"] + 1}
```

LangGraphでは、Stateの各フィールドに Reducer（`add_messages`、`operator.add`、カスタム関数）を `Annotated` で指定して、複数ノードからの更新をどうマージするかを制御します。

### Graflow: Channel

```python
from graflow.core.context import TaskExecutionContext
from graflow.core.decorators import task

@task(inject_context=True)
def producer(context: TaskExecutionContext):
    channel = context.get_channel()
    channel.set("config", {"batch_size": 100})
    channel.set("counter", 1)

@task(inject_context=True)
def consumer(context: TaskExecutionContext):
    channel = context.get_channel()
    config = channel.get("config")          # {"batch_size": 100}
    counter = channel.get("counter")        # 1
    channel.set("counter", counter + 1)     # 明示的に更新
```

Graflowでは `inject_context=True` でタスクに `TaskExecutionContext` を注入し、`channel.set()` / `channel.get()` でデータを読み書きします。Reducer という概念は不要で、**何をいつ更新するかはタスクの中で明示的に制御**します。

さらに、**自動キーワード引数解決**を使えば `inject_context` すら不要です:

```python
@task(inject_context=True)
def setup(context: TaskExecutionContext):
    channel = context.get_channel()
    channel.set("user_name", "Alice")
    channel.set("user_city", "Tokyo")

@task
def greet(user_name: str, user_city: str = "Unknown"):
    # inject_context 不要！引数名がチャンネルのキーと自動一致
    print(f"Hello, {user_name} from {user_city}!")
```

### MemoryChannel と RedisChannel — LangGraph State との決定的な違い

LangGraphの `State`（TypedDict）は**オンメモリの辞書**です。単一プロセス内でしか共有できず、プロセスが終了すればデータは消えます。大量のデータを State に載せるとメモリを圧迫し、チェックポイント保存時のシリアライズコストも増大します。

Graflowの Channel は**バックエンドを切り替え可能**です:

| バックエンド | 特徴 | 用途 |
|---|---|---|
| **MemoryChannel**（デフォルト） | 高速、追加インフラ不要、checkpoint時に自動保存 | ローカル実行、開発・テスト |
| **RedisChannel** | 複数ワーカー間で共有、永続化、大容量データ対応 | 本番環境、分散実行 |

```python
# ローカル実行（デフォルト: MemoryChannel）
with workflow("local_pipeline") as ctx:
    ...

# 分散実行（RedisChannel）: バックエンドを切り替えるだけ
context = create_execution_context(
    channel_backend="redis",
    redis_url="redis://localhost:6379"
)
```

**MemoryChannel** はローカル実行で最速のパフォーマンスを提供しつつ、checkpoint時にはChannelの状態も自動的に永続化されます。**RedisChannel** に切り替えれば、メモリに載せるには大きなデータも扱え、複数ワーカー間でデータを共有できます。Apache Airflow の [XCom](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/xcoms.html) に近い概念ですが、Redisバックエンドにより低レイテンシかつ大容量のデータ交換が可能です。

RedisChannel を採用するもう一つの利点は、**マルチエージェント間の通信にも原理的に利用できる**ことです。複数のワークフロー（エージェント）が同一のRedisチャンネルを介してデータを交換すれば、エージェント間の協調動作が実現できます。また、Redis はシングルスレッド＋非同期I/O（ノンブロッキングI/O＋イベントループ）で動作する[^redis_single_thread]ため、コマンドは常に逐次実行されます。複数ワーカーからの同時書き込みでも**競合状態（race condition）が発生せず**、アプリケーション側でロックや排他制御を意識する必要がありません。

[^redis_single_thread]: Redisのシングルスレッドモデルについては [こちらの解説記事](https://qiita.com/kotobuki5991/items/d07731f84e7c75493897) が参考になります。RedisはCPUではなくネットワークI/Oがボトルネックとなるため、マルチスレッド化のオーバーヘッド（スレッド生成・破棄、スケジューリング、ロック競合）を排除し、ノンブロッキングI/O＋イベントループで高スループットを実現しています。シングルスレッドで全コマンドが逐次実行されるため、データ操作のアトミック性が本質的に保証されます。

LangGraphの State は「単一プロセスのオンメモリ辞書」に固定されていますが、Graflowの Channel は**同じAPIのままバックエンドだけを差し替えることで、ローカル開発から分散本番環境までシームレスに移行**できます。

型安全性が必要な場合は **TypedChannel** も使えます:

```python
from typing import TypedDict

class UserProfile(TypedDict):
    user_id: str
    name: str
    email: str

@task(inject_context=True)
def collect_user(context: TaskExecutionContext):
    profile_ch = context.get_typed_channel(UserProfile)
    profile_ch.set("current_user", {
        "user_id": "u_123", "name": "Alice", "email": "alice@example.com"
    })
```

---

## 5. 条件分岐とループ — 事前定義不要の動的制御

ここがLangGraphとGraflowで**最も設計思想が異なるポイント**であり、Graflowの最大の売りの一つです。

### LangGraph: compile時に全パスを事前定義

```python
def should_retry(state):
    return "retry" if state["score"] < 0.8 else "continue"

graph = StateGraph(State)
graph.add_node("process", process_fn)
graph.add_node("retry", retry_fn)
graph.add_node("finalize", finalize_fn)

# すべての分岐パスを事前定義
graph.add_conditional_edges(
    "process",
    should_retry,
    {"retry": "retry", "continue": "finalize"}
)
graph.add_edge("retry", "process")  # ループも事前定義
graph.add_edge("finalize", END)

app = graph.compile()  # ここで構造が固定される
```

LangGraphでは `add_conditional_edges` で分岐パスを**コンパイル時に全て定義**する必要があります。なお、[`Send` API](https://zenn.dev/pharmax/articles/be6b57dc114496) を使えば、事前定義済みのノードに対して動的にエッジを張り、同一ノードを異なる入力で並列実行（Map-Reduceパターン）することは可能です。ただし、**新しいノード自体の動的生成はできず**、`Send`で実行されるノードにはグラフ全体のStateが自動的に渡されないなど、制約があります。

### Graflow: 実行時の動的制御

Graflowでは、タスク内部で `next_task()` や `next_iteration()` を使い、**実行時に次のアクションを決定**します。

```python
@task(inject_context=True)
def process_data(context: TaskExecutionContext):
    result = run_processing()

    if result.score < 0.8:
        # リトライ: 自分自身を再実行
        context.next_iteration()
    else:
        # 次のタスクへ進む
        context.next_task(finalize_task())
```

**事前に全パスを定義する必要がなく、タスク（ノード）自体も実行時に動的に生成**できます。LangGraphの `Send` が「事前定義済みノードへの動的エッジ」であるのに対し、Graflowの `next_task()` は「新しいタスクの生成＋グラフへの追加」を実行時に行います:

```python
@task(inject_context=True)
def process_directory(context: TaskExecutionContext):
    files = list_files()  # 実行時にファイル数が判明

    # ファイル数に応じてタスクを動的生成（Fan-out）
    for file in files:
        context.next_task(
            TaskWrapper(f"process_{file}", lambda f=file: process_file(f))
        )

@task(inject_context=True)
def adaptive_processing(context: TaskExecutionContext):
    quality = check_quality()

    # データ品質に応じて実行時に分岐先を決定
    if quality < 0.5:
        context.next_task(cleanup_task())
    elif quality > 0.9:
        context.next_task(enhance_task())
    else:
        context.next_task(standard_task())
```

Graflowの動的制御メソッド一覧:

| メソッド | 動作 | 用途 |
|---|---|---|
| `next_task(task)` | 新しいタスクを追加 | 動的分岐、Fan-out |
| `next_task(task, goto=True)` | 既存タスクにジャンプ（後続スキップ） | 早期脱出、エラーハンドリング |
| `next_iteration()` | 自分自身を再実行 | 収束ループ、ポーリング |
| `terminate_workflow()` | 正常終了 | 早期完了 |
| `cancel_workflow(reason)` | 異常終了 | エラー時のキャンセル |

### イテレーション制御とリトライ

`next_iteration()` による手動ループに加え、Graflowでは **`max_cycles`（イテレーション上限）** と **`max_retries` / `RetryPolicy`（失敗時の自動リトライ）** をデコレータで宣言的に設定できます。

```python
# イテレーション: 最大20回繰り返し、収束したら早期終了
@task(inject_context=True, max_cycles=20)
def optimize(ctx: TaskExecutionContext, data=None):
    loss = (data or {}).get("loss", 1.0) * 0.5
    if loss < 0.05:
        return  # 収束 → 後続タスクへ
    if ctx.can_iterate():
        ctx.next_iteration({"loss": loss})

# リトライ: 例外発生時に指数バックオフで自動再試行
@task(retry_policy=RetryPolicy(max_retries=3, initial_interval=1.0, backoff_factor=2.0))
def call_api():
    return requests.get("https://api.example.com/data").json()
```

LangGraphでも `RetryPolicy` によるノード単位のリトライは可能ですが（[8章参照](#タスク単位のリトライretrypolicy)）、**イテレーション（同一タスクの意図的な繰り返し）を制御する仕組みはありません**。LangGraphでループを実現するには `add_conditional_edges` でグラフにサイクルを事前定義する必要があります。

| 機能 | LangGraph | Graflow |
|---|---|---|
| **リトライ（失敗時の自動再試行）** | `RetryPolicy`（`add_node` で指定） | `RetryPolicy`（`@task` で指定）+ `default_max_retries` |
| **イテレーション（意図的な繰り返し）** | `add_conditional_edges` でサイクルを事前定義 | `@task(max_cycles=N)` + `next_iteration()` |

詳しくは [Task Retries](https://graflow.ai/docs/tutorial/advanced/retries)・[Task Iterations](https://graflow.ai/docs/tutorial/advanced/iterations) を参照してください。

:::message
**Define-by-Run: 実行しながらグラフを構築**
冒頭で述べた通り、これはPyTorch/Chainerの「Define-by-Run」と同じ発想です。LangGraphは`compile()`でグラフを固定する「Define-and-Run」設計であり、ノードの動的追加はできません（エッジの動的選択は可能だが、選択肢は事前定義が必要）。Graflowは**タスク（ノード）もエッジも実行時に動的に追加**でき、データ駆動のワークフローが自然に書けます。
:::

---

## 6. Human-in-the-Loop — タイムアウト時に自動でリソース解放

### LangGraph: interrupt — 例外処理に似た制御フロー

LangGraphの `interrupt()` は、内部的には**例外（`GraphInterrupt`）を送出してグラフの実行を中断**する仕組みです。Pythonの `raise` / `try-except` に似た制御フローであり、ノード関数の途中で呼ばれると、それ以降の処理は実行されずにグラフ全体が停止します。

```python
from langgraph.types import interrupt, Command
from langgraph.checkpoint.memory import MemorySaver

def request_approval(state: State) -> dict:
    # ここで GraphInterrupt 例外が送出され、関数の実行が中断される
    user_input = interrupt({
        "message": "実行してよいですか？",
        "action": state["action"],
    })
    # ↑ 初回実行時、ここから下は実行されない
    # Command(resume=値) で再開すると、interrupt() が値を返し、ここから続行
    return {"approved": user_input.lower() == "yes"}

memory = MemorySaver()
app = graph.compile(checkpointer=memory)

# 実行 → interrupt() で GraphInterrupt 例外が発生し一時停止
result = app.invoke(input, config)
# 再開: Command(resume="yes") で値を注入し、interrupt() の戻り値として返る
app.invoke(Command(resume="yes"), config)
```

これは、Pythonの例外処理に置き換えると以下のようなイメージです:

```python
# interrupt のイメージ（疑似コード）
def request_approval(state):
    raise GraphInterrupt({"message": "実行してよいですか？"})
    # ↑ ここで関数が中断。以降のコードは実行されない

# フレームワーク側が例外をキャッチし、チェックポイントを保存
# 再開時は、interrupt() が resume の値を返すように関数を再実行
```

この設計の特徴と注意点:

- **暗黙の中断**: `interrupt()` は一見普通の関数呼び出しに見えるが、実際には例外を送出する。コードの見た目からは「ここで処理が止まる」ことが読み取りにくい
- **再実行ベースの再開**: 再開時はノード関数が**最初から再実行**され、`interrupt()` の箇所で今度は `resume` の値が返る。つまり `interrupt()` より前の副作用（API呼び出し、DB書き込み等）が**2回実行される**可能性がある
- **チェックポインタ必須**: `interrupt()` を使うには `compile(checkpointer=...)` が必須。チェックポインタなしでは動作しない

### Graflow: request_feedback — 明示的な待機と通知

### Graflow: request_feedback + checkpoint

```python
@task(inject_context=True)
def request_deployment_approval(context):
    response = context.request_feedback(
        feedback_type="approval",
        prompt="本番環境へのデプロイを承認しますか？",
        timeout=300,  # 5分待機
        notification_config={
            "type": "webhook",
            "url": "https://hooks.slack.com/services/XXX",
            "message": "デプロイ承認が必要です"
        }
    )

    if response.approved:
        print("✅ 承認されました")
    else:
        context.cancel_workflow("承認が拒否されました")
```

Graflowの `request_feedback()` は例外ベースではなく、**通常の関数呼び出しとして応答を待機**します。`interrupt()` のように暗黙に例外を送出することはなく、コードの制御フローが見た目通りに動作します。また、通知設定（Slack Webhook、Discord、Teams等）を直接含められます。

Graflowは **2つの待機モード** をサポートしており、ユースケースに応じて使い分けられます:

**モード1: Blocking（タイムアウト付き同期待機）**

`timeout` を指定すると、指定時間内は**プロセスをブロックして応答を待機**します。すぐに返答が期待できるケース（対話的なオペレーション確認等）に適しています。

```python
response = context.request_feedback(
    feedback_type="approval",
    prompt="このまま続行しますか？",
    timeout=60,  # 60秒間ブロックして待機
)
# タイムアウト内に応答があれば、そのまま次の行へ
```

**モード2: タイムアウト後のチェックポイント保存 + 非同期再開**

タイムアウト内に応答がなかった場合、**自動でチェックポイントを保存してプロセスを解放**します。数時間〜数日後にAPI経由でフィードバックが届いた時点で、チェックポイントから再開します。

```python
response = context.request_feedback(
    feedback_type="approval",
    prompt="本番デプロイを承認しますか？",
    timeout=300,  # 5分間ブロック
    notification_config={
        "type": "webhook",
        "url": "https://hooks.slack.com/services/XXX",
    }
)
# 5分以内に応答 → そのまま続行（モード1）
# 5分経過 → checkpoint保存 → プロセス解放
# 後日API経由で承認 → checkpointから再開してここから続行（モード2）
```

**動作フロー:**

1. `request_feedback()` を呼び出し → 人間に通知
2. タイムアウト内に承認 → **そのまま続行**（Blockingモード）
3. タイムアウト経過 → **自動でチェックポイント保存、プロセスを解放**
4. 数時間後にFeedback API経由で承認 → **チェックポイントから再開**

LangGraphの `interrupt` は常にグラフ実行を中断し、外部から `Command(resume=)` を送って再開する方式のみです。Graflowは**短時間の同期待機と長時間の非同期再開の両方をシームレスに扱える**ため、「すぐ返ってくるかもしれないが、返ってこないかもしれない」という現実の承認フローに自然に対応できます。

### Built-in の Feedback API / UI

Graflowは HITL のための **REST API とフィードバックUI を標準装備**しています。LangGraphでは `interrupt` の結果を受け取って `Command(resume=)` を送る仕組みを自前で構築する必要がありますが、Graflowではフィードバック送信用のHTTPエンドポイントが組み込まれており、Slack Webhook等の通知から直接フィードバックAPIを呼び出す運用が可能です。

フィードバックの種類:

| タイプ | 説明 | 用途 |
|---|---|---|
| `approval` | 承認 / 却下 | デプロイ承認、重要操作の確認 |
| `text` | テキスト入力 | パラメータ入力、コメント |
| `selection` | 単一選択 | オプション選択 |
| `multi_selection` | 複数選択 | 複数項目の選択 |
| `custom` | カスタム | ドメイン固有のフィードバック |

---

## 7. Checkpoint/Resume — ユーザーが保存タイミングを制御

LangGraphのチェックポイントは各ステップで**自動保存**される設計です。一見便利に見えますが、チェックポイントの作成は**重い処理**です。ExecutionContext全体（State、メッセージ履歴等）をシリアライズしてストレージに書き込むため、ステップごとに自動保存すると**ワークフロー全体のスループットに影響**します。特にStateが大きい場合や、高頻度でステップが実行される場合（MLのエポックループ等）には顕著です。また、ユーザーが「ここで確実に保存したい」というタイミングを指定する手段がありません。

Graflowでは、**ユーザーが重要なポイントだけを選んで明示的に保存**できます。不要なチェックポイントを作らないため、パフォーマンスへの影響を最小限に抑えられます。

```python
from graflow.core.checkpoint import CheckpointManager

@task(inject_context=True)
def train_model(context):
    for epoch in range(100):
        loss = train_one_epoch(epoch)

        if epoch % 10 == 0:
            # 重要なポイントで明示的に保存
            context.checkpoint(
                path="/tmp/ml_checkpoint",
                metadata={"epoch": epoch, "loss": loss}
            )

# 障害発生後: 最後のチェックポイントから再開
CheckpointManager.resume_from_checkpoint("/tmp/ml_checkpoint")
```

保存先はローカルファイルシステム（`/tmp/...`）や S3（`s3://...`）を指定できます。

---

## 8. 並列グループのエラーポリシー

LangGraphには並列実行時のエラーハンドリングポリシーに相当する機能はありません。Graflowでは**並列グループ単位で柔軟にエラー制御**が可能です。

```python
from graflow.core.handlers.group_policy import (
    BestEffortGroupPolicy,
    AtLeastNGroupPolicy,
    CriticalGroupPolicy,
)
from graflow.coordination.executor import CoordinationBackend

# 一部失敗しても続行（通知送信など）
(send_email | send_sms | send_slack).with_execution(
    backend=CoordinationBackend.THREADING,
    policy=BestEffortGroupPolicy()
)

# 4つ中2つ成功すればOK（クォーラムベース）
(task_a | task_b | task_c | task_d).with_execution(
    backend=CoordinationBackend.THREADING,
    policy=AtLeastNGroupPolicy(min_success=2)
)

# 重要タスクだけ失敗判定（必須+オプション混在）
(extract | validate | enrich).with_execution(
    backend=CoordinationBackend.THREADING,
    policy=CriticalGroupPolicy(critical_task_ids=["extract", "validate"])
)
```

| ポリシー | 動作 | 適用例 |
|---|---|---|
| **Strict**（デフォルト） | 全タスク成功必須 | 金融取引、データ検証 |
| **Best-effort** | 部分成功で続行 | 通知送信、オプション処理 |
| **At-least-N** | 最小成功数を指定 | マルチリージョンデプロイ、冗長構成 |
| **Critical** | 重要タスクのみ判定 | 必須ステップ+オプションステップの混在 |
| **カスタム** | `GroupExecutionPolicy` を継承 | ドメイン固有のロジック |

### タスク単位のリトライ（RetryPolicy）

LangGraphでは `add_node` 時に `RetryPolicy` を指定してノード単位のリトライを設定します。

```python
# LangGraph
from langgraph.types import RetryPolicy

graph.add_node(
    "unstable_node", unstable_function,
    retry=RetryPolicy(max_attempts=3, initial_interval=1.0, backoff_factor=2.0)
)
```

Graflowでも同様に `RetryPolicy` を用意しており、`@task` デコレータで指定します。パラメータ体系はほぼ同じですが、Graflowでは `jitter`（±50%のランダム化）や `max_interval`（上限キャップ）も指定できます。

```python
# Graflow
from graflow.core.retry import RetryPolicy

@task(retry_policy=RetryPolicy(max_retries=3, initial_interval=1.0, backoff_factor=2.0))
def unstable_function():
    ...
```

また、`ExecutionContext.create(default_max_retries=3)` でワークフロー全体のデフォルトリトライ数を一括設定することも可能です。詳しくは [Task Retries](https://graflow.ai/docs/tutorial/advanced/retries) を参照してください。

---

## 9. 分散実行 — シングルプロセスの壁を超える

LangGraphはシングルプロセスでの実行を前提としており、並列実行は `Send` 等によるプロセス内のスレッド並列に限られます。タスクを複数のワーカーマシンに分散する仕組みは提供されていません。[LangGraph Platform](https://langchain-ai.github.io/langgraph/concepts/langgraph_platform/) はワークフロー自体のホスティングサービスであり、タスクレベルの分散実行エンジンではありません。

Graflowは **Redisベースの分散ワーカー** をOSSとして標準装備しており、タスクを複数のワーカーマシンに分散して水平スケールできます。ローカル実行から分散実行への切り替えは1行で可能です。

### Step 1: Redis を起動

```bash
docker run -p 6379:6379 redis:7.2
```

### Step 2: ワーカーを複数起動

```bash
python -m graflow.worker.main --worker-id worker-1 --redis-host localhost
python -m graflow.worker.main --worker-id worker-2 --redis-host localhost
python -m graflow.worker.main --worker-id worker-3 --redis-host localhost
```

### Step 3: 分散実行に切り替え

```python
# この1行だけでローカル → 分散に切り替え
parallel = (task_a | task_b | task_c).with_execution(
    backend=CoordinationBackend.REDIS,
    backend_config={"redis_client": redis_client}
)
```

Kubernetes環境では HPA（Horizontal Pod Autoscaler）でRedisキューの残タスク数に基づきワーカーPod数を自動調整できます。Apache Airflow の Celery Executor と同様のアーキテクチャです。

---

## 10. タスクハンドラー

LangGraphのノードはプロセス内実行のみですが、Graflowではタスクごとに**実行戦略（ハンドラー）を切り替え**られます。

```python
# デフォルト: プロセス内実行
@task
def simple_task():
    return "result"

# Docker コンテナ内で実行（GPU、依存関係の隔離）
@task(handler="docker", handler_kwargs={
    "image": "pytorch/pytorch:2.0-gpu",
    "gpu": True,
    "volumes": {"/data": "/workspace/data"},
})
def train_on_gpu():
    return train_model()
```

| ハンドラー | 説明 | 用途 |
|---|---|---|
| `direct` | プロセス内実行（デフォルト） | 一般的なタスク |
| `docker` | コンテナ実行 | GPU処理、LLM生成コードのサンドボックス実行 |
| カスタム | 自由に実装可能 | Cloud Run、リモート実行など |

---

## 11. LLM統合

### LangGraph: LangChainエコシステム前提

```python
from langchain_openai import ChatOpenAI
from langgraph.graph import MessagesState, StateGraph
from langchain_core.messages import HumanMessage, SystemMessage

llm = ChatOpenAI(model="gpt-4o-mini")

def call_llm(state: MessagesState) -> dict:
    system = SystemMessage(content="親切なアシスタントです")
    response = llm.invoke([system] + state["messages"])
    return {"messages": [response]}

graph = StateGraph(MessagesState)
graph.add_node("llm", call_llm)
graph.add_edge(START, "llm")
chatbot = graph.compile()
```

LangGraphでは、`MessagesState`（メッセージ履歴の自動追加Reducer）や`ChatOpenAI`など、LangChainエコシステムとの統合が前提です。エージェント構築には `create_react_agent` や `ToolNode` を使います。

### Graflow: フレームワーク非依存

Graflowは2つのLLM統合方式を提供しますが、**特定のLLMフレームワークに依存しません**。

**方式1: `inject_llm_client`（シンプルなLLM呼び出し）**

```python
from graflow.llm.client import LLMClient

context.register_llm_client(LLMClient())

@task(inject_llm_client=True)
def summarize(llm: LLMClient, text: str) -> str:
    # LiteLLM統合により、OpenAI/Claude/Gemini等を統一APIで利用
    return llm.completion_text(
        [{"role": "user", "content": f"要約してください: {text}"}],
        model="gpt-4o-mini"
    )

@task(inject_llm_client=True, inject_context=True)
def multi_model_task(llm: LLMClient, context: TaskExecutionContext):
    # タスク内で複数モデルを使い分け
    summary = llm.completion_text(messages, model="gpt-4o-mini")       # 低コスト
    analysis = llm.completion_text(messages, model="claude-sonnet-4-20250514")  # 高精度
```

**方式2: `inject_llm_agent`（SuperAgentの依存性注入）**

```python
from google.adk.agents import LlmAgent
from graflow.llm.agents.adk_agent import AdkLLMAgent

# Google ADK のエージェントをそのまま利用
adk_agent = LlmAgent(
    name="supervisor",
    model="gemini-2.5-flash",
    tools=[search_tool, calculator_tool],
    sub_agents=[analyst_agent, writer_agent]
)
agent = AdkLLMAgent(adk_agent)
context.register_llm_agent("supervisor", agent)

@task(inject_llm_agent="supervisor")
def research(agent, query: str) -> str:
    result = agent.run(query)
    return result["output"]
```

Graflowの設計思想は「SuperAgent（ReActループ等）は専門フレームワーク（Google ADK、PydanticAI等）に委譲し、ワークフローオーケストレーションに集中する」というものです。LangGraphがSuperAgentもワークフローも自前で実装するフルスタック型であるのに対し、Graflowは責務分離型のアプローチを取っています。

| | LangGraph | Graflow |
|---|---|---|
| **LLM呼び出し** | LangChain経由（`ChatOpenAI`等） | LiteLLM統合（プロバイダー非依存） |
| **エージェント** | `create_react_agent`（自前実装） | ADK/PydanticAI等を`inject_llm_agent`でラップ |
| **マルチモデル** | モデル切り替えにはノード分割が必要 | タスク内で `model=` パラメータで切り替え |

---

## 12. トレーシング（Observability）

### LangGraph: LangSmith（有償SaaS）

```python
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "ls-xxxxxxxx"
```

LangGraphは [LangSmith](https://smith.langchain.com/)（LangChain社の有償SaaSサービス）と統合されています。環境変数を設定するだけで、各ノードの実行時間、入出力データ、LLMトークン使用量、エラー詳細などが**自動的にトレース**されます[^langsmith_auto]。この手軽さは魅力ですが、**クローズドソースのSaaS**であり、セルフホスティングはできません。無料枠はありますが、本番利用には有償プランが必要です。

[^langsmith_auto]: LangSmithの自動トレース機能については [@Takuya__ さんの解説](https://qiita.com/Takuya__/items/a6bc40462dd210134e18) の第12章が参考になります。

### Graflow: LangFuse（OSS） + OpenTelemetry

Graflowは OSS の [Langfuse](https://langfuse.com/) をトレーシング基盤として採用しています。Langfuseは LangSmith と同等のObservability機能（トレース、評価、プロンプト管理）を提供しつつ、**セルフホスティングすれば完全無料**で運用できます。

#### セットアップ

**Step 1: Langfuseサーバーの準備**

ローカル開発には Docker で簡単に起動できます:

```bash
docker run -p 3000:3000 langfuse/langfuse
```

:::message
**本番環境へのデプロイ**
AWS上にLangfuse v3をセルフホスティングする方法については、[Terraform + ECS FargateでLangfuse v3をAWSにセルフホスティング](https://zenn.dev/myui/articles/c5a537874167b5)で詳しく解説しています。Kubernetes不要で月額約$130〜から運用可能です。
:::

**Step 2: 環境変数の設定**

`.env` ファイルにLangfuseの認証情報を設定します:

```bash
# .env
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxx
LANGFUSE_HOST=http://localhost:3000  # セルフホスト時
```

**Step 3: ワークフローにTracerを組み込む**

```python
from graflow.trace.langfuse import LangFuseTracer
from graflow.core.workflow import workflow

# LangFuseTracer を作成（.env から自動で認証情報を読み込み）
tracer = LangFuseTracer(enable_runtime_graph=True)

with workflow("my_workflow", tracer=tracer) as wf:
    search >> analyze >> report
    wf.execute("search")
```

たった3行の追加で、ワークフローの実行トレースがLangfuseに送信されます。

#### OpenTelemetryによるLLMトレースの自動関連付け

Graflowの `LangFuseTracer` は**OpenTelemetryコンテキスト伝播**をサポートしています。これにより、タスク内で呼び出されるLiteLLMやGoogle ADKのLLM呼び出しが、**自動的にワークフロートレースの子スパンとして関連付け**られます。

```python
@task(inject_llm_client=True, inject_context=True)
def analyze(llm: LLMClient, context: TaskExecutionContext):
    # この LLM 呼び出しは自動的に "analyze" タスクのスパン配下に記録される
    result = llm.completion_text(
        [{"role": "user", "content": "分析してください"}],
        model="gpt-4o-mini"
    )
    return result
```

LangSmithでは LangChain 経由の呼び出しのみがトレースされますが、Graflowでは**LiteLLM対応の全LLMプロバイダー**（OpenAI、Claude、Gemini等）のトレースが自動的にLangfuseに集約されます。

#### 分散実行でのトレース伝播

分散ワーカー環境でも、トレースIDが自動的に伝播されます。複数ワーカーにまたがるタスクの実行が**1つのトレースとして統合表示**されます。

```python
# ワーカー側: トレースIDを引き継いで既存トレースに接続
tracer.attach_to_trace(trace_id="existing-trace-id", parent_span_id="parent-span-id")
```

#### 実行グラフのエクスポート

`enable_runtime_graph=True` を指定すると、実行時のタスク依存関係をグラフとしてエクスポートできます:

```python
runtime_graph = tracer.get_runtime_graph()
graph_data = tracer.export_runtime_graph(format="json")
```

#### LangSmith vs Langfuse 比較

| 観点 | LangSmith（LangGraph） | Langfuse（Graflow） |
|---|---|---|
| **ライセンス** | クローズドソース（SaaS） | OSS（MIT License） |
| **セルフホスティング** | 不可 | Docker / ECS / Kubernetes |
| **コスト** | 有償プラン必須（本番利用） | セルフホストで完全無料 |
| **LLM対応** | LangChain経由のみ | LiteLLM対応の全プロバイダー |
| **コンテキスト伝播** | LangChain独自 | OpenTelemetry標準 |
| **分散トレース** | 非対応 | トレースID自動伝播 |

---

## 13. 総合ハンズオン 〜データ分析パイプライン〜

これまでの比較で見てきた要素を組み合わせて、実践的なパイプラインを構築してみましょう。

**やること**: データを取得 → 並列で分析 → レポート生成

```python
from graflow.core.context import TaskExecutionContext
from graflow.core.decorators import task
from graflow.core.workflow import workflow

with workflow("data_analysis") as ctx:

    @task(inject_context=True)
    def fetch_data(context: TaskExecutionContext):
        """データを取得してチャンネルに格納"""
        data = {
            "sales": [100, 200, 150, 300, 250],
            "costs": [50, 80, 60, 120, 100],
        }
        channel = context.get_channel()
        channel.set("raw_data", data)
        print(f"📥 データ取得: {len(data['sales'])}件")

    @task(inject_context=True)
    def analyze_sales(context: TaskExecutionContext):
        """売上分析（並列タスク1）"""
        channel = context.get_channel()
        sales = channel.get("raw_data")["sales"]
        total = sum(sales)
        channel.set("sales_total", total)
        print(f"📊 売上分析: 合計={total}, 平均={total/len(sales)}")

    @task(inject_context=True)
    def analyze_costs(context: TaskExecutionContext):
        """コスト分析（並列タスク2）"""
        channel = context.get_channel()
        costs = channel.get("raw_data")["costs"]
        total = sum(costs)
        channel.set("cost_total", total)
        print(f"💰 コスト分析: 合計={total}, 平均={total/len(costs)}")

    @task
    def generate_report(sales_total: int, cost_total: int):
        """分析結果を統合してレポート生成（自動キーワード引数解決）"""
        profit = sales_total - cost_total
        margin = (profit / sales_total) * 100
        print(f"\n📝 === 分析レポート ===")
        print(f"   売上合計: {sales_total}")
        print(f"   コスト合計: {cost_total}")
        print(f"   利益: {profit} （利益率: {margin:.1f}%）")

    # ワークフロー定義（1行で構造が読める）
    fetch_data >> (analyze_sales | analyze_costs) >> generate_report

    ctx.execute("fetch_data")
```

**出力:**
```
📥 データ取得: 5件
📊 売上分析: 合計=1000, 平均=200.0
💰 コスト分析: 合計=410, 平均=82.0

📝 === 分析レポート ===
   売上合計: 1000
   コスト合計: 410
   利益: 590 （利益率: 59.0%）
```

このコードには以下の要素が使われています:
- `@task` デコレータと `>>` / `|` 演算子
- Channel によるタスク間データ共有
- 自動キーワード引数解決（`generate_report` の引数がチャンネルから自動取得）
- Diamond パターン（Fan-out → Fan-in）

---

## 14. 総合ハンズオン 〜タスク管理エージェント〜

[@Takuya__ さんの記事](https://qiita.com/Takuya__/items/a6bc40462dd210134e18)の第13章では、LangGraphで「タスク管理エージェント」を構築しています。LLMがユーザーの指示を解釈してツールを選択し、重要タスクの削除時にはHuman-in-the-Loopで承認を求める、実践的なエージェントです。

同じエージェントをGraflowで構築し、設計アプローチの違いを見てみましょう。

### LangGraph版の構造（概要）

```python
# LangGraph: State + ToolNode + conditional_edges
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    tasks: list[dict]

graph = StateGraph(AgentState)
graph.add_node("agent", call_model)      # LLMがツール呼び出しを判断
graph.add_node("tools", ToolNode(tools)) # ツールを自動実行
graph.add_conditional_edges("agent", should_use_tools,
    {"tools": "tools", "end": END})
graph.add_edge("tools", "agent")         # ツール実行後にagentへループ

# HITL: 重要タスク削除時に interrupt() で承認要求
def delete_task(task_id: str):
    if task["important"]:
        approval = interrupt({"message": "重要タスクを削除しますか？"})
        if approval != "yes":
            return "削除がキャンセルされました"
```

LangGraphでは、`StateGraph` + `ToolNode` + `conditional_edges` + `interrupt` と複数の専用APIを組み合わせる必要があります。

### Graflow版: ADK SuperAgent + request_feedback

Graflowの設計思想は **「SuperAgent（ReActループ・ツール実行）は専門フレームワークに委譲し、ワークフローオーケストレーションに集中する」** というものです。ここでは Google ADK を SuperAgent として利用し、ツール定義・選択・実行のすべてを ADK に任せます。

```python
from google.adk.agents import LlmAgent
from graflow.core.context import ExecutionContext, TaskExecutionContext
from graflow.core.decorators import task
from graflow.core.workflow import workflow
from graflow.llm.agents.adk_agent import AdkLLMAgent
from graflow.llm.agents.base import LLMAgent

# タスクストア（実運用ではDBを利用）
task_store: list[dict] = []

# --- ツール定義（通常のPython関数） ---

def add_task(title: str, important: bool = False) -> str:
    """新しいタスクを作成する。

    Args:
        title: タスク名
        important: 重要タスクの場合はTrue
    Returns:
        作成結果メッセージ
    """
    entry = {"id": len(task_store) + 1, "title": title,
             "important": important, "done": False}
    task_store.append(entry)
    mark = "⭐" if important else ""
    return f"タスク「{title}」{mark}を追加しました（ID: {entry['id']}）"

def list_tasks() -> str:
    """タスク一覧を表示する。

    Returns:
        タスク一覧の文字列
    """
    if not task_store:
        return "タスクはありません"
    lines = []
    for t in task_store:
        status = "✅" if t["done"] else "⬚"
        mark = " ⭐" if t["important"] else ""
        lines.append(f"  {status} [{t['id']}] {t['title']}{mark}")
    return "タスク一覧:\n" + "\n".join(lines)

def complete_task(task_id: int) -> str:
    """タスクを完了にする。

    Args:
        task_id: 完了にするタスクのID
    Returns:
        完了結果メッセージ
    """
    for t in task_store:
        if t["id"] == task_id:
            t["done"] = True
            return f"タスク「{t['title']}」を完了にしました ✅"
    return f"ID {task_id} のタスクが見つかりません"

def delete_task(task_id: int) -> str:
    """タスクを削除する。重要タスクは承認が必要。

    Args:
        task_id: 削除するタスクのID
    Returns:
        削除結果メッセージ
    """
    for t in task_store:
        if t["id"] == task_id:
            # 注: 重要タスクの承認は呼び出し元のワークフロータスクで処理
            task_store.remove(t)
            return f"タスク「{t['title']}」を削除しました 🗑️"
    return f"ID {task_id} のタスクが見つかりません"

# --- ワークフロー構築 ---

with workflow("task_agent") as ctx:

    # ADK エージェントを登録（ファクトリーパターン）
    def create_agent(exec_context: ExecutionContext) -> AdkLLMAgent:
        adk_agent = LlmAgent(
            name="task_manager",
            model="gemini-2.5-flash",
            instruction="あなたはタスク管理アシスタントです。ユーザーの指示に従い、適切なツールを使ってください。",
            tools=[add_task, list_tasks, complete_task, delete_task],
        )
        return AdkLLMAgent(adk_agent, app_name=exec_context.session_id)

    ctx.register_llm_agent("task_manager", create_agent)

    @task(inject_llm_agent="task_manager", inject_context=True)
    def handle_request(llm_agent: LLMAgent, context: TaskExecutionContext):
        """ADKエージェントがツール選択・実行・応答生成をすべて処理"""
        result = llm_agent.run("「報告書作成」を重要タスクとして追加して")
        print(f"🤖 {result['output']}")

    @task(inject_context=True)
    def confirm_deletion(context: TaskExecutionContext):
        """重要タスク削除時のHITL承認"""
        channel = context.get_channel()
        pending = channel.get("pending_delete")
        if not pending:
            return

        response = context.request_feedback(
            feedback_type="approval",
            prompt=f"重要タスク「{pending['title']}」を削除しますか？",
            timeout=60,
        )
        if response.approved:
            delete_task(pending["id"])
            print("✅ 削除が承認されました")
        else:
            print("❌ 削除がキャンセルされました")

    handle_request >> confirm_deletion
    ctx.execute("handle_request")
```

**出力例:**
```
🤖 重要タスクとして「報告書作成」⭐を追加しました（ID: 1）
```

### 設計思想の違い

LangGraphは**ツール呼び出しのループもグラフのエッジとして定義**します。`agent` → `tools` → `agent` の各ステップがノードとして表現され、`conditional_edges` で分岐を制御します。つまり、**SuperAgentのReActループ自体をワークフローグラフで実装**する設計です。

Graflowは**責務分離**のアプローチを取ります:

```
┌─────────────────────────────────────────┐
│  Graflow（ワークフローオーケストレーション）     │
│  タスク依存関係、並列実行、HITL、チェックポイント   │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Google ADK（SuperAgent）           │  │
│  │  ReActループ、ツール選択・実行、推論    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

- **ADK** がReActループ（LLM推論 → ツール選択 → ツール実行 → 応答生成）を**内部で完結**
- **Graflow** はタスク間の依存関係、HITL承認、チェックポイント、分散実行を担当
- ツールは**通常のPython関数**として定義。ADKが自動的にスキーマを推論し、LLMに提示

### LangGraph版との比較

| 観点 | LangGraph | Graflow |
|---|---|---|
| **ツール定義** | `@tool` デコレータ（LangChain依存） | 通常のPython関数（ADKが自動スキーマ推論） |
| **ReActループ** | `agent`→`tools`→`agent` をグラフで構築 | ADK が内部で完結（`llm_agent.run()` 1行） |
| **ツール実行** | `ToolNode` が自動ディスパッチ | ADK が自動ディスパッチ |
| **HITL** | `interrupt()` → `Command(resume=)` | `request_feedback()`（通常の関数呼び出し） |
| **状態管理** | `AgentState`（TypedDict + Reducer） | Channel の `set`/`get` |
| **グラフ構成** | `agent`+`tools` ノード + 条件エッジ | ワークフロータスク + ADK SuperAgent |
| **LLM選択** | `ChatOpenAI` 等（LangChain依存） | ADK（Gemini）/ LiteLLM（全プロバイダー） |

Graflow版のポイント:

- **ReActループをグラフで表現しない**: LangGraphでは `agent` → `tools` → `agent` と複数ノード+条件エッジで構築する必要がありますが、Graflowでは ADK の `llm_agent.run()` **1行でReActループが完結**します。ワークフローグラフはビジネスロジックの流れ（リクエスト処理→承認→…）に集中できます
- **HITLはワークフロー層の責務**: ツール内部で `interrupt()` を呼ぶのではなく、**承認が必要な処理を独立したワークフロータスクとして分離**。関心の分離により、テストやフロー変更が容易になります
- **フレームワーク交換が容易**: ADK の代わりに PydanticAI や他のエージェントフレームワークに差し替えても、ワークフロー構造は変わりません

---

## まとめ: LangGraph vs Graflow 比較表

| 観点 | LangGraph | Graflow |
|---|---|---|
| **グラフ定義** | `add_node` + `add_edge` + `compile` | `>>` / `\|` 演算子（1行で構造が読める）+ Low-Level API も対応 |
| **データ共有** | State（TypedDict + Reducer） | Channel（Key-Value） + 自動キーワード引数解決 |
| **条件分岐** | `add_conditional_edges`（事前定義） | `next_task()` / `next_iteration()`（実行時動的） |
| **HITL** | `interrupt` + `Command(resume=)` | `request_feedback()` + タイムアウト時自動checkpoint |
| **チェックポイント** | 自動のみ | ユーザー制御（任意タイミングで保存） |
| **並列エラー制御** | なし | 4種の組み込みポリシー + カスタム |
| **分散実行** | なし（シングルプロセス内のスレッド並列のみ） | Redisベースワーカーで水平スケール（OSS標準装備） |
| **タスクハンドラー** | プロセス内のみ | direct / docker / カスタム |
| **LLM統合** | LangChainエコシステム前提 | LiteLLM + 任意のSuperAgentフレームワーク |
| **トレーシング** | LangSmith（有償SaaS） | Langfuse（OSS） + OpenTelemetry（self-host可・完全無料） |
| **実行モデル** | Define-and-Run（compile後に固定） | Define-by-Run（実行しながらグラフ構築） |
| **設計方針** | フルスタック（SuperAgent + Workflow） | 責務分離（Workflow特化、SuperAgentは外部委譲） |

**Graflowが特に向いているケース:**
- ワークフローの構造を直感的・簡潔に書きたい
- 実行時の条件に応じて動的にタスクを生成・分岐したい
- 長時間ワークフローの中断・再開が必要
- 分散実行をOSSの範囲内で実現したい
- LangChainエコシステムに縛られず、好みのLLMフレームワークを使いたい

### リンク

- **Graflow GitHub**: https://github.com/GraflowAI/graflow
- **ライセンス**: Apache 2.0
- **設計解説記事**: [Graflowの設計と既存ツールとの比較](https://zenn.dev/myui/articles/27f69e5fe41345)
- **Langfuseセルフホスト**: [Terraform + ECS FargateでLangfuse v3をAWSにセルフホスティング](https://zenn.dev/myui/articles/c5a537874167b5)
