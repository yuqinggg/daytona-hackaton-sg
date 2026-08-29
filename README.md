# Agent Reliability Report Card

> Your agent worked when you demoed it. Does it work 10 times in a row?

Give it a task. It runs that task 10 times, each in its own throwaway Daytona
sandbox, and gives you back a success rate and a breakdown of *how* it failed.

```
68% success rate. Most common failure: forgot to install the dependency (11/16 failures).
```

Every agent demo has a reliability number. Almost nobody knows theirs.

## Why a fresh sandbox per trial

Each trial mutates its machine in ways nobody can predict - the agent installs
packages, rewrites files, sometimes breaks the interpreter. So the trials
**cannot share an environment** and **cannot run against a pre-built image**:
the install step is frequently the thing that fails, and pre-baking it would
hide the most common failure mode. Real, disposable machines are the only
honest way to run this.

Trials are capped at **10** (`MAX_TRIALS` in
[`src/lib/types.ts`](src/lib/types.ts), clamped in `startRun` so the API, the
UI, and `bench` all inherit it). The cap is a spend guard: every trial is one
real sandbox and one real agent's worth of tokens.

## Quick start

```bash
npm install
cp .env.example .env.local   # DAYTONA_API_KEY + a key for the agent's model
npm run dev
```

Rehearse with no credentials, no quota, and no spend:

```bash
MOCK=1 npm run dev
```

Pre-flight a scenario's environment for the price of one sandbox and zero agent
tokens - provisions, clones, sets up, injects the verifier, and asserts the
baseline fails:

```bash
npm run smoke -- --scenario format-tokens-goose
```

Headless, if the browser lets you down:

```bash
MOCK=1 npm run bench -- --trials 10
```

## How it works

```
POST /api/runs
      |
      v
orchestrator ---- worker pool, `concurrency` in flight ----+
      |                                                    |
      |   for each trial:                                  |
      |     create sandbox  ->  clone + setup              |
      |     run agent-under-test (unassisted)              |
      |     run scenario.verify  ->  pass / fail           |
      |     heuristic classify   ->  destroy sandbox       |
      |                                                    |
      +--> store (in-memory) --> SSE --> grid of N tiles <-+
                    |
                    v
      buildReport(): batched LLM pass over the failures
                     -> success rate + failure buckets
```

- **[`src/lib/orchestrator.ts`](src/lib/orchestrator.ts)** - fan-out, worker pool, abort.
- **[`src/lib/trial.ts`](src/lib/trial.ts)** - one trial's whole lifecycle. Never throws.
- **[`src/lib/sandbox.ts`](src/lib/sandbox.ts)** - the provider seam. Daytona on one side, mock on the other.
- **[`src/lib/classify.ts`](src/lib/classify.ts)** - regex first (instant, free), LLM second (batched, sees the whole run).
- **[`scenarios/`](scenarios/)** - the experiments. Read [`scenarios/README.md`](scenarios/README.md) before writing one.

## The agents under test

The harness measures *any* agent, not one. `scenario.agent` picks the runner in
[`src/lib/agent-runner.ts`](src/lib/agent-runner.ts); `scenario.model` is
written provider-first (`openrouter/qwen/qwen3-coder`) and decides which
provider key gets forwarded into the sandbox.

| `agent` | How it runs | Installed by |
|---|---|---|
| `aider` | [Aider](https://github.com/Aider-AI/aider) headless: one `--message`, edit blocks, exit | `setup`, into its own venv |
| `goose` | [goose](https://github.com/block/goose) `run --instructions`: a full tool-using loop | `setup`, official install script |
| `claude-code` | `claude -p` in headless mode | preinstalled in the sandbox |
| `shell-agent` | stub that exits 1 - a placeholder, not an agent | - |

Each agent installs in `setup`, not in the runner, so a failed `pip` or `curl`
is classified `infra_error` and is not charged to the agent. Aider gets its own
venv: it pins `rich` and `packaging`, and so does the repo under test, so a
shared environment would let the agent's installer break the verifier's
interpreter.

## The shipped scenarios

All three run against [aider](https://github.com/Aider-AI/aider) the *repo* -
a well-known open-source AI coding assistant - and extend one pure function,
`format_tokens`, in `aider/utils.py` so it renders millions.

| Scenario | Agent | Model |
|---|---|---|
| [`format-tokens-goose`](scenarios/format-tokens-goose.json) | goose | `openrouter/qwen/qwen3-coder` |
| [`format-tokens-aider`](scenarios/format-tokens-aider.json) | Aider | `openrouter/qwen/qwen3-coder` |
| [`aider-format-tokens`](scenarios/aider-format-tokens.json) | Claude Code | its own default |

The first two are a **matched pair**: same repo, same task, same verifier, same
model. The only variable between their report cards is the agent, which is the
product claim made visible. Two agents on two different models would measure
neither.

The task looks trivial and is not. The spec has two rounding branches and two
boundaries - `999_999` must stay `"1000k"`, and `9_999_999` must round to
`"10.0M"` - that only a careful reading gets right, and the existing behaviour
has to survive untouched. That is the point: a task nobody fails makes a boring
report card.

The verifier lives in
[`scenarios/files/aider-format-tokens/`](scenarios/files/aider-format-tokens/)
and is injected after the agent stops. It was checked both ways: 3 tests fail on
unmodified `main`, all 5 pass against a hand-written fix.

## The two numbers that need care

**Success rate excludes infra errors.** If our clone flakes, that is our bug,
not the agent's. Those trials show up in the grid as amber and sit outside the
denominator - visible, so the exclusion is honest rather than hidden.

**`verify` must be deterministic.** No LLM judges pass/fail. If you cannot write
a command that passes on a correct solution and fails on every wrong one, you
cannot produce a reliability number.

## Demo

Runbook, timings, and the fallback plan: [`docs/DEMO.md`](docs/DEMO.md).
