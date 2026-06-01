# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Playwright browser automation and testing project. It uses the `playwright-cli` skill for interactive browser control and Playwright tests for automated testing.

## Commands

```bash
# Run all Playwright tests
npx playwright test

# Run a specific test file
npx playwright test tests/example.spec.ts

# Interactive browser automation via playwright-cli
playwright-cli open
playwright-cli goto <url>
playwright-cli snapshot
playwright-cli click <element-ref>
playwright-cli fill <element-ref> <text>
playwright-cli close
```

## Architecture

- `tests/` - Playwright test specifications (`.spec.ts` files)
- `.playwright-cli/` - Session state for interactive browser sessions
- `playwright.config.ts` - Playwright configuration (uses Chrome channel, headless mode)
- `.claude/skills/playwright-cli/` - Interactive browser automation skill with reference documentation

## Browser Sessions

The `playwright-cli` tool manages persistent browser sessions. Key session files:
- `.playwright-cli/page-*.yml` - Page snapshots with element references
- `.playwright-cli/console-*.log` - Console messages and errors

When working with browser automation:
1. Use `playwright-cli open` to start a session
2. Navigate with `playwright-cli goto <url>`
3. Get element refs with `playwright-cli snapshot`
4. Interact using refs like `playwright-cli click e15` where `e15` is from the snapshot
5. Close with `playwright-cli close`
