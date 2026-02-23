import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import https from 'https';

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

const message = {
  channel: selfDm.id,
  text: `🌅 *Morning task sync reminder*\n\nOpen Claude Code in your task manager and say *"sync my tasks"* to extract new tasks from Slack.\n\n_AI Task Manager · ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}_`,
};

const body = JSON.stringify(message);

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
      console.log(`✓ Reminder sent to ${selfDm.name} (${selfDm.id})`);
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
