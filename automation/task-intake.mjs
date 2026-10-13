#!/usr/bin/env node
/**
 * TBT Task Intake — GitHub Issues → Local Queue
 *
 * Fetches GitHub Issues labeled 'devops:pending' and syncs to
 * .claude/devops/queue.json for Claude Code to pick up.
 *
 * Required env: GITHUB_TOKEN
 * Run: node automation/task-intake.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const QUEUE_FILE = join(ROOT, '.claude', 'devops', 'queue.json');
const CONFIG_FILE = join(ROOT, '.claude', 'devops', 'config.json');

const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
const { owner, repo, taskLabels } = config.github;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN not set. Export it before running.');
  console.error('   set GITHUB_TOKEN=ghp_...');
  process.exit(1);
}

async function githubFetch(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

async function getIssuesByLabel(label) {
  return githubFetch(`/repos/${owner}/${repo}/issues?labels=${encodeURIComponent(label)}&state=open&per_page=50`);
}

async function updateIssueLabel(issueNumber, addLabel, removeLabel) {
  // Add label
  await githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
    method: 'POST',
    body: JSON.stringify({ labels: [addLabel] }),
    headers: { 'Content-Type': 'application/json' },
  });
  // Remove old label
  await githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(removeLabel)}`, {
    method: 'DELETE',
  });
}

function issueToTask(issue) {
  // Parse priority from labels: priority:high, priority:medium, etc.
  const priorityLabel = issue.labels.find(l => l.name.startsWith('priority:'));
  const priority = priorityLabel ? priorityLabel.name.split(':')[1] : 'medium';

  // Parse scope from labels: scope:user-web, scope:admin, scope:mobile, scope:backend
  const scopes = issue.labels
    .filter(l => l.name.startsWith('scope:'))
    .map(l => l.name.split(':')[1]);

  return {
    id: `gh-${issue.number}`,
    githubIssueNumber: issue.number,
    githubIssueUrl: issue.html_url,
    title: issue.title,
    description: issue.body || '',
    priority,
    scope: scopes.length > 0 ? scopes : ['backend', 'admin', 'user-web'],
    status: 'pending',
    createdAt: issue.created_at,
    startedAt: null,
    completedAt: null,
    attempts: 0,
    maxAttempts: 3,
    prUrl: null,
    notes: [],
  };
}

async function ensureLabelsExist() {
  const labelDefs = [
    { name: taskLabels.pending, color: '0075ca', description: 'Task waiting to be picked up by Claude Code' },
    { name: taskLabels.active, color: 'e4e669', description: 'Task currently being worked on' },
    { name: taskLabels.review, color: 'd93f0b', description: 'PR created, waiting for human review' },
    { name: taskLabels.done, color: '0e8a16', description: 'Task completed' },
    { name: taskLabels.blocked, color: 'b60205', description: 'Task blocked, needs human attention' },
    { name: 'priority:critical', color: 'b60205', description: 'Critical priority' },
    { name: 'priority:high', color: 'd93f0b', description: 'High priority' },
    { name: 'priority:medium', color: 'fbca04', description: 'Medium priority' },
    { name: 'priority:low', color: '0075ca', description: 'Low priority' },
    { name: 'scope:user-web', color: '7057ff', description: 'Affects user web app' },
    { name: 'scope:admin', color: 'e4e669', description: 'Affects admin panel' },
    { name: 'scope:mobile', color: 'd4c5f9', description: 'Affects Flutter mobile app' },
    { name: 'scope:backend', color: 'c2e0c6', description: 'Affects Fastify backend' },
  ];

  const existing = await githubFetch(`/repos/${owner}/${repo}/labels?per_page=100`);
  const existingNames = new Set(existing.map(l => l.name));

  for (const label of labelDefs) {
    if (!existingNames.has(label.name)) {
      try {
        await githubFetch(`/repos/${owner}/${repo}/labels`, {
          method: 'POST',
          body: JSON.stringify(label),
          headers: { 'Content-Type': 'application/json' },
        });
        console.log(`  Created label: ${label.name}`);
      } catch (err) {
        console.warn(`  Could not create label ${label.name}: ${err.message}`);
      }
    }
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] TBT Task Intake Sync`);
  console.log(`Repo: ${owner}/${repo}`);
  console.log('─'.repeat(60));

  // Ensure labels exist
  console.log('Ensuring GitHub labels exist...');
  await ensureLabelsExist();

  // Load current queue
  let queue;
  try {
    queue = JSON.parse(readFileSync(QUEUE_FILE, 'utf8'));
  } catch {
    queue = { version: '1.0', active: null, pending: [], completed: [], blocked: [] };
  }

  // Fetch pending issues
  const pendingIssues = await getIssuesByLabel(taskLabels.pending);
  console.log(`Found ${pendingIssues.length} pending task(s) in GitHub Issues`);

  // Convert to tasks, skip ones already in queue
  const existingIds = new Set([
    ...(queue.pending || []).map(t => t.id),
    ...(queue.completed || []).map(t => t.id),
    ...(queue.blocked || []).map(t => t.id),
    ...(queue.active ? [queue.active.id] : []),
  ]);

  let added = 0;
  for (const issue of pendingIssues) {
    const taskId = `gh-${issue.number}`;
    if (!existingIds.has(taskId)) {
      const task = issueToTask(issue);
      queue.pending.push(task);
      added++;
      console.log(`  + [#${issue.number}] ${issue.title} (${task.priority})`);
    }
  }

  if (added === 0) {
    console.log('  No new tasks to add.');
  }

  // Sort pending by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  queue.pending.sort((a, b) =>
    (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
  );

  queue.lastSync = new Date().toISOString();

  // Write updated queue
  mkdirSync(dirname(QUEUE_FILE), { recursive: true });
  writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));

  console.log('─'.repeat(60));
  console.log(`Queue: ${queue.pending.length} pending, active: ${queue.active ? queue.active.id : 'none'}`);
  console.log(`Saved to: ${QUEUE_FILE}`);

  if (queue.pending.length > 0) {
    console.log('\nNext task:');
    const next = queue.pending[0];
    console.log(`  [${next.id}] ${next.title}`);
    console.log(`  Priority: ${next.priority} | Scope: ${next.scope.join(', ')}`);
    console.log(`  ${next.githubIssueUrl}`);
    console.log('\nTo start this task, run Claude Code and say:');
    console.log(`  /develop "Start task ${next.id}: ${next.title}"`);
  }
}

main().catch(err => {
  console.error('Task intake failed:', err.message);
  process.exit(1);
});
