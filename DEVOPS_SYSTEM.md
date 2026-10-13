# TBT Autonomous Development System

Last updated: 2026-10-13

This document describes the AI-powered autonomous development environment for the Tamil Business Tribe platform.

---

## Architecture Overview

```
[Mobile Phone]
    GitHub app → create Issue with label devops:pending
    Admin panel → https://v0-tbt-ott-admin.vercel.app/devops
        ↓
[GitHub Issues — Task Queue]
    devops:pending  → awaiting execution
    devops:active   → Claude Code is working on it
    devops:review   → PR created, needs human approval
    devops:done     → completed
    devops:blocked  → needs human input
        ↓
[Windows Task Scheduler] (every 30min)
    automation/task-intake.mjs → syncs Issues to .claude/devops/queue.json
        ↓
[Claude Code Session — laptop]
    reads .claude/devops/queue.json
    sub-agents for parallel implementation
    CronCreate: health checks every 2h
        ↓
[GitHub PR] ← human reviews on mobile
        ↓
[GitHub Actions ci-cd.yml]
    typecheck → test → build → deploy
        ↓
[Cloud Run + Vercel — Production]
```

---

## How to Submit a Task (Mobile)

### Option A — GitHub Mobile App (primary)
1. Open GitHub app → relentronofficial/admin → Issues → New Issue
2. Set title: clear description of what to build (e.g. "Add export CSV button to members page")
3. Add labels:
   - `devops:pending` (required — puts it in the queue)
   - `priority:high` / `priority:medium` / `priority:low`
   - `scope:admin`, `scope:user-web`, `scope:backend`, `scope:mobile` (one or more)
4. Submit — task-intake.mjs picks it up within 30 minutes

### Option B — Admin Panel Dashboard
- URL: https://v0-tbt-ott-admin.vercel.app/devops
- Click "+ New Task" button (opens GitHub issue form)
- Shows live task queue, deployment status, system health

---

## How Claude Code Executes a Task

When you start a Claude Code session with a task queued:

```
1. Run: node automation/task-intake.mjs   (sync latest GitHub Issues)
2. Claude Code reads .claude/devops/queue.json
3. Takes the highest-priority pending task
4. Updates its GitHub Issue label: pending → active
5. Analyzes codebase, creates implementation plan
6. Implements changes (may spawn sub-agents for parallel work)
7. Runs typecheck + tests
8. Creates a PR: git push → gh pr create
9. Updates GitHub Issue label: active → review
10. Posts PR link as issue comment
```

You then review the PR on GitHub mobile app and merge (or request changes).

---

## Command Reference

All commands run from `F:\admin\` (the repo root).

### Health & Status
```bash
node automation/health-check.mjs          # Check all services
node automation/task-intake.mjs           # Sync GitHub Issues → queue
gh issue list --label devops:pending      # See pending tasks
gh run list --limit 5                     # Recent CI/CD runs
```

### Task Management
```bash
# Create task from CLI
gh issue create --title "Task title" --label "devops:pending,priority:high,scope:backend"

# Mark task active (Claude does this automatically)
gh issue edit <number> --remove-label "devops:pending" --add-label "devops:active"

# View queue
cat .claude/devops/queue.json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('Pending:',d.pending.length,'Active:',d.active?.title)"
```

### Deployment
```bash
# Deploy staging (push to main)
git push origin main

# Promote staging → production
git push origin main:production

# Or: one-click via GitHub Actions
gh workflow run "CI/CD" --ref production
```

### Windows Scheduled Tasks
```powershell
# View scheduled tasks
Get-ScheduledTask -TaskName "TBT-*"

# Run health check now
Start-ScheduledTask -TaskName "TBT-HealthMonitor"

# Run task intake now
Start-ScheduledTask -TaskName "TBT-TaskIntake"
```

---

## File Structure

```
.claude/
  settings.json           # Claude Code hooks + permission policies
  devops/
    config.json           # System configuration (GitHub owner, repo, service URLs)
    queue.json            # Local task queue (synced from GitHub Issues)
    audit.jsonl           # Append-only log of all file edits by Claude
    notifications.jsonl   # Append-only log of Claude notifications
    health.jsonl          # Append-only log of health check results

automation/
  health-check.mjs        # Check all 4 services, log results
  task-intake.mjs         # Sync GitHub Issues → queue.json, create labels
  windows-setup.ps1       # One-time Windows configuration for 24/7 operation
  hooks/
    post-edit.mjs         # PostToolUse hook: log file edits to audit trail
    notification-logger.mjs  # Notification hook: log to notifications.jsonl
```

---

## Environment Variables Required

### Admin Panel (Vercel — add in Vercel dashboard)
| Variable | Value | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | ghp_... (repo scope) | GitHub API for dev dashboard |
| `GITHUB_OWNER` | relentronofficial | GitHub organization |
| `GITHUB_REPO` | admin | Repository name |

### Windows (System Environment Variables)
| Variable | Value | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | ghp_... (repo scope) | task-intake.mjs GitHub API access |

To create a token: https://github.com/settings/tokens  
Required scopes: `repo` (read/write issues, labels, Actions)

---

## Initial Setup

### One-time (run once on the laptop)

```powershell
# From F:\admin in an Administrator PowerShell:
powershell -ExecutionPolicy Bypass -File automation\windows-setup.ps1
```

This will:
- Disable sleep/hibernate on AC power
- Create Windows Task Scheduler jobs (health check every 2h, task intake every 30min)
- Verify GitHub CLI auth

### Set GITHUB_TOKEN as system environment variable

```powershell
[System.Environment]::SetEnvironmentVariable('GITHUB_TOKEN', 'ghp_YOUR_TOKEN_HERE', 'User')
```

### Add env vars to Vercel admin panel
1. Go to Vercel dashboard → tbt-ott-admin project → Settings → Environment Variables
2. Add `GITHUB_TOKEN`, `GITHUB_OWNER=relentronofficial`, `GITHUB_REPO=admin`
3. Redeploy the admin panel

---

## Windows 24/7 Operation Requirements

| Requirement | How to ensure it |
|---|---|
| No sleep | `windows-setup.ps1` configures AC power settings |
| Laptop plugged in | Keep on AC power at all times |
| Network connected | Wired ethernet recommended; Wi-Fi works |
| GitHub auth | `gh auth login` once, credentials persist |
| Git credentials | `git config --global credential.helper manager` (done by setup script) |

The Windows Task Scheduler tasks run in the background even when no user is logged in (with `-RunLevel Highest`).

**Battery backup**: Consider a UPS or keeping the laptop permanently plugged in.

---

## Security Model

### What is automated (no human approval needed)
- Code analysis, codebase exploration
- Local file edits (with TypeScript check)
- Creating branches and commits
- Creating PRs (not merging)
- Health checks and monitoring
- Syncing task queue from GitHub Issues
- Running tests locally

### What requires human approval
- Merging PRs to `main` or `production` — always via GitHub PR review
- Production deployments — GitHub Actions runs after merge (not before)
- Database migrations — reviewed in PR before merge
- Deleting branches — not automated
- Force pushes — blocked in `.claude/settings.json`

### Secrets management
- `.env` files are gitignored — never committed
- GitHub Secrets used in Actions workflows
- `GITHUB_TOKEN` in User environment variables (not process-level)

---

## Phased Roadmap

### Phase 1 ✅ (this session — Foundation)
- [x] `.claude/settings.json` — Hooks + permission policies
- [x] `.claude/devops/` — Task queue, config, audit logs
- [x] `automation/health-check.mjs` — Service health monitoring
- [x] `automation/task-intake.mjs` — GitHub Issues → queue sync
- [x] `automation/windows-setup.ps1` — Windows 24/7 configuration
- [x] `tbt-admin/admin-panel/app/devops/page.tsx` — Mobile-accessible dashboard
- [x] `DEVOPS_SYSTEM.md` — This document

### Phase 2 (next session — Automation Improvements)
- [ ] GitHub Actions: Add Slack/Telegram notification on build failure
- [ ] `automation/task-runner.mjs` — Auto-start Claude with next pending task
- [ ] GitHub Issue template (`devops_task.md`) for standardized task submission
- [ ] `automation/post-deploy-verify.mjs` — Smoke test after deployment
- [ ] Improve ci-cd.yml: add comment to PR with deployment URL after staging deploy

### Phase 3 (week 2 — Advanced Automation)
- [ ] PM2 daemon for persistent background Node.js monitoring
- [ ] `automation/regression-check.mjs` — Auto-run tests on file changes
- [ ] Cross-app sync validator — verify API contracts between apps
- [ ] Mobile push notifications via Firebase on task complete/fail
- [ ] Cost monitoring: track Claude API token usage per task

### Phase 4 (week 3+ — Self-Healing)
- [ ] Automatic rollback on production error spike
- [ ] TypeScript error watcher with auto-fix loop
- [ ] Stale PR detector (auto-close or rebase after N days)
- [ ] Dependency update agent (runs weekly, creates PRs for patch updates)

---

## Cost & Resource Estimates

| Resource | Current Cost | With Automation |
|---|---|---|
| Claude Code subscription | Your plan | Unchanged (no additional API calls) |
| GitHub Actions | ~0 (within free tier minutes) | +~500 min/month for monitoring jobs |
| Cloud Run | Pay-per-request | Unchanged |
| Vercel | Free tier | Unchanged |
| Windows laptop | Electricity cost for 24/7 | +~$3-5/month electricity |

**Important**: Claude Code autonomous sessions consume your Claude subscription quota. Each development task session uses significant tokens. Monitor usage at claude.ai.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `task-intake.mjs` fails | Check `GITHUB_TOKEN` is set; verify `gh auth status` |
| Dashboard shows no data | Add `GITHUB_TOKEN` to Vercel env vars and redeploy |
| Windows scheduled task not running | Run Task Scheduler as Admin; check task history |
| Health check shows service down | Check Cloud Run logs; may be a cold start |
| Claude Code hooks not firing | Verify `.claude/settings.json` exists; check Node.js is in PATH |
| Queue not updating | Run `node automation/task-intake.mjs` manually |
