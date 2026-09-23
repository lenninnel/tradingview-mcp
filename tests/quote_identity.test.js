/**
 * B1.1 / B1.2 / B1.3 regression tests — no TradingView needed.
 *
 *   quote_get must never answer for a different symbol than requested,
 *   every price payload must carry the series currency,
 *   a currency-converted chart is refused by default,
 *   symbol_info / chart_get_visible_range / chart_scroll_to_date must not reference
 *   an undefined `evaluate` (the "evaluate is not defined" bug).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getQuote, getOhlcv } from '../src/core/data.js';
import { getState, symbolInfo, getVisibleRange, scrollToDate, setCurrency } from '../src/core/chart.js';
import { symbolFacts, assertSymbolMatch, assertCurrency } from '../src/core/symbol_meta.js';

// Chart is on NBIS via the Cboe One feed, priced in USD, 15-minute delayed.
const NBIS_META = {
  symbol: 'NASDAQ:NBIS', pro_name: 'BATS:NBIS', full_name: 'BATS:NBIS', description: 'Nebius Group N.V. Class A',
  exchange: 'Cboe One', listed_exchange: 'NASDAQ', type: 'stock', currency_code: 'USD',
  original_currency_code: null, data_status: 'delayed_streaming', delay: 900, timezone: 'America/New_York',
  session: '0930-1600', pricescale: 100, resolution: 'D', meta_sources: ['symbolExt', 'symbolInfo'],
};
// Same chart, but displayed in the account currency (EUR): the B1.2 case.
const NBIS_EUR_META = { ...NBIS_META, currency_code: 'EUR', original_currency_code: 'USD' };
// A chart whose series does not declare a currency at all.
const NO_CCY_META = { ...NBIS_META, currency_code: null, original_currency_code: null };

const LAST_BAR = { time: 1758499200, open: 233.24, high: 246.61, low: 231.66, close: 236.12, last: 236.12, volume: 15388959 };
const BARS = { bars: [LAST_BAR, { ...LAST_BAR, time: 1758585600 }], total_bars: 2, source: 'direct_bars' };

function deps(meta, { bars = BARS, extra = {} } = {}) {
  const calls = [];
  const evaluate = async (expr) => {
    calls.push(expr);
    if (expr.includes('symbolInfo()') && expr.includes('meta_sources')) return meta;
    if (expr.includes('valueAt(bars.lastIndex())')) return LAST_BAR;
    if (expr.includes('total_bars')) return bars;
    if (expr.includes('getVisibleRange') && expr.includes('bars_range')) return { visible_range: { from: 1, to: 2 }, bars_range: { from: 0, to: 10 } };
    if (expr.includes('getAllStudies')) return { symbol: meta.symbol, resolution: 'D', chartType: 1, studies: [] };
    if (expr.endsWith('.resolution()')) return 'D';
    if (expr.endsWith('.chartType()')) return 1;
    for (const [k, v] of Object.entries(extra)) if (expr.includes(k)) return v;
    return undefined;
  };
  return { _deps: { evaluate, sleep: async () => {} }, calls };
}

describe('quote_get — B1.1 identity guard', () => {
  it('refuses a symbol that is not the active chart, and names both', async () => {
    const { _deps } = deps(NBIS_META);
    await assert.rejects(() => getQuote({ symbol: 'NASDAQ:AAPL', _deps }), (err) => {
      assert.match(err.message, /requested NASDAQ:AAPL/);
      assert.match(err.message, /active chart is BATS:NBIS/);
      assert.match(err.message, /Nebius Group/);
      assert.match(err.message, /chart_set_symbol/);
      return true;
    });
  });

  it('refuses a different ticker even without exchange prefix', async () => {
    const { _deps } = deps(NBIS_META);
    await assert.rejects(() => getQuote({ symbol: 'VRT', _deps }), /requested VRT/);
  });

  it('accepts the chart symbol under any of its spellings', async () => {
    for (const sym of ['NASDAQ:NBIS', 'BATS:NBIS', 'NBIS', 'nbis']) {
      const { _deps } = deps(NBIS_META);
      const q = await getQuote({ symbol: sym, _deps });
      assert.equal(q.success, true);
      assert.equal(q.symbol_requested, sym);
      assert.equal(q.symbol_resolved, 'BATS:NBIS');
      assert.equal(q.close, 236.12);
    }
  });

  it('refuses the same ticker on an incompatible listing (XETR vs NASDAQ)', async () => {
    const { _deps } = deps({ ...NBIS_META, symbol: 'XETR:SAP', pro_name: 'XETR_DLY:SAP', description: 'SAP SE', exchange: 'XETR' });
    await assert.rejects(() => getQuote({ symbol: 'NYSE:SAP', _deps }), /different listing/);
    const q = await getQuote({ symbol: 'XETR:SAP', _deps });
    assert.equal(q.symbol_resolved, 'XETR_DLY:SAP');
    assert.equal(q.feed, 'delayed_15m');
  });

  it('never echoes the request: `symbol` in the payload is the chart symbol', async () => {
    const { _deps } = deps(NBIS_META);
    const q = await getQuote({ symbol: 'nasdaq:nbis', _deps });
    assert.equal(q.symbol, 'BATS:NBIS');
    assert.equal(q.description, 'Nebius Group N.V. Class A');
    assert.equal(q.exchange, 'Cboe One');
  });

  it('quotes the chart as is when no symbol is given', async () => {
    const { _deps } = deps(NBIS_META);
    const q = await getQuote({ _deps });
    assert.equal(q.symbol_requested, null);
    assert.equal(q.symbol_resolved, 'BATS:NBIS');
  });
});

describe('quote_get / data_get_ohlcv — B1.2 currency', () => {
  it('every quote carries currency, native_currency, currency_converted and feed', async () => {
    const { _deps } = deps(NBIS_META);
    const q = await getQuote({ _deps });
    assert.equal(q.currency, 'USD');
    assert.equal(q.native_currency, 'USD');
    assert.equal(q.currency_converted, false);
    assert.equal(q.feed, 'delayed_15m');
    assert.equal(q.delay_s, 900);
  });

  it('refuses a currency-converted chart by default, with the fix in the message', async () => {
    const { _deps } = deps(NBIS_EUR_META);
    await assert.rejects(() => getQuote({ _deps }), (err) => {
      assert.match(err.message, /currency-converted \(USD → EUR\)/);
      assert.match(err.message, /allow_converted/);
      return true;
    });
    await assert.rejects(() => getOhlcv({ summary: true, _deps }), /currency-converted/);
  });

  it('returns converted numbers only when asked, and says so', async () => {
    const { _deps } = deps(NBIS_EUR_META);
    const q = await getQuote({ allow_converted: true, _deps });
    assert.equal(q.currency, 'EUR');
    assert.equal(q.native_currency, 'USD');
    assert.equal(q.currency_converted, true);
  });

  it('refuses a series without a declared currency', async () => {
    const { _deps } = deps(NO_CCY_META);
    await assert.rejects(() => getQuote({ _deps }), /declares no currency/);
    await assert.rejects(() => getOhlcv({ _deps }), /declares no currency/);
  });

  it('ohlcv (summary and full) states the chart symbol and currency', async () => {
    for (const summary of [true, false]) {
      const { _deps } = deps(NBIS_META);
      const r = await getOhlcv({ summary, count: 2, _deps });
      assert.equal(r.symbol, 'BATS:NBIS');
      assert.equal(r.currency, 'USD');
      assert.equal(r.currency_converted, false);
      assert.equal(r.bar_count, 2);
    }
  });

  it('chart_get_state exposes the currency fields', async () => {
    const { _deps } = deps(NBIS_EUR_META);
    const s = await getState({ _deps });
    assert.equal(s.symbol, 'NASDAQ:NBIS');
    assert.equal(s.currency, 'EUR');
    assert.equal(s.native_currency, 'USD');
    assert.equal(s.currency_converted, true);
  });
});

describe('symbolFacts / feed classification', () => {
  it('maps data_status and delay to the feed enum', () => {
    assert.equal(symbolFacts({ ...NBIS_META, data_status: 'streaming', delay: 0 }).feed, 'realtime');
    assert.equal(symbolFacts({ ...NBIS_META, data_status: 'streaming', delay: 900 }).feed, 'delayed_15m');
    assert.equal(symbolFacts({ ...NBIS_META, data_status: 'endofday', delay: 0 }).feed, 'eod');
    assert.equal(symbolFacts({ ...NBIS_META, data_status: null, delay: null, pro_name: 'XETR_DLY:SAP' }).feed, 'delayed_15m');
  });

  it('throws on missing metadata', () => {
    assert.throws(() => symbolFacts(null), /metadata unavailable/);
  });

  it('assertSymbolMatch / assertCurrency are the pure guards', () => {
    const facts = symbolFacts(NBIS_META);
    assert.deepEqual(assertSymbolMatch('', facts), { matched: null });
    assert.deepEqual(assertSymbolMatch('NBIS', facts), { matched: 'NBIS' });
    assert.throws(() => assertSymbolMatch('NASDAQ:AAPL', facts), /active chart is BATS:NBIS/);
    assert.doesNotThrow(() => assertCurrency(facts, false));
    assert.throws(() => assertCurrency(symbolFacts(NBIS_EUR_META), false), /currency-converted/);
    assert.doesNotThrow(() => assertCurrency(symbolFacts(NBIS_EUR_META), true));
  });
});

describe('chart.js — B1.3 evaluate resolution (was: "evaluate is not defined")', () => {
  it('symbol_info returns metadata incl. currency', async () => {
    const { _deps } = deps(NBIS_META);
    const info = await symbolInfo({ _deps });
    assert.equal(info.success, true);
    assert.equal(info.symbol, 'NASDAQ:NBIS');
    assert.equal(info.pro_name, 'BATS:NBIS');
    assert.equal(info.currency, 'USD');
    assert.equal(info.currency_converted, false);
    assert.equal(info.feed, 'delayed_15m');
    assert.equal(info.chart_type, 1);
  });

  it('chart_get_visible_range works through injected evaluate', async () => {
    const { _deps } = deps(NBIS_META);
    const r = await getVisibleRange({ _deps });
    assert.deepEqual(r.visible_range, { from: 1, to: 2 });
  });

  it('chart_scroll_to_date works through injected evaluate', async () => {
    const { _deps, calls } = deps(NBIS_META);
    const r = await scrollToDate({ date: '2026-09-22', _deps });
    assert.equal(r.success, true);
    assert.equal(r.resolution, 'D');
    assert.ok(calls.some(c => c.includes('zoomToBarsRange')));
  });

  it('chart_set_currency reports failure honestly when nothing changed', async () => {
    const { _deps } = deps(NBIS_EUR_META, { extra: { 'tried': { attempted: false, tried: [{ method: 'mainSeries.setCurrency', ok: false, error: 'no' }] } } });
    const r = await setCurrency({ currency: 'native', _deps });
    assert.equal(r.success, false);
    assert.match(r.hint, /by hand/);
  });

  it('chart_set_currency reports success only when symbol_info confirms', async () => {
    const { _deps } = deps(NBIS_META, { extra: { 'tried': { attempted: true, tried: [{ method: 'mainSeries.setCurrency', ok: true }] } } });
    const r = await setCurrency({ currency: 'native', _deps });
    assert.equal(r.success, true);
    assert.equal(r.currency_converted, false);
  });
});
