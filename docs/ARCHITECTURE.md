# Architecture notes

## Why in-memory state

`src/lib/store.ts` holds runs in a `Map` and fans events out to SSE subscribers
directly. No database. One process, one demo, and a Postgres dependency at a
hackathon is a reliable way to lose 40 minutes to connection strings.

The cost is real and worth naming: **a server restart loses in-flight runs**,
and this does not scale past one Node process. If runs need to survive, swap
`store.ts` for SQLite - it is the only file that would change, because nothing
above it touches storage directly.

## Why a provider interface

`src/lib/sandbox.ts` defines three methods: `exec`, `writeFile`, `destroy`.
Daytona implements them in `daytona.ts`; the simulator implements them in
`mock.ts`. Everything else - orchestrator, trial lifecycle, classifier, UI - is
provider-agnostic.

This exists for one reason: the demo fallback. `MOCK=1` swaps one object and the
entire pipeline runs with no network. It also happens to make the SDK surface
area exactly one file, which matters because SDK method names drift.

## Why the success rate excludes infra errors

Three outcomes, not two:

| Outcome | Meaning | Counted? |
|---|---|---|
| `passed` | verify exited 0 | yes |
| `failed` | verify exited non-zero - the agent got it wrong | yes |
| `errored` | clone/setup/sandbox broke - *we* got it wrong | no |

Folding infra errors into the failure rate would make our flaky clone look like
a flaky agent, which is precisely the confusion this project exists to remove.
They stay visible in the grid as amber tiles so the exclusion is auditable.

## Why classification is two-stage

Regex (`heuristicClassify`) runs the moment a trial fails: instant, free, and
correct most of the time because build tools have loud, stable error strings.
It exists so the grid can label a tile without waiting on a model.

The LLM pass (`llmClassify`) runs once, at the end, over only the failures the
regex gave up on - and it sees them **together**. That batching is the point:
one call can notice that eleven separate tiles share a root cause, which is the
insight the report card is actually selling. If the call fails, the heuristic
labels stand and the demo still works.

## What the sandbox environment actually is

Verified live, not assumed - `npm run smoke` against the Daytona default sandbox:

| | |
|---|---|
| user / home | `daytona` / `/home/daytona` |
| OS | Debian 13 (trixie) |
| git | 2.53.0 |
| python / pip | 3.14.4 / 26.0.1 |
| node / npm | 25.9.0 / 11.12.1 |
| `claude` CLI | 2.1.19, **preinstalled** |

Four things this changed, each of which would have failed all 50 trials
identically:

1. **No custom image.** Naming one triggers a *declarative build*, which 403s
   with "Declarative builds are not available to your organization". The default
   sandbox already has the whole toolchain, so `scenario.image` is now optional
   and normally unset.
2. **Region matters.** `us` returns "Region us is not available to the
   organization" on this account. `eu` works.
3. **No `/workspace`.** `/` is root-owned and the sandbox user cannot create it;
   uploads there fail with "permission denied". Paths are now resolved per
   sandbox from `$HOME` (`SandboxHandle.homeDir` / `.repoDir`), because
   `fs.uploadFile` takes a literal path with no shell expansion.
4. **`npm install -g` EACCESes.** The nvm global dir is root-owned, and `sudo
   npm` fails too (nvm is not on root's PATH). The agent runner prefers the
   preinstalled `claude` and falls back to `npm install -g --prefix
   $HOME/.npm-global`.

## Known sharp edges## Known sharp edges

- **The Daytona SDK calls in `daytona.ts` are verified live** - create, exec,
  uploadFile, delete all exercised by `npm run smoke`. The agent's own model
  call is the one step no smoke test covers.
- **`concurrency` is a hard constraint, not a preference.** Daytona quota and the
  Anthropic rate limit both bite well before 50 simultaneous agents.
- **`shell-agent` in `agent-runner.ts` is a stub** that exits 1. Only
  `claude-code` is wired up.
- **Sandbox cleanup is best-effort** in a `finally`. If the process is killed
  mid-run, sandboxes leak and cost money - check the Daytona dashboard after.
