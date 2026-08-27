# FOAM Agent Skills

This directory holds [Claude Code Agent Skills](https://code.claude.com/docs/en/skills) authored
**once here in `foam3`** and available to every application that uses `foam3` as a git submodule.
Applications do not copy the files, and normally do not symlink them either — Claude Code
discovers them where they are. (One case still wants a symlink; see "Why not symlink" below.)

Each skill is a directory containing a `SKILL.md` (YAML frontmatter + instructions), e.g.:

```
foam3/.claude/skills/
  foam-view-builder/
    SKILL.md
```

## How consuming apps pick these up

Nothing to wire. Claude Code loads skills from nested `.claude/skills/` directories below the
working directory: the first time Claude reads or edits a file under `foam3/`, the skills here
become available for the rest of the session, listed under a directory-qualified name —
`foam3:foam-view-builder`.

Working directly inside the `foam3` repo, `foam3/.claude/skills/` **is** the project-level
directory, so these load at startup under their plain names.

## Skills that exist on both sides

An application may define a skill with the same name at its own root. Both stay available, and
Claude Code routes between them:

```
myapp/.claude/skills/foam-view-builder/        → "foam-view-builder"        (default)
myapp/foam3/.claude/skills/foam-view-builder/  → "foam3:foam-view-builder"  (files under foam3/)
```

Invoking the unqualified name loads the application's skill, and Claude Code appends the
directory-qualified variants with an instruction to also invoke whichever one's directory holds
the files being worked on. So the `foam3` version applies to `foam3` work without the
application having to reference it.

Because the two files are independent, the application's copy must stand on its own for work
outside `foam3/` — a nested skill does not load while Claude is editing application code. Write
the app-side skill as a complete document, not as a delta against this one.

### Why not symlink

A symlink makes both paths resolve to one file, and Claude Code loads a skill once per target.
That is the right tool for using this skill *verbatim*, but it removes the application's ability
to hold different content under the same name — the routing above stops being possible. Prefer
nested discovery; reach for a symlink only when an app wants this exact file and no additions.

## Verifying

- Run `/skills` after Claude has touched a file under `foam3/` — the `foam3:`-prefixed entries
  should be listed. They are absent before that first read; that is expected, not a failure.
- A fresh clone must have the submodule initialized: `git submodule update --init`.

## Out-of-tree checkouts

The discovery above requires `foam3/` to sit inside the working directory. When it does not,
add it explicitly:

```bash
claude --add-dir /path/to/foam3
```

Claude Code loads `.claude/skills/` and `.claude/commands/` from each `--add-dir` directory. Note
this is specific to `--add-dir` and `/add-dir`: the `permissions.additionalDirectories` setting in
`settings.json` grants file access only and does **not** load skills.

## Adding a new shared skill

1. Create `foam3/.claude/skills/<skill-name>/SKILL.md`. Keep the frontmatter to portable
   Agent-Skills fields (`name`, `description`; optionally `when_to_use`, `license`, `metadata`,
   `allowed-tools`) so it stays packageable.
2. Keep `SKILL.md` short and move long pattern catalogues into `references/*.md` alongside it,
   pointing at them from the body. Only `SKILL.md` loads when the skill is invoked; reference
   files load when Claude actually needs them.
3. Commit it here. Consuming apps pick it up on their next submodule bump — no per-app wiring.
