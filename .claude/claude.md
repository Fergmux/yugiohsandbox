## Project Knowledge

Maintain a knowledge file at `.claude/knowledge.md`.

At the start of each session, read this file before doing anything else.

After gaining context about the project (by reading files, resolving errors, or making discoveries), update the file with anything that would save time in a future session. This is not a changelog — do not log what you did. Instead record:

- Project structure: where key files and folders live and what they're for
- Config and environment: build commands, env vars, tooling quirks
- Architecture decisions: why things are structured the way they are
- Non-obvious patterns: conventions that aren't self-evident from the code
- Gotchas: things that look wrong but are intentional, or traps to avoid
- External dependencies: APIs, services, or integrations and how they're used

Update entries in place — if you learn something new about a topic already documented, revise that entry rather than appending. Keep the file organised by topic, not by session.
