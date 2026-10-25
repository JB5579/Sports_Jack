# Factory operations

This application runs on a pinned Archon SDLC source. See
[factory/MIGRATION.md](factory/MIGRATION.md) for installing and upgrading it, and
[docs/FACTORY_SETUP.md](docs/FACTORY_SETUP.md) for running it on your own machine.

Shared workflow gates own every decision. Inspect a run's identity and status
before responding to a declared gate.

Project runtime scenarios: `harness/END-TO-END.md`.
Holdout scenarios: `.factory/holdout/HOLDOUT.md`. This copy is visible to the
builder. For a real holdout, keep a private copy outside the checkout and pass it as
the lifecycle `holdout` input.
Ordinary checks: `python harness/ci.py`.

## Integration record

- 2026-10-25: installed from ai-software-factory (Archon pin
  `120f3e040f45c0ad88249601d846e414f4bf438b`). `consumer.py doctor` passed in
  the setup container. Ordinary gate green (`UNIT_PASSED tests=13`; 23 after the 2026-10-25 rulings). There has been
  no live Archon run yet: no provider sign-in, no `gh` sign-in, and the runtime host
  is not wired (it waits for the first backlog ticket's start command).

Record this application's tested source SHA, candidate, run IDs, coverage,
fresh-environment evidence and open integration limits here after testing.
