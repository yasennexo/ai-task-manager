import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import https from 'https';
import { getOpenTasks, reopenSnoozedDueTasks } from './db/helpers';

const token = process.env.SLACK_BOT_TOKEN;
if (!token) {
  console.error('✗ SLACK_BOT_TOKEN is not set in .env');
  process.exit(1);
}

const slackFile = path.join(process.cwd(), 'slack.json');
if (!fs.existsSync(slackFile)) {
  console.error('✗ slack.json not found');
  process.exit(1);
}

const slack = JSON.parse(fs.readFileSync(slackFile, 'utf8'));
const selfDm = slack.dms?.find((d: { name: string; id: string }) => d.name.toLowerCase().includes('self'));

if (!selfDm) {
  console.error('✗ Could not find self-DM entry in slack.json (needs a name containing "self")');
  process.exit(1);
}

// Reopen any snoozed tasks that are due, then fetch all open tasks
reopenSnoozedDueTasks();
const allTasks = getOpenTasks();

const PRIORITY_LABEL: Record<string, string> = { high: '[HIGH]', medium: '[MED] ', low: '[LOW] ' };
const PROJECT_EMOJI: Record<string, string> = { nexo: '🔵', personal: '🟢', mindhub: '🟣' };

// Group by project
const projects = ['nexo', 'mindhub', 'personal'] as const;
const sections: string[] = [];

for (const project of projects) {
  const tasks = allTasks.filter(t => t.project === project);
  if (tasks.length === 0) continue;
  const lines = [`${PROJECT_EMOJI[project]} *${project.toUpperCase()}*`];
  for (const t of tasks) {
    lines.push(`  ${PRIORITY_LABEL[t.priority] ?? '[???]'} ${t.title}`);
  }
  sections.push(lines.join('\n'));
}

const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const taskBlock = sections.length > 0 ? sections.join('\n\n') : "_No open tasks — you're all caught up!";

const text = [
  `🌅 *Good morning! Here's your task list for ${date}*`,
  '',
  taskBlock,
  '',
  `*Open tasks: ${allTasks.length}*`,
  '',
  '_Open Claude Code and say *"sync my tasks"* to check for new ones from Slack._',
].join('\n');

const body = JSON.stringify({ channel: selfDm.id, text });

const options = {
  hostname: 'slack.com',
  path: '/api/chat.postMessage',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Authorization': `Bearer ${token}`,
    'Content-Length': Buffer.byteLength(body),
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.ok) {
      console.log(`✓ Reminder sent to ${selfDm.name} (${selfDm.id}) — ${allTasks.length} tasks included`);
    } else {
      console.error(`✗ Slack API error: ${json.error}`);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error(`✗ Request failed: ${e.message}`);
  process.exit(1);
});

req.write(body);
req.end();
