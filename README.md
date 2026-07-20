# Agent Memory Skill

[![skills.sh](https://skills.sh/b/roman-pinchuk/MEMORY.md)](https://skills.sh/roman-pinchuk/MEMORY.md)
[![Validate skill](https://github.com/roman-pinchuk/MEMORY.md/actions/workflows/validate.yml/badge.svg)](https://github.com/roman-pinchuk/MEMORY.md/actions/workflows/validate.yml)

An opencode-compatible Agent Skill for maintaining durable project knowledge
through a concise `MEMORY.md` entry point and linked Markdown documents.

This skill is inspired by Andrej Karpathy's [LLM Wiki
pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).
It keeps the useful part of that idea without requiring a database, CLI,
frontmatter schema, or specific documentation layout.

## What It Does

The skill guides agents to:

- Read `MEMORY.md` before searching broadly for project context
- Keep `MEMORY.md` as a concise map rather than a knowledge dump
- Integrate new information into existing notes instead of creating isolated summaries
- Preserve links to source files, issues, commits, and other evidence
- Record contradictions and uncertainty instead of silently guessing
- Update memory when an implementation changes durable project knowledge
- Ask before recording optional, sensitive, or ambiguous knowledge
- Audit links, stale summaries, duplicate notes, and unreachable documentation

When a project has no `MEMORY.md`, the first request to remember, document, or
ingest knowledge runs the initialization workflow: establish or create
`docs/ARCHITECTURE.md`, then create `MEMORY.md` and index the architecture
overview before adding other notes.

## Repository Structure

This repository contains the skill and its validation workflow:

```text
.github/
└── workflows/
    └── validate.yml
memory/
└── SKILL.md
.gitignore
LICENSE
README.md
skills.sh.json
```

## Target Project Layout

`MEMORY.md` and `docs/ARCHITECTURE.md` are created in projects using the
skill; they are not part of this repository. A project can start with:

```text
MEMORY.md
docs/
└── ARCHITECTURE.md
```

`MEMORY.md` should contain categorized links with one-sentence descriptions.
Detailed knowledge stays in the linked documents, whether those documents are
new memory notes or existing project documentation. When initializing a
project without memory, the skill creates or reuses `docs/ARCHITECTURE.md` and
adds it as the first entry in `MEMORY.md`. New notes should be placed beside
related documentation or, when no suitable location exists, in a flat
`docs/<topic>.md` file. The skill does not require category directories.

## Install

### skills.sh

```bash
npx skills add roman-pinchuk/MEMORY.md
```

To install only this skill explicitly:

```bash
npx skills add roman-pinchuk/MEMORY.md --skill memory
```

### opencode

```bash
git clone https://github.com/roman-pinchuk/MEMORY.md.git ~/.config/opencode/skills/MEMORY.md
```

Then restart opencode so it reloads available skills.

Project-local installation:

```bash
mkdir -p .opencode/skills
git clone https://github.com/roman-pinchuk/MEMORY.md.git .opencode/skills/MEMORY.md
```

### Other SKILL.md-compatible agents

Clone or copy this repository into the skill directory watched by your agent.
The important file is [`memory/SKILL.md`](./memory/SKILL.md).

## Example Entry Point

```markdown
# Project Memory

## Architecture

- [System overview](docs/ARCHITECTURE.md) - Components and data flows.
- [Authentication](docs/authentication.md) - Auth boundaries and token behavior.

## Decisions

- [Database selection](docs/database.md) - Why PostgreSQL was selected.

## Open Questions

- [Knowledge gaps](docs/open-questions.md) - Unresolved or contradictory information.
```

## Principles

- Source documents are evidence and should not be modified during ingestion.
- Memory should contain durable knowledge, not secrets, temporary debugging state, or guesses.
- Git history supplies change history; a duplicate memory log is unnecessary.
- The agent should write back useful conclusions when appropriate so knowledge compounds across sessions.

## License

MIT. See [`LICENSE`](./LICENSE).
