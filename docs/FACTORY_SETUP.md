# Running the factory on SportsJack

This repo is set up for the [AI Software Factory](https://github.com/JB5579/ai-software-factory)
(your fork of `coleam00/ai-software-factory`), which runs every AI step through
Archon's shared SDLC workflows. Setup was done in a temporary cloud container.
The factory itself needs a machine that stays up: your PC while you watch the first
laps, then a Linux server (see the factory's `docs/server-cheat-sheet.md`).

## What is already done

| Piece | State |
|---|---|
| Factory files (`factory/`, `harness/`, `.factory/`, `FACTORY*.md`) | Installed, Archon pin `120f3e04…` |
| `MISSION.md` | Written from the PRD. **Review the out-of-scope list** |
| `harness/END-TO-END.md`, `.factory/holdout/HOLDOUT.md` | Written, on real recorded games |
| `harness/harness.config.json` | `npm run typecheck` + `npm test`, required check `tests` |
| `prd/PHASE1-ALPHA.md` | The scoped PRD that `archon-backlog` slices |
| Real-data feed + scoring (`packages/`) | Built and tested against nflverse box scores |
| CI (`.github/workflows/ci.yml`) | Runs `python harness/ci.py` as the `tests` job |
| Runtime host (`harness/runtime.inputs.json`) | **Waits** for the first ticket's start command |

## On your machine

You need: git, Python 3.10+, Node 22, `bun`, `uv`, the GitHub CLI and Claude Code.

```bash
# 1. Tools and logins (once)
gh auth login -s workflow && gh auth setup-git
claude                                   # sign in to Claude Code

# 2. The factory and this repo
git clone https://github.com/JB5579/ai-software-factory ~/ai-software-factory
git clone https://github.com/JB5579/Sports_Jack ~/Sports_Jack && cd ~/Sports_Jack
npm ci
python ~/ai-software-factory/bin/factory.py init      # installs the pinned Archon; keeps our files
python factory/consumer.py doctor

# 3. Model tiers (machine-wide Archon config, not committed)
ARCHON="bun $(python -c 'import json;print(json.load(open(".factory/consumer.json"))["source"])')/packages/cli/src/cli.ts"
$ARCHON ai tier set small  claude sonnet
$ARCHON ai tier set medium claude sonnet
$ARCHON ai tier set large  claude opus
$ARCHON ai tier list
```

`.factory/consumer.json` is machine-local (gitignored). `init` writes it, and
it names the pinned Archon checkout that the `ARCHON` line points at.

## The first laps (supervised, no schedule)

```bash
# 4. Slice the release into issues; you approve them before they are published
python factory/consumer.py run archon-backlog --input prd=prd/PHASE1-ALPHA.md --input publication=approve

# 5. The first issue is the runnable skeleton. Before building it, wire the runtime
#    host from its start command (factory/RUNTIME_HOST.md): start
#    `node --experimental-strip-types apps/server/src/main.ts`, PORT, /health,
#    /build-id, SPORTSJACK_DB={state}/sportsjack.sqlite, SPORTSJACK_REPLAY=2025_22_SEA_NE.

# 6. Take that issue through the full lifecycle with merge approval on
python factory/consumer.py run archon-lifecycle \
  --input target=https://github.com/JB5579/Sports_Jack/issues/<n> \
  --input merge_mode=approve --input discovery_publication=preview
```

Watch one issue go all the way to a merge before you set up
`.factory/schedule.json` and `schedule install`.

**Branch protection:** the repo is private, so the merge queue reads
`required_checks: "tests"` from `harness/harness.config.json`. Keep the CI job
named `tests`.

## Real data

- **Today: replays.** `fixtures/nflverse/` holds real recorded games. nflverse
  updates play-by-play nightly during the season, so yesterday's games are
  available today:
  `npm run fixtures -- --list 2026`, then `npm run fixtures -- --games 2026_08_XXX_YYY`.
- **Later: live.** Yahoo Sports has no public live API. When you want true live
  play: add a `FeedSource` adapter (ESPN's unofficial scoreboard/summary JSON is
  free; Sportradar and SportsDataIO are licensed), then decide MISSION.md Q9. A
  Claude Code cloud environment also needs those hosts added under its network
  allowed domains (`site.api.espn.com`, `sports.core.api.espn.com`,
  `cdn.espn.com`).

## Cloud sessions

The container used for setup could reach GitHub release downloads (nflverse) but
not ESPN or Yahoo. Its `gh` login was not working, so it cannot run Archon itself.
It can still develop and test: `npm ci && python harness/ci.py`.
