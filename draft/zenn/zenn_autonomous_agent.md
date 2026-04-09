---
title: "ローカルLLM × Graflowで自律コーディングエージェントをシンプルに実装する"
emoji: "🤖"
type: "tech"
topics: ["python", "graflow", "gemma", "adk", "agent"]
published: false
---

## はじめに

本記事は、[@nekoroko](https://zenn.dev/nekoroko) さんの「[Gemma 4 × LangGraphで自律コーディングエージェントを作る](https://zenn.dev/nekoroko/articles/7f22e9c8557aea)」にインスパイアされて執筆しました。ローカルLLMで自律エージェントを構築するという実践的な記事ですので、ぜひご一読ください。

元記事では、Gemma 4 + LangGraph + Podmanを使い、LLMに**「考える」→「行動する」→「結果を見る」を繰り返させる**ReActループ型の自律コーディングエージェントを実装しています。しかし、LangGraphでは当初5ノードのサブタスク分解方式で設計したものの、ノード間のデータ引き継ぎやLLMのハルシネーション（ダミーデータ捏造）に苦戦し、最終的にシンプルなReActループに落ち着いたと報告されています。

本記事では、同様の自律コーディングエージェントを **[Graflow](https://github.com/GraflowAI/graflow)** で実装し、以下の3つの機能を組み合わせることで、**よりシンプルかつ宣言的に**書けることを示します:

| Graflow機能 | 役割 | 元記事での対応 |
|---|---|---|
| **`next_iteration()`** | ReActループの制御 | LangGraphの条件付きエッジ + ループ |
| **`inject_llm_agent`（ADK）** | LLMのツール呼び出し・推論 | 自前のプロンプト解析 + アクション分岐 |
| **`DockerTaskHandler`** | コード実行のサンドボックス化 | Podmanの手動セットアップ |

さらに、LLMとして最近リリースされたばかりの **Gemma 4**（`ollama/gemma4:e4b`）をローカルで動かします。ローカルLLMを活用することで、秘匿性の高いデータを外部に送信せずにワークフロー内で安全に処理できます。

### Graflowとは

**[Graflow](https://github.com/GraflowAI/graflow)** は、AIエージェントワークフローのための Python ベースのオーケストレーションエンジンです。Apache 2.0ライセンスのOSSとして公開されています。

- **GitHub**: https://github.com/GraflowAI/graflow
- **プロジェクトサイト**: https://graflow.ai/

## アーキテクチャ

元記事のアーキテクチャと、Graflow版の対比を示します。

### 元記事（LangGraph + Podman）

```
┌─────────────────────────────────────────┐
│  LangGraph                              │
│                                         │
│  [タスク受信] → [LLM推論] → [判定]      │
│                    ↑           │        │
│                    │     ┌─────┴─────┐  │
│                    │     │           │  │
│                    │  [ツール実行] [コード生成]
│                    │     │           │  │
│                    └─────┴───────────┘  │
│                                    ↓    │
│                              [Podman]   │
│                          (手動セットアップ)│
└─────────────────────────────────────────┘
```

- LLMの応答を自前でパース（`ACTION: tool_name` / `generate_code` / `DONE:`）
- ツール呼び出しロジックを手動実装
- Podmanコンテナの設定・起動を自前で管理

### Graflow版

```
┌─────────────────────────────────────────┐
│  Graflow                                │
│                                         │
│  @task(inject_llm_agent, handler="docker",│
│        max_cycles=10)                   │
│                                         │
│  ┌─ react_loop ──────────────────────┐  │
│  │                                   │  │
│  │  ADK Agent（Gemma 4）             │  │
│  │    → ツール呼び出し（自動）        │  │
│  │    → 結果を確認                   │  │
│  │    → 完了 or next_iteration()     │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│           ↕ DockerTaskHandler           │
│      (宣言的サンドボックス)              │
└─────────────────────────────────────────┘
```

- **ADKがツール呼び出し・推論を自動処理**（パース不要）
- **`next_iteration()`** でループ制御（1行）
- **`DockerTaskHandler`** でコンテナ隔離（宣言的）

## 実装

### 前提条件

```bash
# Graflowのインストール
pip install graflow[docker,adk]

# Ollamaのインストール・起動
# https://ollama.com/
ollama pull gemma4:e4b
ollama serve
```

### ツール定義

エージェントに使わせるツールを定義します。Google ADKでは、関数のdocstringがそのままツールの説明になります。

```python
import os
import subprocess


def read_file(path: str) -> str:
    """指定されたファイルの内容を読み取る。

    Args:
        path: 読み取るファイルのパス

    Returns:
        ファイルの内容
    """
    try:
        with open(path, "r") as f:
            return f.read()
    except FileNotFoundError:
        return f"Error: ファイル '{path}' が見つかりません"


def write_file(path: str, content: str) -> str:
    """ファイルに内容を書き込む。

    Args:
        path: 書き込むファイルのパス
        content: 書き込む内容

    Returns:
        書き込み結果のメッセージ
    """
    with open(path, "w") as f:
        f.write(content)
    return f"ファイル '{path}' に書き込みました"


def list_files(directory: str = ".") -> str:
    """ディレクトリ内のファイル一覧を取得する。

    Args:
        directory: 一覧を取得するディレクトリのパス

    Returns:
        ファイル一覧（各ファイルの先頭5行を含む）
    """
    result = []
    for entry in os.listdir(directory):
        full_path = os.path.join(directory, entry)
        if os.path.isfile(full_path):
            try:
                with open(full_path) as f:
                    head = "".join(f.readlines()[:5])
                result.append(f"📄 {entry}\n{head}")
            except Exception:
                result.append(f"📄 {entry} (読み取り不可)")
        else:
            result.append(f"📁 {entry}/")
    return "\n".join(result) if result else "ディレクトリは空です"


def run_python(code: str) -> str:
    """Pythonコードを実行して結果を返す。

    Args:
        code: 実行するPythonコード

    Returns:
        実行結果の標準出力、またはエラーメッセージ
    """
    try:
        result = subprocess.run(
            ["python", "-c", code],
            capture_output=True, text=True, timeout=30
        )
        output = result.stdout
        if result.returncode != 0:
            output += f"\nError:\n{result.stderr}"
        return output if output else "(出力なし)"
    except subprocess.TimeoutExpired:
        return "Error: 実行がタイムアウトしました（30秒）"
```

:::message
元記事ではLLMの応答を `ACTION: tool_name` 形式でパースし、ツールごとの分岐ロジックを手動で実装しています。ADKではツール定義（関数 + docstring）を渡すだけで、**LLMが自動的にツールを選択・呼び出し・結果を解釈**します。
:::

### ReActループの実装

ここがGraflowの真価が発揮される部分です。ReActループ全体を**1つのタスク + `next_iteration()`** で表現します。

```python
from google.adk.agents import LlmAgent

from graflow.core.context import ExecutionContext, TaskExecutionContext
from graflow.core.decorators import task
from graflow.core.engine import WorkflowEngine
from graflow.core.handlers.docker import DockerTaskHandler
from graflow.core.workflow import workflow
from graflow.llm.agents.adk_agent import AdkLLMAgent
from graflow.llm.agents.base import LLMAgent


SYSTEM_INSTRUCTION = """あなたは自律コーディングエージェントです。
与えられたタスクを、ツールを使って段階的に遂行してください。

作業手順:
1. まず list_files でディレクトリの状況を把握する
2. 必要に応じて read_file でファイルを読む
3. run_python でコードを実行して結果を確認する
4. write_file で結果を保存する

重要:
- 各ステップで何をしているか説明してから行動してください
- エラーが起きたら原因を分析してリトライしてください
- タスクが完了したら、最終結果を明確に報告してください
"""


def main():
    with workflow("autonomous_agent") as ctx:
        # Google ADK エージェントの登録
        def create_agent(exec_context: ExecutionContext) -> LLMAgent:
            adk_agent = LlmAgent(
                name="coding_agent",
                model="ollama/gemma4:e4b",
                tools=[read_file, write_file, list_files, run_python],
                instruction=SYSTEM_INSTRUCTION,
            )
            return AdkLLMAgent(adk_agent, app_name=exec_context.session_id)

        ctx.register_llm_agent("coding_agent", create_agent)

        # ReActループ: 考える → 行動する → 結果を見る → 繰り返す
        @task(
            inject_llm_agent="coding_agent",
            inject_context=True,
            handler="docker",
            max_cycles=10,
        )
        def react_loop(
            ctx: TaskExecutionContext,
            llm_agent: LLMAgent,
            data=None,
        ):
            history = (data or {}).get("history", [])
            user_task = (data or {}).get("task", ctx.get_channel().get("task"))

            # 履歴を含めたプロンプトを構築
            prompt = f"タスク: {user_task}"
            if history:
                prompt += f"\n\nこれまでの作業履歴:\n"
                for i, step in enumerate(history, 1):
                    prompt += f"\n--- ステップ {i} ---\n{step}\n"
                prompt += "\n上記の作業を踏まえて、次のステップに進んでください。"

            # ADKエージェントが自動的にツールを選択・実行
            result = llm_agent.run(prompt)
            output = result["output"]
            history.append(output)

            print(f"[Cycle {ctx.cycle_count}/{ctx.max_cycles}] {output[:100]}...")

            # 完了判定: エージェントが「完了」と報告したか
            if _is_completed(output):
                ctx.get_channel().set("result", output)
                return output

            # 未完了ならば次のイテレーションへ
            if ctx.can_iterate():
                ctx.next_iteration({"task": user_task, "history": history})

        @task(inject_context=True)
        def report(ctx: TaskExecutionContext):
            result = ctx.get_channel().get("result", "結果なし")
            print(f"\n{'='*50}")
            print(f"最終結果:\n{result}")
            print(f"{'='*50}")
            return result

        # ワークフロー: ReActループ → レポート
        react_loop >> report

        # DockerTaskHandler を登録（サンドボックス実行）
        engine = WorkflowEngine()
        engine.register_handler(
            "docker",
            DockerTaskHandler(
                image="python:3.11-slim",
                # ネットワーク隔離やメモリ制限も設定可能
                # environment={"NETWORK": "none"},
            ),
        )

        # タスクをチャネルに設定して実行
        exec_context = ExecutionContext.create(
            ctx.graph, "react_loop", max_steps=30
        )
        exec_context.channel.set(
            "task",
            "data.csvを読み込み、月別の売上合計を集計してresult.csvに保存してください"
        )
        engine.execute(exec_context)


def _is_completed(output: str) -> bool:
    """エージェントの出力から完了を判定する。"""
    completion_markers = ["完了", "タスクを完了", "保存しました", "以上です"]
    return any(marker in output for marker in completion_markers)


if __name__ == "__main__":
    main()
```

### コードの解説

全体で約50行の実質コードです。元記事では LangGraph のノード定義、条件付きエッジ、Podmanコマンド構築、LLM応答パースなど数百行に及ぶ実装が必要でしたが、Graflowでは以下の3つの仕組みで大幅に簡略化されています。

#### 1. `next_iteration()` — ReActループを1行で

```python
@task(inject_context=True, max_cycles=10)
def react_loop(ctx: TaskExecutionContext, ...):
    # ... 処理 ...
    if ctx.can_iterate():
        ctx.next_iteration({"task": user_task, "history": history})
```

`max_cycles=10` でループの上限を宣言し、`ctx.can_iterate()` で残りサイクルを確認、`ctx.next_iteration()` で次のイテレーションにデータを渡す——これだけでReActの「繰り返し」が完成します。LangGraphの `add_conditional_edges` + ルーティング関数は不要です。

#### 2. `inject_llm_agent`（ADK）— ツール呼び出しの自動化

```python
@task(inject_llm_agent="coding_agent")
def react_loop(ctx, llm_agent: LLMAgent, ...):
    result = llm_agent.run(prompt)
```

元記事では、LLMの応答を `ACTION: read_file` のような形式でパースし、ツールごとに `if/elif` で分岐するコードを手動で書いています。ADKを使えば、ツール定義（関数 + docstring）を渡すだけで、**LLMが自動的にツールを選択・呼び出し・結果を解釈**します。パースロジックは一切不要です。

#### 3. `DockerTaskHandler` — 宣言的サンドボックス

```python
engine.register_handler(
    "docker",
    DockerTaskHandler(image="python:3.11-slim")
)

@task(handler="docker")
def react_loop(...):
    ...
```

元記事では Podman のコンテナ起動コマンドを自前で構築し、`--network none`、`--read-only`、メモリ制限などを個別に設定しています。Graflowでは `DockerTaskHandler` を登録して `handler="docker"` を指定するだけで、タスク全体がコンテナ内で隔離実行されます。

## LangGraphとの比較

| 観点 | 元記事（LangGraph + Podman） | Graflow版 |
|---|---|---|
| **ループ制御** | `add_conditional_edges` + ルーティング関数 + ステップカウンタ | `@task(max_cycles=10)` + `next_iteration()` |
| **ツール呼び出し** | LLM応答の手動パース + `if/elif` 分岐 | ADK が自動処理（関数定義のみ） |
| **サンドボックス** | Podmanコマンドの手動構築 | `DockerTaskHandler` + `handler="docker"` |
| **データ引き継ぎ** | メッセージ履歴の手動管理 | `next_iteration(data)` で自動引き渡し |
| **LLMのハルシネーション対策** | コンテキスト注入の自前実装 | ADKのツール結果が自動でコンテキストに |
| **コード量** | 数百行 | 約50行 |

元記事の著者が苦戦した「5ノード設計でのデータ分断」「LLMのダミーデータ捏造」は、Graflowでは設計上発生しません:

- **データ分断** → `next_iteration(data)` でイテレーション間のデータが自然に引き継がれる
- **ダミーデータ捏造** → ADKのツール呼び出しにより、LLMは実データに基づいて推論する

## ローカルLLMを使う意義

元記事の動機は「**クライアント案件のデータを外部APIに投げられない**」ことでした。これはエンタープライズでは非常に一般的な制約です。

Graflowは [LiteLLM](https://docs.litellm.ai/) を通じて **100以上のLLMプロバイダー** に対応しており、モデルの指定を変えるだけでローカルLLMとクラウドLLMを切り替えられます:

```python
# ローカルLLM（Gemma 4）
LlmAgent(model="ollama/gemma4:e4b", ...)

# クラウドLLM（必要に応じて切り替え）
LlmAgent(model="gemini-2.5-flash", ...)
```

秘匿性の高いデータはローカルLLMで処理し、汎用的なタスクはクラウドLLMに委譲する——このようなハイブリッド構成も、Graflowのワークフロー内で自然に実現できます。

## まとめ

ローカルLLM（Gemma 4）を使った自律コーディングエージェントを、Graflowの3つの機能で実装しました:

- **`next_iteration()`** — ReActの「考える→行動する→結果を見る→繰り返す」ループを1行で制御
- **`inject_llm_agent`（ADK）** — ツール呼び出し・推論をフレームワークに委譲し、パースロジックを排除
- **`DockerTaskHandler`** — 生成コードの実行を宣言的にサンドボックス化

LangGraphで数百行かけていた実装が、Graflowでは約50行に収まります。これは単なるコード量の差ではなく、**「ループ制御」「ツール呼び出し」「隔離実行」をフレームワークが担うことで、開発者はエージェントのロジックだけに集中できる**という設計思想の違いです。

:::message alert
**🚀 ハンズオンで試してみよう**

Graflowの動作を手軽に体験できる **Google Colabノートブック** を用意しています。環境構築不要・無償で実行可能です。

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/GraflowAI/graflow-examples/blob/main/notebooks/hands_on_guide_ja.ipynb)

Gemma 4 を使った Google ADK や LLM completion の実行例も含まれています。ぜひ実際に触ってみてください。
:::

### リンク

- **Graflow GitHub**: https://github.com/GraflowAI/graflow
- **ライセンス**: Apache 2.0
- **LangGraphとの比較記事**: [LangGraphユーザーのためのGraflow入門](https://zenn.dev/myui/articles/xxxx)
- **設計解説記事**: [Graflowの設計と既存ツールとの比較](https://zenn.dev/myui/articles/27f69e5fe41345)
