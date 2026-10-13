#!/usr/bin/env node
// Receives tool input/output via stdin as JSON.
// Logs file edits to the audit trail.
import { readFileSync, appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const AUDIT_LOG = 'F:/admin/.claude/devops/audit.jsonl';

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input || '{}');
    const toolInput = event.tool_input || {};
    const filePath = toolInput.file_path || toolInput.path || 'unknown';

    // Only log TBT source files, skip screenshots/binaries
    if (!filePath || /\.(png|jpeg|jpg|gif|pdf|zip|docx)$/i.test(filePath)) {
      process.exit(0);
    }

    const entry = {
      ts: new Date().toISOString(),
      tool: event.tool_name,
      file: filePath,
    };

    mkdirSync(dirname(AUDIT_LOG), { recursive: true });
    appendFileSync(AUDIT_LOG, JSON.stringify(entry) + '\n');
  } catch {
    // Never fail a hook — Claude Code will block on non-zero exit
  }
  process.exit(0);
});
