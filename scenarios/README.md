# Scenarios

One JSON file per experiment. Schema lives in [`../src/lib/scenario.ts`](../src/lib/scenario.ts).

The only field worth agonising over is **`verify`**. It has to be a deterministic
command that passes on a correct solution and fails on every wrong one, with no
LLM in the loop. If you can't write that command, you can't produce a success
rate - you can only produce a vibe.

Rules of thumb for a scenario that demos well:

- **The task should be genuinely failable.** A task that passes 10/10 is a boring
  slide. Aim for something where a real agent lands in the 50-80% range: needs a
  new dependency, touches more than one file, has an edge case in the tests.
- **Setup must be reliable.** Anything flaky in `setup` shows up as `infra_error`
  and eats your trial budget.
- **Keep it under ~4 minutes per trial.** 10 trials at concurrency 8 is 2
  rounds; a 4-minute task is a 10-minute demo. `MAX_TRIALS` caps a run at 10.

## Picking the agent and the model

`agent` selects a runner in [`../src/lib/agent-runner.ts`](../src/lib/agent-runner.ts)
- `aider`, `goose`, or `claude-code` - and `model` is written provider-first
(`openrouter/qwen/qwen3-coder`), which decides which provider key is forwarded
into the sandbox. Aider takes the string whole; the goose runner splits it into
`GOOSE_PROVIDER` and `GOOSE_MODEL`; Claude Code ignores it.

Install the agent in `setup`, never in the runner. Setup failures are
classified `infra_error`; a failed `pip install` is the harness's fault, not
the agent's, and should not land in the denominator.

**To compare two agents, copy the scenario and change one field.** Everything
else - repo, ref, task, verify, verifyFiles, model - must stay byte-identical,
or the two report cards are not comparable. `format-tokens-goose` and
`format-tokens-aider` are that pair.

## Where the verifier test lives

Never in the repo the agent works in. Put it under `files/<scenario-id>/` and
list it in `verifyFiles`:

```json
"verifyFiles": {
  "tests/basic/test_format_tokens_millions.py": "files/aider-format-tokens/test_format_tokens_millions.py"
}
```

The harness copies those files into the sandbox **after** the agent has stopped
and after the diff has been taken. If the test ships in the repo, the agent can
read it, satisfy it narrowly, or delete it - and then you are measuring
test-reading, not the task.

## Validate a new scenario before you trust it

Two properties, both checkable in a couple of minutes on your laptop:

1. `verify` **fails on the unmodified repo.** If it passes, it tests nothing.
2. `verify` **passes on a correct solution.** Write the fix by hand once and run
   it. If it fails, your success rate is measuring your own test bug.

`aider-format-tokens` was validated this way: 3 failed on `main`, 5 passed with
a hand-written fix. Its two siblings reuse that same verifier unchanged.
