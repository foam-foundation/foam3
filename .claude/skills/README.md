# FOAM Agent Skills

This directory holds [Claude Code Agent Skills](https://code.claude.com/docs/en/skills) that are authored **once here in `foam3`** and shared by every application that uses `foam3` as a git submodule. `foam3` is the single source of truth — apps do **not** copy the files, they symlink to them.

Each skill is a directory containing a `SKILL.md` (YAML frontmatter + instructions), e.g.:

```
foam3/.claude/skills/
  foam-view-builder/
    SKILL.md
```

## Why this works

Claude Code discovers project-level skills under `<project-root>/.claude/skills/`, and **it follows symlinks** — a `<skill-name>` entry there may be a symlink to a directory elsewhere on disk, and Claude Code reads `SKILL.md` from the link target. Git stores symlinks natively (mode `120000`), so the link is committed, not the file contents. Working directly inside the `foam3` repo also picks these up, since `foam3/.claude/skills/` is then the project-level dir.

## Wiring a skill into a consuming app

From the **application repo root** (where `foam3/` is the submodule), create a symlink per skill you want, then commit it:

```bash
mkdir -p .claude/skills

# one line per skill (relative target keeps it portable):
ln -s ../../foam3/.claude/skills/foam-view-builder .claude/skills/foam-view-builder

git add .claude/skills/foam-view-builder    # committed as a symlink
git commit -m "Link foam-view-builder skill from foam3 submodule"
```

The symlink target is **relative** (`../../foam3/...`) so it resolves the same in every checkout.

## Verifying

- In a **new** Claude Code session (the skill registry loads at startup), run `/skills` — the skill should be listed. If you added it mid-session, restart first.
- A fresh clone must have the submodule initialized for the link to resolve:
  ```bash
  git submodule update --init
  ```

## Windows / no-symlink fallback

Symlinks require `git config core.symlinks true` and, on Windows, Developer Mode or admin. If a teammate's checkout can't use symlinks, run Claude Code with the submodule added as an extra directory instead of symlinking:

```bash
claude --add-dir ./foam3
```

Claude Code loads `.claude/skills/` (and `.claude/commands/`) from `--add-dir` paths automatically.

## Adding a new shared skill

1. Create `foam3/.claude/skills/<skill-name>/SKILL.md`. Keep the frontmatter to portable Agent-Skills fields (`name`, `description`; optionally `when_to_use`, `license`, `metadata`, `allowed-tools`) so it stays packageable.
2. Commit it in the `foam3` repo.
3. In each consuming app, add the symlink as shown above and bump the submodule pointer.
