#!/usr/bin/env node
// Ingestion + validation for the crop water-coefficient seed (data/wucols-kc.json).
//
// Usage:
//   node tools/ingest-wucols.mjs                 # validate the existing seed JSON
//   node tools/ingest-wucols.mjs path/to.csv     # build the seed JSON from a CSV
//
// Expected CSV header columns (comma-delimited):
//   id,name,category,aliases,kcInitial,kcMid,kcLate,allowableDepletion,rootDepthIn
// `aliases` is a "|"-delimited list (e.g. "corn|maize").

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = resolve(here, '../data/wucols-kc.json');

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines.shift().split(',').map((h) => h.trim());
  return lines.map((line) => {
    const cells = line.split(',');
    const row = {};
    header.forEach((key, index) => {
      row[key] = (cells[index] ?? '').trim();
    });
    return row;
  });
}

function toCrop(row) {
  const num = (v) => (v === '' || v === undefined ? undefined : Number(v));
  const kcByStage = {};
  if (row.kcInitial) kcByStage.initial = num(row.kcInitial);
  if (row.kcMid) kcByStage.mid = num(row.kcMid);
  if (row.kcLate) kcByStage.late = num(row.kcLate);
  return {
    id: row.id,
    name: row.name,
    category: row.category || undefined,
    aliases: row.aliases ? row.aliases.split('|').map((a) => a.trim()).filter(Boolean) : [],
    kcByStage,
    allowableDepletion: num(row.allowableDepletion),
    rootDepthIn: num(row.rootDepthIn),
  };
}

function validate(seed) {
  const problems = [];
  const ids = new Set();
  if (!Array.isArray(seed.crops)) {
    problems.push('crops array is missing');
    return problems;
  }
  for (const crop of seed.crops) {
    if (!crop.id) problems.push(`crop missing id: ${JSON.stringify(crop)}`);
    if (ids.has(crop.id)) problems.push(`duplicate id: ${crop.id}`);
    ids.add(crop.id);
    if (!crop.name) problems.push(`${crop.id}: missing name`);
    const mid = crop.kcByStage?.mid ?? crop.kcByStage?.initial;
    if (typeof mid !== 'number' || mid <= 0 || mid > 1.4) {
      problems.push(`${crop.id}: implausible mid Kc (${mid})`);
    }
    if (crop.allowableDepletion !== undefined && (crop.allowableDepletion <= 0 || crop.allowableDepletion > 0.9)) {
      problems.push(`${crop.id}: implausible allowableDepletion (${crop.allowableDepletion})`);
    }
  }
  return problems;
}

const csvArg = process.argv[2];

if (csvArg) {
  const csvPath = resolve(process.cwd(), csvArg);
  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  const crops = rows.map(toCrop);
  const seed = {
    source: 'WUCOLS IV + FAO-56 (curated seed for California crops)',
    generatedNote: `Generated from ${csvArg} on ${new Date().toISOString()} via tools/ingest-wucols.mjs.`,
    crops,
  };
  const problems = validate(seed);
  if (problems.length) {
    console.error(`Refusing to write: ${problems.length} validation problem(s):`);
    problems.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
  }
  writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);
  console.log(`Wrote ${crops.length} crops to ${seedPath}`);
} else {
  const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
  const problems = validate(seed);
  if (problems.length) {
    console.error(`Seed validation failed (${problems.length}):`);
    problems.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
  }
  console.log(`Seed OK: ${seed.crops.length} crops, source "${seed.source}".`);
}
