#!/usr/bin/env node
/**
 * TBT Autonomous Task Runner
 *
 * Picks the next pending task from the queue, invokes Claude Code
 * non-interactively to implement it, then reports results back to
 * the GitHub Issue and advances the label.
 *
 * Required env: GITHUB_TOKEN
 * Run: node automation/task-runner.mjs
 * Or scheduled via Windows Task Scheduler.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { appendFileSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { notify } from './notify.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DEVOPS_DIR = join(ROOT, '.claude', 'devops');
const QUEUE_FILE = join(DEVOPS_DIR, 'queue.json');
const SESSION_LOG = join(DEVOPS_DIR, 'session.jsonl');
const LOCK_FILE = join(DEVOPS_DIR, 'runner.lock');
const CONFIG_FILE = join(DEVOPS_DIR, 'config.json');

const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
const { owner, repo, taskLabels } = config.github;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN not set.');
  process.exit(1);
}

// ── GitHub API ────────────────────────────────────────────────────────────────

async function ghFetch(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${path} → ${res.status}: ${body}`);
  }
  return res.status === 204 ? null : res.json();
}

async function postIssueComment(issueNumber, body) {
  return ghFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

async function setIssueLabel(issueNumber, addLabel, removeLabel) {
  await ghFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
    method: 'POST',
    body: JSON.stringify({ labels: [addLabel] }),
  });
  if (removeLabel) {
    await ghFetch(
      `/repos/${owner}/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(removeLabel)}`,
      { method: 'DELETE' }
    ).catch(() => {}); // ignore if label not present
  }
}

// ── Queue helpers ─────────────────────────────────────────────────────────────

function loadQueue() {
  try {
    return JSON.parse(readFileSync(QUEUE_FILE, 'utf8'));
  } catch {
    return { version: '1.0', active: null, pending: [], completed: [], blocked: [] };
  }
}

function saveQueue(queue) {
  mkdirSync(dirname(QUEUE_FILE), { recursive: true });
  writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

function logSession(entry) {
  mkdirSync(DEVOPS_DIR, { recursive: true });
  appendFileSync(SESSION_LOG, JSON.stringify({ ...entry, ts: new Date().toISOString() }) + '\n');
}

// ── Lock file ─────────────────────────────────────────────────────────────────

function acquireLock() {
  if (existsSync(LOCK_FILE)) {
    const lockData = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
    const ageSecs = (Date.now() - new Date(lockData.ts).getTime()) / 1000;
    if (ageSecs < 3600) {
      console.log(`⏸  Runner already active (lock age: ${Math.round(ageSecs)}s). Exiting.`);
      return false;
    }
    console.log(`⚠️  Stale lock (${Math.round(ageSecs / 60)}min old), clearing.`);
  }
  writeFileSync(LOCK_FILE, JSON.stringify({ ts: new Date().toISOString(), pid: process.pid }));
  return true;
}

function releaseLock() {
  try { unlinkSync(LOCK_FILE); } catch {}
}

// ── Claude invocation ─────────────────────────────────────────────────────────

function buildPrompt(task) {
  return `You are working on a task from the TBT autonomous development queue.

TASK #${task.githubIssueNumber}: ${task.title}
PRIORITY: ${task.priority}
SCOPE: ${task.scope.join(', ')}
GITHUB ISSUE: ${task.githubIssueUrl}

DESCRIPTION:
${task.description || '(no description provided)'}

WORKING DIRECTORY: ${ROOT}

Instructions:
1. Understand what the task requires from the description above.
2. Read the relevant files to understand the current state of the code.
3. Implement the changes needed to complete the task.
4. Run the appropriate type checks or tests for the affected workspace.
5. Create a git commit with a descriptive message referencing issue #${task.githubIssueNumber}.
6. If the task is complete and tests pass, summarize what you did in 3-5 bullet points.
7. If you encounter a blocker (missing info, unclear requirements, conflicting code), describe it clearly so a human can resolve it.

Do not create a PR — just commit. The task-runner will create the PR.
Do not ask clarifying questions — make your best judgment from the description.`;
}

function findClaudeCli() {
  for (const candidate of ['claude', 'claude.cmd']) {
    try {
      const result = spawnSync(candidate, ['--version'], { encoding: 'utf8', timeout: 5000 });
      if (result.status === 0) return candidate;
    } catch {}
  }
  // Try common install paths
  const paths = [
    'C:\\Users\\' + (process.env.USERNAME || '') + '\\AppData\\Roaming\\npm\\claude.cmd',
    'C:\\Program Files\\nodejs\\claude.cmd',
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

function runClaude(prompt, timeoutMs = 30 * 60 * 1000) {
  const claudeCmd = findClaudeCli();
  if (!claudeCmd) {
    return {
      success: false,
      output: '',
      error: 'claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code',
    };
  }

  console.log(`  Using claude CLI: ${claudeCmd}`);

  const result = spawnSync(
    claudeCmd,
    ['--print', '--dangerously-skip-permissions', '--output-format', 'text', prompt],
    {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: timeoutMs,
      env: { ...process.env },
      maxBuffer: 10 * 1024 * 1024, // 10 MB
    }
  );

  if (result.error) {
    return { success: false, output: result.stdout || '', error: result.error.message };
  }

  return {
    success: result.status === 0,
    output: result.stdout || '',
    error: result.stderr || '',
    exitCode: result.status,
  };
}

// ── Git helpers ───────────────────────────────────────────────────────────────

function getNewCommitsSince(sha) {
  try {
    const out = execSync(`git log ${sha}..HEAD --oneline`, { cwd: ROOT, encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function getCurrentSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function createPr(task, branchNote) {
  try {
    // Push current branch first
    execSync('git push origin HEAD', { cwd: ROOT, encoding: 'utf8' });

    const body = `Closes #${task.githubIssueNumber}\n\nAutonomously implemented by Claude Code via the TBT dev task queue.\n\n**Task:** ${task.title}\n**Priority:** ${task.priority}\n**Scope:** ${task.scope.join(', ')}`;

    const result = execSync(
      `gh pr create --title "[Auto] ${task.title}" --body "${body.replace(/"/g, '\\"')}" --base main`,
      { cwd: ROOT, encoding: 'utf8' }
    );
    return result.trim();
  } catch (err) {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n[${new Date().toISOString()}] TBT Task Runner`);
  console.log('─'.repeat(60));

  if (!acquireLock()) process.exit(0);

  try {
    const queue = loadQueue();

    // Check if something is already active
    if (queue.active) {
      console.log(`⏸  Task ${queue.active.id} already active: "${queue.active.title}"`);
      console.log('   Resolve it first before starting a new task.');
      return;
    }

    if (!queue.pending || queue.pending.length === 0) {
      console.log('✅ No pending tasks. Queue is empty.');
      return;
    }

    // Pick the highest-priority pending task
    const task = queue.pending.shift();
    task.status = 'active';
    task.startedAt = new Date().toISOString();
    task.attempts = (task.attempts || 0) + 1;
    queue.active = task;
    saveQueue(queue);

    console.log(`\n▶ Starting task ${task.id}: "${task.title}"`);
    console.log(`  Priority: ${task.priority} | Scope: ${task.scope.join(', ')}`);
    console.log(`  Issue: ${task.githubIssueUrl}`);

    // Transition GitHub label: pending → active
    await setIssueLabel(task.githubIssueNumber, taskLabels.active, taskLabels.pending);

    // Post "starting" comment
    await postIssueComment(
      task.githubIssueNumber,
      `🤖 **Claude Code is working on this task.**\n\nStarted: ${new Date().toISOString()}\nAttempt: ${task.attempts}/${task.maxAttempts}`
    );

    logSession({ event: 'task_started', taskId: task.id, title: task.title });

    // Record HEAD sha so we can detect new commits
    const headBefore = getCurrentSha();

    // ── Invoke Claude Code ─────────────────────────────────────────────────
    console.log('\n  Invoking Claude Code...');
    const prompt = buildPrompt(task);
    const { success, output, error } = runClaude(prompt);

    console.log(`\n  Claude exited: ${success ? 'success' : 'failure'}`);
    if (error) console.log(`  stderr: ${error.slice(0, 300)}`);

    // ── Check for new commits ──────────────────────────────────────────────
    const newCommits = headBefore ? getNewCommitsSince(headBefore) : [];
    console.log(`  New commits: ${newCommits.length}`);

    // ── Build result comment ───────────────────────────────────────────────
    const truncated = output.length > 6000 ? output.slice(0, 6000) + '\n…(truncated)' : output;

    if (success || newCommits.length > 0) {
      // Try to create PR
      let prUrl = null;
      if (newCommits.length > 0) {
        console.log('  Creating PR...');
        prUrl = createPr(task);
        if (prUrl) {
          console.log(`  PR: ${prUrl}`);
          task.prUrl = prUrl;
        }
      }

      const comment = [
        `✅ **Task completed by Claude Code.**`,
        '',
        prUrl ? `**PR:** ${prUrl}` : '',
        newCommits.length > 0 ? `**Commits (${newCommits.length}):**\n${newCommits.map(c => `- \`${c}\``).join('\n')}` : '',
        '',
        '<details><summary>Claude output</summary>\n\n```\n' + truncated + '\n```\n</details>',
      ].filter(l => l !== null).join('\n');

      await postIssueComment(task.githubIssueNumber, comment);
      await setIssueLabel(task.githubIssueNumber, taskLabels.review, taskLabels.active);

      task.status = 'review';
      task.completedAt = new Date().toISOString();
      queue.active = null;
      queue.completed = queue.completed || [];
      queue.completed.unshift(task);
      saveQueue(queue);

      logSession({ event: 'task_review', taskId: task.id, prUrl, commits: newCommits.length });
      console.log(`\n✅ Task moved to review. PR: ${prUrl || '(none)'}`);
      await notify(
        `✅ TBT Task Complete\n\n${task.title}\n\n${prUrl ? `PR: ${prUrl}` : `${newCommits.length} commit(s), no PR`}\n\nIssue: ${task.githubIssueUrl}`
      ).catch(() => {});

    } else {
      // Failure
      const isLastAttempt = task.attempts >= task.maxAttempts;
      const nextLabel = isLastAttempt ? taskLabels.blocked : taskLabels.pending;
      const nextStatus = isLastAttempt ? 'blocked' : 'pending';

      const comment = [
        isLastAttempt ? `❌ **Task failed after ${task.attempts} attempt(s). Marked as blocked.**` : `⚠️ **Attempt ${task.attempts}/${task.maxAttempts} failed. Requeued.**`,
        '',
        error ? `**Error:** ${error.slice(0, 500)}` : '',
        '',
        '<details><summary>Claude output</summary>\n\n```\n' + truncated + '\n```\n</details>',
      ].filter(Boolean).join('\n');

      await postIssueComment(task.githubIssueNumber, comment);
      await setIssueLabel(task.githubIssueNumber, nextLabel, taskLabels.active);

      task.status = nextStatus;
      queue.active = null;

      if (isLastAttempt) {
        queue.blocked = queue.blocked || [];
        queue.blocked.unshift(task);
      } else {
        queue.pending = queue.pending || [];
        queue.pending.unshift(task); // back to front of queue
      }
      saveQueue(queue);

      logSession({ event: `task_${nextStatus}`, taskId: task.id, attempts: task.attempts });
      console.log(`\n${isLastAttempt ? '❌ Task blocked.' : '⚠️  Task requeued.'}`);
      if (isLastAttempt) {
        await notify(
          `❌ TBT Task Blocked\n\n${task.title}\n\nFailed after ${task.attempts} attempt(s). Human review needed.\n\nIssue: ${task.githubIssueUrl}`
        ).catch(() => {});
      }
    }

  } finally {
    releaseLock();
  }
}

main().catch(err => {
  console.error('Task runner error:', err.message);
  releaseLock();
  process.exit(1);
});
