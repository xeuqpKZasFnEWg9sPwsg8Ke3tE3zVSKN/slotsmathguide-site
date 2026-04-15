#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const STATE_PATH = join(ROOT, 'scripts', 'deploy-cycle.state.json');
const DOMAIN = 'https://slotsmathguide.ca';

function sh(cmd) {
  return execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
}

function readState() {
  if (!existsSync(STATE_PATH)) return { lastReported: null, lastDeployed: null };
  try { return JSON.parse(readFileSync(STATE_PATH, 'utf8')); } catch { return { lastReported: null, lastDeployed: null }; }
}

function writeState(st) {
  writeFileSync(STATE_PATH, JSON.stringify(st, null, 2) + '\n', 'utf8');
}

function latestCommit() {
  return sh('git rev-parse HEAD');
}

function latestSubject() {
  return sh('git log -1 --pretty=%s');
}

function touchedPaths() {
  return sh('git show --name-only --pretty="" HEAD').split('\n').map(s => s.trim()).filter(Boolean);
}

function pickLinks(paths) {
  const urls = [];
  const seen = new Set();
  for (const p of paths) {
    if (!p.endsWith('index.html')) continue;
    let route = '/';
    if (p !== 'index.html') route = '/' + p.slice(0, -'index.html'.length);
    const url = DOMAIN + route;
    if (!seen.has(url)) { urls.push(url); seen.add(url); }
    if (urls.length >= 2) break;
  }
  if (urls.length === 0) urls.push(DOMAIN + '/');
  return urls;
}

function main() {
  const st = readState();
  const head = latestCommit();

  // If we have a new deploy since lastReported, emit summary (stdout) and update state.
  if (st.lastReported !== head) {
    const subject = latestSubject();
    const paths = touchedPaths();
    const links = pickLinks(paths);
    const msg = [
      `Deployed: ${subject}`,
      links.join('\n')
    ].join('\n');
    st.lastReported = head;
    st.lastDeployed = head;
    writeState(st);
    process.stdout.write(msg + '\n');
    return;
  }

  // Nothing new since last report: stay quiet (cron job should suppress output)
}

main();
