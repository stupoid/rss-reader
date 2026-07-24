#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ── Config ──

const SESSIONS_ROOT = join(homedir(), ".omp", "agent", "sessions");
const CWD = process.cwd();

// ── Find project session directory ──

function encodeDir(cwd) {
  const home = homedir();
  if (cwd.startsWith(home)) {
    const rel = cwd.slice(home.length).replace(/^[/\\]/, "");
    return rel ? `-${rel.replace(/[/\\:]/g, "-")}` : "-";
  }
  return `--${cwd.slice(1).replace(/[/\\:]/g, "-")}--`;
}

const sessionDir = join(SESSIONS_ROOT, encodeDir(CWD));
if (!existsSync(sessionDir)) {
  console.error("No session directory found for", CWD);
  process.exit(1);
}

const files = readdirSync(sessionDir)
  .filter((f) => f.endsWith(".jsonl"))
  .sort();

if (files.length === 0) {
  console.error("No session files found");
  process.exit(1);
}

// ── Parse all sessions ──

let totalCost = 0;
let totalInput = 0;
let totalOutput = 0;
let totalMessages = 0;
const sessions = [];

for (const file of files) {
  const lines = readFileSync(join(sessionDir, file), "utf-8").trim().split("\n");
  let sessionCost = 0;
  let sessionInput = 0;
  let sessionOutput = 0;
  let sessionMessages = 0;
  let header = null;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type === "session") header = entry;
      if (entry.type === "message" && entry.message?.usage) {
        const c = entry.message.usage.cost?.total ?? 0;
        sessionCost += c;
        sessionInput += entry.message.usage.input ?? 0;
        sessionOutput += entry.message.usage.output ?? 0;
        sessionMessages++;
      }
    } catch { /* skip malformed */ }
  }

  if (header && sessionMessages > 0) {
    const start = new Date(header.timestamp).getTime();
    const end = statSync(join(sessionDir, file)).mtimeMs;
    const mins = Math.round((end - start) / 60000);
    const dur = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;

    sessions.push({
      sessionId: header.id,
      date: header.timestamp.slice(0, 10),
      model: header.model || "unknown",
      messages: sessionMessages,
      tokens: { input: sessionInput, output: sessionOutput },
      cost: sessionCost.toFixed(6),
      duration: dur,
    });
    totalCost += sessionCost;
    totalInput += sessionInput;
    totalOutput += sessionOutput;
    totalMessages += sessionMessages;
  }
}

// ── Output ──

for (const s of sessions) {
  console.log(`${s.date}  ${s.sessionId.slice(0, 8)}  ${String(s.messages).padStart(4)} msgs  ${s.duration.padStart(6)}  $${s.cost}`);
}

console.log(`\n${sessions.length} sessions  ${totalMessages} messages  $${totalCost.toFixed(6)} total`);

// Write COST.md
const { writeFileSync } = await import("node:fs");
let md = "# Project Cost\n\n";
md += `> Last updated: ${new Date().toISOString()}\n\n`;
md += "| Date | Session | Messages | Duration | Input | Output | Cost |\n";
md += "|---|---|---|---|---|---|---|\n";
for (const s of sessions) {
  md += `| ${s.date} | ${s.sessionId.slice(0, 8)} | ${s.messages} | ${s.duration} | ${s.tokens.input.toLocaleString()} | ${s.tokens.output.toLocaleString()} | $${s.cost} |\n`;
}
md += `\n## ${sessions.length} sessions · ${totalMessages.toLocaleString()} messages · $${totalCost.toFixed(2)} total\n`;
writeFileSync(join(CWD, "COST.md"), md);
