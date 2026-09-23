#!/usr/bin/env node
/**
 * Smoke test over every MCP tool the bridge advertises (desk spec 2026-09-23, §B1.4).
 *
 * Starts src/server.js over stdio, lists its tools, calls every READ-ONLY tool with
 * minimal arguments and records success / error / duration. Tools that change chart,
 * cloud or account state are listed but skipped — the point is to know the damage
 * radius of the bridge, not to redraw the user's chart.
 *
 *   node scripts/smoke_tools.js                    # writes reports/smoke-tools-<date>.md
 *   node scripts/smoke_tools.js --out path.md
 *   node scripts/smoke_tools.js --inventory        # no calls, just the tool table
 *
 * Without a reachable CDP endpoint (TradingView not running with
 * --remote-debugging-port=9222) the script writes the inventory and marks every
 * call as "not run (CDP unreachable)" instead of waiting through 81 connection
 * back-offs.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CDP_URL = process.env.TV_CDP_URL || 'http://localhost:9222/json/list';
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 20000);

// Read-only tools and the minimal arguments that make each a real call.
// Anything not listed here mutates state and is skipped on purpose.
const READ_ONLY = {
  tv_health_check: {}, tv_discover: {}, tv_ui_state: {},
  chart_get_state: {}, chart_get_visible_range: {}, symbol_info: {}, symbol_search: { query: 'AAPL' },
  quote_get: {}, data_get_ohlcv: { summary: true, count: 5 }, data_get_study_values: {},
  data_get_pine_lines: {}, data_get_pine_labels: { max_labels: 5 }, data_get_pine_tables: {}, data_get_pine_boxes: {},
  data_get_strategy_results: {}, data_get_trades: { max_trades: 1 }, data_get_equity: {}, depth_get: {},
  data_get_indicator: null,          // needs an entity id from chart_get_state — resolved at runtime
  pine_get_source: {}, pine_get_errors: {}, pine_get_console: {}, pine_list_scripts: {}, pine_analyze: { source: '//@version=5\nindicator("x")\nplot(close)' },
  pine_check: { source: '//@version=5\nindicator("x")\nplot(close)' },
  draw_list: {}, draw_get_properties: null,
  alert_list: {}, watchlist_get: {}, watchlist_list: {},
  replay_status: {}, layout_list: {},
  ui_find_element: { query: 'Save' }, pane_list: {}, tab_list: {}, capture_screenshot: { region: 'chart' },
};
// Verbs that always mean mutation, used to classify tools the allowlist does not name.
const MUTATING = /^(chart_set|chart_manage|chart_scroll|pine_(set|save|new|open|compile|smart|push|pull|add|delete|remove)|draw_(shape|remove|clear)|alert_(create|delete)|watchlist_(add|create|delete|append|remove)|replay_(start|step|autoplay|stop|trade)|indicator_(set|toggle)|layout_switch|ui_(click|open|close|fullscreen|type|key|eval|scroll|hotkey|dismiss|hover|mouse)|pane_(set|resize|toggle|add|remove|collapse|maximize|focus)|tab_(new|close|switch|open)|batch_run|tv_launch|stream_(start|stop|subscribe|unsubscribe))/;

function classify(name) {
  if (name in READ_ONLY) return 'read';
  if (MUTATING.test(name)) return 'mutating';
  return 'unclassified';
}

async function cdpReachable() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const r = await fetch(CDP_URL, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms} ms`)), ms))]);
}

async function main() {
  const args = process.argv.slice(2);
  const inventoryOnly = args.includes('--inventory');
  const outIdx = args.indexOf('--out');
  const date = new Date().toISOString().slice(0, 10);
  const outPath = outIdx !== -1 ? args[outIdx + 1] : join(ROOT, 'reports', `smoke-tools-${date}.md`);

  const transport = new StdioClientTransport({ command: process.execPath, args: [join(ROOT, 'src', 'server.js')], stderr: 'pipe' });
  const client = new Client({ name: 'smoke-tools', version: '1.0.0' });
  await client.connect(transport);
  const { tools } = await client.listTools();
  tools.sort((a, b) => a.name.localeCompare(b.name));

  const live = !inventoryOnly && await cdpReachable();
  const rows = [];
  let chartState = null;
  for (const tool of tools) {
    const kind = classify(tool.name);
    const row = { name: tool.name, kind, status: '', ms: null, note: '' };
    if (kind !== 'read') { row.status = 'skipped'; row.note = kind === 'mutating' ? 'changes state' : 'not on the read-only allowlist — classify before calling'; rows.push(row); continue; }
    if (!live) { row.status = 'not run'; row.note = inventoryOnly ? 'inventory only' : 'CDP unreachable'; rows.push(row); continue; }

    let argsFor = READ_ONLY[tool.name];
    if (argsFor === null) {
      // dependent tools: take the first id from chart state if we have one
      if (!chartState) { try { chartState = JSON.parse((await client.callTool({ name: 'chart_get_state', arguments: {} })).content?.[0]?.text || '{}'); } catch { chartState = {}; } }
      const study = chartState?.studies?.[0]?.id;
      if (tool.name === 'data_get_indicator' || tool.name === 'indicator_get_settings') argsFor = study ? { entity_id: study } : undefined;
      if (tool.name === 'draw_get_properties') argsFor = undefined;
      if (!argsFor) { row.status = 'not run'; row.note = 'needs an entity id and the chart has none'; rows.push(row); continue; }
    }
    const t0 = Date.now();
    try {
      const res = await withTimeout(client.callTool({ name: tool.name, arguments: argsFor }), TIMEOUT_MS);
      row.ms = Date.now() - t0;
      const text = res.content?.[0]?.text || '';
      let parsed = null;
      try { parsed = JSON.parse(text); } catch { /* not JSON */ }
      if (res.isError || (parsed && parsed.success === false)) {
        row.status = 'error';
        row.note = String(parsed?.error || text).slice(0, 160);
      } else {
        row.status = 'ok';
        if (parsed && typeof parsed === 'object') {
          const keys = Object.keys(parsed).filter(k => k !== 'success').slice(0, 6);
          row.note = keys.join(', ');
          if ('currency' in parsed) row.note += ` · currency=${parsed.currency}${parsed.currency_converted ? ' (CONVERTED)' : ''}`;
        }
      }
    } catch (err) {
      row.ms = Date.now() - t0;
      row.status = 'error';
      row.note = String(err.message).slice(0, 160);
    }
    rows.push(row);
  }
  await client.close();

  const counts = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  const lines = [
    `# TradingView bridge — tool smoke test ${date}`,
    '',
    `Tools advertised: **${tools.length}**. CDP ${live ? 'reachable' : 'NOT reachable'} at ${CDP_URL}. ` +
    Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', ') + '.',
    '',
    live ? 'Read-only tools were called with minimal arguments against the live chart; mutating tools were listed, not called.'
         : 'No TradingView with CDP was reachable, so this run is an inventory: nothing was called. Re-run on the Mac after `tvstart` for live results.',
    '',
    '| Tool | Class | Result | ms | Note |',
    '|---|---|---|---:|---|',
    ...rows.map(r => `| \`${r.name}\` | ${r.kind} | ${r.status} | ${r.ms ?? ''} | ${r.note.replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`),
    '',
    `Generated by \`scripts/smoke_tools.js\` at ${new Date().toISOString()}.`,
    '',
  ];
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines.join('\n'));
  console.log(`${tools.length} tools, ${JSON.stringify(counts)} → ${outPath}`);
  process.exit(counts.error ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
