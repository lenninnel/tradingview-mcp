/**
 * Source audit for the "evaluate is not defined" class of bug (B1.3).
 *
 * Modules that import `evaluate as _evaluate` (dependency-injection style) must
 * obtain `evaluate` from `_resolve(_deps)` inside every function that calls it.
 * A bare `evaluate(` in such a function throws ReferenceError at runtime — which
 * is exactly what symbol_info, chart_get_visible_range and chart_scroll_to_date
 * did until 2026-09-23. This test fails the build instead of the user.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CORE_DIR = new URL('../src/core/', import.meta.url).pathname;

function functionBodies(source) {
  // Split on top-level `export async function NAME(` boundaries; good enough for these modules.
  const parts = source.split(/(?=^export (?:async )?function )/m);
  return parts.slice(1).map(p => ({ name: (p.match(/function\s+(\w+)/) || [])[1], body: p }));
}

describe('source audit — evaluate is always resolved in DI modules', () => {
  for (const file of readdirSync(CORE_DIR).filter(f => f.endsWith('.js'))) {
    const source = readFileSync(join(CORE_DIR, file), 'utf8');
    const aliased = /import\s*\{[^}]*\bevaluate as _evaluate\b/.test(source);
    if (!aliased) continue;
    for (const { name, body } of functionBodies(source)) {
      const usesEvaluate = /\bevaluate(?:Async)?\(/.test(body);
      if (!usesEvaluate) continue;
      it(`${file}: ${name}() resolves evaluate from _deps`, () => {
        assert.ok(/=\s*_resolve\(/.test(body),
          `${file}:${name}() calls evaluate() but never destructures it from _resolve(_deps) — ReferenceError at runtime`);
      });
    }
  }
});
