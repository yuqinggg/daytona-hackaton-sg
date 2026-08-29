# Demo runbook

Total stage time: ~6 minutes, most of it watching tiles resolve.

## Before you go on

- [ ] **Pre-flight the environment** (one sandbox, no agent tokens):

      ```
      npm run smoke -- --scenario aider-format-tokens
      ```

      It provisions a real sandbox, clones, sets up, injects the verifier and
      asserts the baseline fails. Green means the only untested step is the
      agent. Last run: sandbox 3.4s, clone 3.3s, setup 1.2s, verify 1.9s -
      about 11s of overhead per trial.

- [ ] **Then one live trial:**

      ```
      npm run bench -- --scenario aider-format-tokens --trials 1
      ```

- [ ] Check the Daytona quota. 50 concurrent sandboxes will exceed the default;
      `RELIABILITY_CONCURRENCY=12` is the safe number.

- [ ] Confirm `DAYTONA_TARGET` is a region your org actually has. `us` returns
      "Region us is not available to the organization" on this account; `eu`
      works.
- [ ] Time one full run end to end. 50 trials at concurrency 12 is ~5 rounds -
      budget 15-25 minutes for a 4-minute task, which is longer than your slot.
      **Pick a task that finishes in about 2 minutes, or run 20 trials on stage
      and show a pre-recorded 50.**
- [ ] Have `MOCK=1 npm run dev` ready in a second terminal.

## The script

1. **The premise, 20 seconds.** "Everyone here has demoed an agent. Nobody here
   knows their success rate." The target is aider - a well-known open-source AI
   coding assistant - and the task is one function in `aider/utils.py`. Show it:
   it fits on a slide, and it looks easy.
2. **Hit run.** 50 grey tiles appear immediately. Say the number out loud: fifty
   real machines, each one about to be mutated in a way we can't predict.
3. **Let it breathe.** Tiles go blue (agent working), amber (verifying), then
   settle green and red. Don't narrate over this; it's the part people watch.
4. **Click a red tile** while the rest are still running. The drawer shows the
   log line where that specific machine died. This is what makes the number
   credible.
5. **The report card lands.** Read the headline verbatim - "68% success rate.
   Most common failure: forgot to install the dependency." If the top bucket is
   `wrong implementation - tests failed`, click into one: it will usually be a
   boundary, `999_999` formatted as `"1.0M"` instead of `"1000k"`. That is a
   better story than a missing import, because it is the kind of bug that ships.
6. **The point, 15 seconds.** That failure mode is one line in a prompt or one
   line in a Dockerfile. You can't fix what you never measured.

## If it breaks

- **Wifi or Daytona is down** -> `MOCK=1`, restart, run again. Say plainly that
  it's simulated. A working simulated demo beats a broken real one; a *silently*
  simulated demo is the one thing that will actually cost you the room.
- **The browser dies** -> `npm run bench` in a terminal. Same numbers, same
  failure breakdown, no React.
- **A run hangs** -> Abort, drop trials to 20, run again. Shorter is fine.

## Do not

- Do not pre-build the environment to make it faster. The install step failing
  *is* the finding.
- Do not retry failed trials. Every nudge inflates the rate and invalidates the
  whole exercise.
