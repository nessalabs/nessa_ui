# Skills

Task-shaped guides for agents working in this repository, in the format Claude
Code and compatible tools read: one folder per skill, each with a `SKILL.md`
whose frontmatter carries a `name` and the `description` that decides when it
gets used.

They live here rather than in `.claude/skills/` because `.claude/` is excluded
from this repository — a skill nobody else receives is a note to yourself. To
have Claude Code pick these up locally, link them in:

```bash
mkdir -p .claude/skills && ln -s ../../skills/agent-stream .claude/skills/agent-stream
```

| Skill | Use when |
| --- | --- |
| [`agent-stream`](./agent-stream/SKILL.md) | Consuming a coding agent's output stream — a transcript, an activity feed, a run inspector, a composer picker — or adding support for a second agent provider. |
