/**
 * Core chart control logic.
 */
import { evaluate as _evaluate, evaluateAsync as _evaluateAsync, safeString, requireFinite } from '../connection.js';
import { waitForChartReady as _waitForChartReady } from '../wait.js';
import { SYMBOL_META_JS, symbolFacts } from './symbol_meta.js';

const CHART_API = 'window.TradingViewApi._activeChartWidgetWV.value()';

function _resolve(deps) {
  return {
    evaluate: deps?.evaluate || _evaluate,
    evaluateAsync: deps?.evaluateAsync || _evaluateAsync,
    waitForChartReady: deps?.waitForChartReady || _waitForChartReady,
    sleep: deps?.sleep || ((ms) => new Promise(r => setTimeout(r, ms))),
  };
}

export async function getState({ _deps } = {}) {
  const { evaluate } = _resolve(_deps);
  const state = await evaluate(`
    (function() {
      var chart = ${CHART_API};
      var studies = [];
      try {
        var allStudies = chart.getAllStudies();
        studies = allStudies.map(function(s) {
          return { id: s.id, name: s.name || s.title || 'unknown' };
        });
      } catch(e) {}
      return {
        symbol: chart.symbol(),
        resolution: chart.resolution(),
        chartType: chart.chartType(),
        studies: studies,
      };
    })()
  `);
  // Currency and feed belong in the state (B1.2): a chart in account currency looks
  // exactly like a native one on a screenshot.
  let facts = null;
  try { facts = symbolFacts(await evaluate(SYMBOL_META_JS)); } catch { facts = null; }
  const header = facts ? {
    symbol_resolved: facts.symbol_resolved, description: facts.description, exchange: facts.exchange,
    currency: facts.currency, native_currency: facts.native_currency, currency_converted: facts.currency_converted,
    feed: facts.feed, delay_s: facts.delay_s,
  } : { currency: null, currency_converted: null, feed: null, currency_note: 'symbol metadata unavailable' };
  return { success: true, ...state, ...header };
}

export async function setSymbol({ symbol, _deps }) {
  const { evaluateAsync, waitForChartReady } = _resolve(_deps);
  await evaluateAsync(`
    (function() {
      var chart = ${CHART_API};
      return new Promise(function(resolve) {
        chart.setSymbol(${safeString(symbol)}, {});
        setTimeout(resolve, 500);
      });
    })()
  `);
  const ready = await waitForChartReady(symbol);
  return { success: true, symbol, chart_ready: ready };
}

export async function setTimeframe({ timeframe, _deps }) {
  const { evaluate, waitForChartReady } = _resolve(_deps);
  await evaluate(`
    (function() {
      var chart = ${CHART_API};
      chart.setResolution(${safeString(timeframe)}, {});
    })()
  `);
  const ready = await waitForChartReady(null, timeframe);
  return { success: true, timeframe, chart_ready: ready };
}

export async function setType({ chart_type, _deps }) {
  const { evaluate } = _resolve(_deps);
  const typeMap = {
    'Bars': 0, 'Candles': 1, 'Line': 2, 'Area': 3,
    'Renko': 4, 'Kagi': 5, 'PointAndFigure': 6, 'LineBreak': 7,
    'HeikinAshi': 8, 'HollowCandles': 9,
  };
  const typeNum = typeMap[chart_type] ?? Number(chart_type);
  if (isNaN(typeNum) || typeNum < 0 || typeNum > 9 || !Number.isInteger(typeNum)) {
    throw new Error(`Unknown chart type: ${chart_type}. Use a name (Candles, Line, etc.) or number (0-9).`);
  }
  await evaluate(`
    (function() {
      var chart = ${CHART_API};
      chart.setChartType(${typeNum});
    })()
  `);
  return { success: true, chart_type, type_num: typeNum };
}

export async function manageIndicator({ action, indicator, entity_id, inputs: inputsRaw, _deps }) {
  const { evaluate } = _resolve(_deps);
  const inputs = inputsRaw ? (typeof inputsRaw === 'string' ? JSON.parse(inputsRaw) : inputsRaw) : undefined;

  if (action === 'add') {
    const inputArr = inputs ? Object.entries(inputs).map(([k, v]) => ({ id: k, value: v })) : [];
    const before = await evaluate(`${CHART_API}.getAllStudies().map(function(s) { return s.id; })`);
    await evaluate(`
      (function() {
        var chart = ${CHART_API};
        chart.createStudy(${safeString(indicator)}, false, false, ${JSON.stringify(inputArr)});
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));
    const after = await evaluate(`${CHART_API}.getAllStudies().map(function(s) { return s.id; })`);
    const newIds = (after || []).filter(id => !(before || []).includes(id));
    return { success: newIds.length > 0, action: 'add', indicator, entity_id: newIds[0] || null, new_study_count: newIds.length };
  } else if (action === 'remove') {
    if (!entity_id) throw new Error('entity_id required for remove action. Use chart_get_state to find study IDs.');
    await evaluate(`
      (function() {
        var chart = ${CHART_API};
        chart.removeEntity(${safeString(entity_id)});
      })()
    `);
    return { success: true, action: 'remove', entity_id };
  } else {
    throw new Error('action must be "add" or "remove"');
  }
}

export async function getVisibleRange({ _deps } = {}) {
  const { evaluate } = _resolve(_deps);
  const result = await evaluate(`
    (function() {
      var chart = ${CHART_API};
      return { visible_range: chart.getVisibleRange(), bars_range: chart.getVisibleBarsRange() };
    })()
  `);
  return { success: true, visible_range: result?.visible_range, bars_range: result?.bars_range };
}

export async function setVisibleRange({ from, to, _deps }) {
  const { evaluate } = _resolve(_deps);
  const f = requireFinite(from, 'from');
  const t = requireFinite(to, 'to');
  await evaluate(`
    (function() {
      var chart = ${CHART_API};
      var m = chart._chartWidget.model();
      var ts = m.timeScale();
      var bars = m.mainSeries().bars();
      var startIdx = bars.firstIndex();
      var endIdx = bars.lastIndex();
      var fromIdx = startIdx, toIdx = endIdx;
      for (var i = startIdx; i <= endIdx; i++) {
        var v = bars.valueAt(i);
        if (v && v[0] >= ${f} && fromIdx === startIdx) fromIdx = i;
        if (v && v[0] <= ${t}) toIdx = i;
      }
      ts.zoomToBarsRange(fromIdx, toIdx);
    })()
  `);
  await new Promise(r => setTimeout(r, 500));
  const actual = await evaluate(`
    (function() {
      var chart = ${CHART_API};
      try { var r = chart.getVisibleRange(); return { from: r.from || 0, to: r.to || 0 }; }
      catch(e) { return { from: 0, to: 0, error: e.message }; }
    })()
  `);
  return { success: true, requested: { from, to }, actual: actual || { from: 0, to: 0 } };
}

export async function scrollToDate({ date, _deps }) {
  const { evaluate, sleep } = _resolve(_deps);
  let timestamp;
  if (/^\d+$/.test(date)) timestamp = Number(date);
  else timestamp = Math.floor(new Date(date).getTime() / 1000);
  if (isNaN(timestamp)) throw new Error(`Could not parse date: ${date}. Use ISO format (2024-01-15) or unix timestamp.`);

  const resolution = await evaluate(`${CHART_API}.resolution()`);
  let secsPerBar = 60;
  const res = String(resolution);
  if (res === 'D' || res === '1D') secsPerBar = 86400;
  else if (res === 'W' || res === '1W') secsPerBar = 604800;
  else if (res === 'M' || res === '1M') secsPerBar = 2592000;
  else { const mins = parseInt(res, 10); if (!isNaN(mins)) secsPerBar = mins * 60; }

  const halfWindow = 25 * secsPerBar;
  const from = timestamp - halfWindow;
  const to = timestamp + halfWindow;

  await evaluate(`
    (function() {
      var chart = ${CHART_API};
      var m = chart._chartWidget.model();
      var ts = m.timeScale();
      var bars = m.mainSeries().bars();
      var startIdx = bars.firstIndex();
      var endIdx = bars.lastIndex();
      var fromIdx = startIdx, toIdx = endIdx;
      for (var i = startIdx; i <= endIdx; i++) {
        var v = bars.valueAt(i);
        if (v && v[0] >= ${from} && fromIdx === startIdx) fromIdx = i;
        if (v && v[0] <= ${to}) toIdx = i;
      }
      ts.zoomToBarsRange(fromIdx, toIdx);
    })()
  `);
  await sleep(500);
  return { success: true, date, centered_on: timestamp, resolution, window: { from, to } };
}

/** Metadata of the active symbol, including the currency the series is priced in (B1.3). */
export async function symbolInfo({ _deps } = {}) {
  const { evaluate } = _resolve(_deps);
  const meta = await evaluate(SYMBOL_META_JS);
  const facts = symbolFacts(meta);
  let chartType = null;
  try { chartType = await evaluate(`${CHART_API}.chartType()`); } catch { chartType = null; }
  return {
    success: true,
    symbol: facts.chart_symbol,
    full_name: meta.full_name || null,
    pro_name: meta.pro_name || null,
    symbol_resolved: facts.symbol_resolved,
    exchange: facts.exchange,
    listed_exchange: facts.listed_exchange,
    description: facts.description,
    type: facts.type,
    typespecs: meta.typespecs || null,
    currency: facts.currency,
    native_currency: facts.native_currency,
    currency_converted: facts.currency_converted,
    currency_id: meta.currency_id || null,
    original_currency_id: meta.original_currency_id || null,
    feed: facts.feed,
    delay_s: facts.delay_s,
    data_status: facts.data_status,
    timezone: facts.timezone,
    session: facts.session,
    pricescale: meta.pricescale || null,
    resolution: facts.resolution,
    chart_type: chartType ?? null,
    meta_sources: facts.meta_sources,
  };
}

/**
 * Ask the chart to price the series in a given currency (null/"native" = the
 * symbol's own currency, which is what every data tool expects). The desktop app
 * exposes no documented API for this; each known path is tried and the result is
 * VERIFIED against symbolInfo afterwards — success is only reported when the chart
 * really changed.
 */
export async function setCurrency({ currency, _deps } = {}) {
  const { evaluate, sleep } = _resolve(_deps);
  const target = currency && !/^(native|default|null|none)$/i.test(String(currency)) ? String(currency).toUpperCase() : null;
  const attempt = await evaluate(`
    (function() {
      var api = ${CHART_API};
      var val = ${JSON.stringify(target)};
      var tried = [];
      var ms = null;
      try { ms = api._chartWidget.model().mainSeries(); } catch(e) { tried.push({ method: 'mainSeries', ok: false, error: e.message }); }
      function go(name, fn) { try { fn(); tried.push({ method: name, ok: true }); return true; } catch(e) { tried.push({ method: name, ok: false, error: e.message }); return false; } }
      var done = false;
      if (ms && typeof ms.setCurrency === 'function') done = go('mainSeries.setCurrency', function() { ms.setCurrency(val); });
      if (!done && typeof api.setCurrency === 'function') done = go('chart.setCurrency', function() { api.setCurrency(val); });
      if (!done && ms && typeof ms.properties === 'function') done = go('mainSeries.properties.currencyId', function() {
        var p = ms.properties().childs();
        if (!p || !p.currencyId || typeof p.currencyId.setValue !== 'function') throw new Error('no currencyId property');
        p.currencyId.setValue(val);
      });
      return { attempted: done, tried: tried };
    })()
  `);
  await sleep(800);
  const facts = symbolFacts(await evaluate(SYMBOL_META_JS));
  const ok = target ? facts.currency === target : !facts.currency_converted;
  return {
    success: ok,
    requested: target || 'native',
    currency: facts.currency,
    native_currency: facts.native_currency,
    currency_converted: facts.currency_converted,
    attempts: attempt?.tried || [],
    ...(ok ? {} : { hint: 'No known API path changed the series currency. Switch it by hand: chart settings → Symbol → Currency → default (native).' }),
  };
}

export async function symbolSearch({ query, type }) {
  // Use TradingView's public symbol search REST API (works without auth)
  const params = new URLSearchParams({
    text: query,
    hl: '1',
    exchange: '',
    lang: 'en',
    search_type: type || '',
    domain: 'production',
  });

  const resp = await fetch(`https://symbol-search.tradingview.com/symbol_search/v3/?${params}`, {
    headers: { 'Origin': 'https://www.tradingview.com', 'Referer': 'https://www.tradingview.com/' },
  });
  if (!resp.ok) throw new Error(`Symbol search API returned ${resp.status}`);
  const data = await resp.json();

  const strip = s => (s || '').replace(/<\/?em>/g, '');
  const results = (data.symbols || data || []).slice(0, 15).map(r => ({
    symbol: strip(r.symbol),
    description: strip(r.description),
    exchange: r.exchange || r.prefix || '',
    type: r.type || '',
    full_name: r.exchange ? `${r.exchange}:${strip(r.symbol)}` : strip(r.symbol),
  }));

  return { success: true, query, source: 'rest_api', results, count: results.length };
}
