# Scenarios

One JSON file per experiment. Schema lives in [`../src/lib/scenario.ts`](../src/lib/scenario.ts).

The only field worth agonising over is **`verify`**. It has to be a deterministic
command that passes on a correct solution and fails on every wrong one, with no
LLM in the loop. If you can't write that command, you can't produce a success
rate - you can only produce a vibe.

Rules of thumb for a scenario that demos well:

- **The task should be genuinely failable.** A task that passes 50/50 is a boring
  slide. Aim for something where a real agent lands in the 50-80% range: needs a
  new dependency, touches more than one file, has an edge case in the tests.
- **Setup must be reliable.** Anything flaky in `setup` shows up as `infra_error`
  and eats your trial budget.
- **Keep it under ~4 minutes per trial.** 50 trials at concurrency 12 means
  roughly 5 rounds; a 4-minute task is a 20-minute demo.

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
a hand-written fix.
