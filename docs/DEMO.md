# Demo runbook

Total stage time: ~6 minutes, most of it watching tiles resolve.

## Before you go on

- [ ] **Pre-flight the environment** (one sandbox, no agent tokens):

      ```
      npm run smoke -- --scenario format-tokens-goose
      npm run smoke -- --scenario format-tokens-aider
      ```

      It provisions a real sandbox, clones, sets up, injects the verifier,
      installs the agent CLI and parses its flags, and asserts the baseline
      fails. Green means the only untested step is the agent's model call.
      **Run it for both scenarios** - Aider's and goose's flags move faster
      than Claude Code's, and this catches a break for one sandbox and zero
      tokens instead of ten. Last run: sandbox 3.4s, clone 3.3s, setup 1.2s,
      verify 1.9s - about 11s of overhead per trial, plus the agent install.

- [ ] **Then one live trial:**

      ```
      npm run bench -- --scenario format-tokens-goose --trials 1
      ```

- [ ] Check the Daytona quota. This account caps at 10 concurrent sandboxes;
      `RELIABILITY_CONCURRENCY=8` leaves room for a finishing sandbox to
      release its slot.

- [ ] **Check the request budget, not the wallet:**

      ```
      npm run budget
      ```

      On the free tier you get 20 requests/minute and 50/day. One trial is
      many requests - roughly 4 for Aider, ~20 for goose - so a 10-trial goose
      run does not fit in a day. `budget` tells you what today's allowance
      actually buys before you spend a sandbox on it.

- [ ] **Have a recorded run ready to replay.** This is the real safety net:
      record when quota allows, replay on stage for free. The header labels it
      `REPLAY of <id>` - never present one as live.

- [ ] Confirm `DAYTONA_TARGET` is a region your org actually has. `us` returns
      "Region us is not available to the organization" on this account; `eu`
      works.
- [ ] Time one full run end to end. 10 trials at concurrency 8 is 2 rounds -
      budget 6-10 minutes for a 4-minute task. **Pick a task that finishes in
      about 2 minutes**, or run the second agent from a pre-recorded run.
- [ ] Have `MOCK=1 npm run dev` ready in a second terminal.

## The script

1. **The premise, 20 seconds.** "Everyone here has demoed an agent. Nobody here
   knows their success rate." The target repo is aider - a well-known
   open-source AI coding assistant - and the task is one function in
   `aider/utils.py`. Show it: it fits on a slide, and it looks easy.
2. **Hit run.** 10 grey tiles appear immediately. Say the number out loud: ten
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
6. **Now run the other agent.** Switch the scenario to `format-tokens-aider`
   and run it again. Same repo, same task, same verifier, same model - goose
   against Aider, with the agent as the only variable. Two numbers side by
   side is the moment the harness stops looking like a demo and starts looking
   like an instrument.
7. **The point, 15 seconds.** That failure mode is one line in a prompt or one
   line in a Dockerfile. You can't fix what you never measured - and you can't
   choose between two agents on vibes.

## If it breaks

- **Out of quota, wifi down, provider flaking** -> hit **Replay** on a
  recorded run. Real sandboxes, real transcripts, real verdicts; only the clock
  is synthetic. Say it is a recording.
- **No recording either** -> `MOCK=1`, restart, run again. Say plainly that it
  is simulated. A working simulated demo beats a broken real one; a *silently*
  simulated demo is the one thing that will actually cost you the room.
- **The browser dies** -> `npm run bench` in a terminal. Same numbers, same
  failure breakdown, no React.
- **A run hangs** -> Abort, drop trials to 5, run again. Shorter is fine.
- **Every tile fails identically** -> that is almost always the key, not the
  agent. Check `OPENROUTER_API_KEY` and its credit balance first.

## Do not

- Do not pre-build the environment to make it faster. The install step failing
  *is* the finding.
- Do not retry failed trials. Every nudge inflates the rate and invalidates the
  whole exercise.
