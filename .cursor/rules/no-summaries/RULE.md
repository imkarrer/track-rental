---
description: "Critical: Prevents explosion of md files"
alwaysApply: true
---

# No Summary Files Rule

## Core Principle
Do NOT create summary, documentation, or guide markdown files after completing tasks unless the user explicitly requests them.

## Files to Avoid Creating
- `*_SUMMARY.md`
- `*_GUIDE.md`
- `*_CHANGES.md`
- `*_IMPLEMENTATION.md`
- `*_CHECKLIST.md`
- `*_INDEX.md`
- `*_HISTORY.md`
- `*_COMPLETE.md`
- `*_REFERENCE.md`
- `README_*.md` (unless specifically requested)
- Any other documentation files

## Exception
Only create or modify documentation files when the user specifically and explicitly asks for them.

## Rationale
The user prefers to maintain their own documentation structure and does not want automatic documentation generation cluttering their project directory.
