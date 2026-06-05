// Deploy-time exporter — sends a `generate-course` repository_dispatch to the
// LLM Academy content repo so it drafts a course from this repo's seed material.
// Canonical copy lives in bijanp24/LLM-Workflow/automation/export-course.mjs.
//
// Seed precedence:
//   1. docs/lessons/next-course.md  (author-controlled topic/outline)
//   2. otherwise, the latest commit subject/body + changed file list (fallback)
//
// Env:
//   ACADEMY_DISPATCH_TOKEN  required — PAT with `repo` scope on the content repo.
//   CONTENT_REPO            optional — defaults to bijanp24/LLM-Workflow.

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const CONTENT_REPO = process.env.CONTENT_REPO || 'bijanp24/LLM-Workflow';
const TOKEN = process.env.ACADEMY_DISPATCH_TOKEN;
const SEED_FILE = 'docs/lessons/next-course.md';

if (!TOKEN) {
  console.log('::warning::ACADEMY_DISPATCH_TOKEN not set — skipping course export.');
  process.exit(0);
}

let seedType;
let seedTitle = '';
let seedContent = '';

if (fs.existsSync(SEED_FILE) && fs.statSync(SEED_FILE).size > 0) {
  seedType = 'lesson-export';
  seedContent = fs.readFileSync(SEED_FILE, 'utf8');
  const m = seedContent.match(/^#\s+(.+)$/m);
  if (m) seedTitle = m[1].trim();
} else {
  seedType = 'diff';
  const sh = (c) => {
    try {
      return execSync(c, { encoding: 'utf8' });
    } catch {
      return '';
    }
  };
  const log = sh('git log -1 --pretty=%s%n%n%b');
  const files = sh('git diff --name-only HEAD~1 HEAD');
  seedContent = `Latest change:\n${log}\nChanged files:\n${files}`;
}

seedContent = seedContent.slice(0, 50000);
if (!seedContent.trim()) {
  console.log('No seed content available — skipping course export.');
  process.exit(0);
}

const body = {
  event_type: 'generate-course',
  client_payload: {
    source_repo: process.env.GITHUB_REPOSITORY,
    source_ref: process.env.GITHUB_REF_NAME,
    sha: process.env.GITHUB_SHA,
    seed_type: seedType,
    seed_title: seedTitle,
    seed_content: seedContent,
  },
};

const res = await fetch(`https://api.github.com/repos/${CONTENT_REPO}/dispatches`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

if (!res.ok) {
  console.error(`Dispatch failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
console.log(`Dispatched generate-course to ${CONTENT_REPO} (seed_type=${seedType}, title=${seedTitle || 'n/a'}).`);
