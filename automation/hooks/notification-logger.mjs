#!/usr/bin/env node
// Logs Claude Code notifications to .claude/devops/notifications.jsonl
import { appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const LOG = 'F:/admin/.claude/devops/notifications.jsonl';

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input || '{}');
    const message = event.message || event.tool_input?.message || '';
    if (!message) { process.exit(0); return; }

    const entry = { ts: new Date().toISOString(), message };
    mkdirSync(dirname(LOG), { recursive: true });
    appendFileSync(LOG, JSON.stringify(entry) + '\n');
  } catch {
    // Never fail a hook
  }
  process.exit(0);
});
