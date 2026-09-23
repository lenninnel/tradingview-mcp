/**
 * Symbol metadata shared by quote_get, data_get_ohlcv, chart_get_state and symbol_info.
 *
 * Two data-integrity rules live here (see the desk spec of 2026-09-23, §B1):
 *
 *  B1.1  A quote tool must never answer for a different symbol than the one asked
 *        for. The chart's own metadata (pro_name / description / exchange) is the
 *        truth; the requested string is only compared against it, never echoed
 *        back as if it had been resolved.
 *  B1.2  Every price must carry the currency the series is actually in. TradingView
 *        can display a chart converted into the account currency; the main series'
 *        symbolInfo then reports currency_code (displayed) ≠ original_currency_code
 *        (native). Numbers read from such a chart are silently divided by the FX
 *        rate — so by default the tools refuse them.
 */
import { KNOWN_PATHS } from '../connection.js';

const CHART_API = KNOWN_PATHS.chartApi;

// In-page: collect everything the chart knows about the active symbol.
export const SYMBOL_META_JS = `
  (function() {
    var api = ${CHART_API};
    var out = { symbol: null, pro_name: null, full_name: null, description: null, exchange: null,
                listed_exchange: null, type: null, typespecs: null, currency_code: null,
                original_currency_code: null, currency_id: null, original_currency_id: null,
                data_status: null, delay: null, timezone: null, session: null, pricescale: null,
                resolution: null, meta_sources: [] };
    try { out.symbol = api.symbol(); } catch(e) {}
    try { out.resolution = api.resolution(); } catch(e) {}
    try {
      var ext = api.symbolExt() || {};
      out.pro_name = ext.pro_name || null;
      out.full_name = ext.full_name || null;
      out.description = ext.description || null;
      out.exchange = ext.exchange || null;
      out.type = ext.type || null;
      out.typespecs = ext.typespecs || null;
      if (ext.currency_code) out.currency_code = ext.currency_code;
      out.meta_sources.push('symbolExt');
    } catch(e) { out.symbol_ext_error = e.message; }
    try {
      var si = api._chartWidget.model().mainSeries().symbolInfo();
      if (si) {
        out.pro_name = out.pro_name || si.pro_name || null;
        out.full_name = out.full_name || si.full_name || null;
        out.description = out.description || si.description || null;
        out.exchange = out.exchange || si.exchange || null;
        out.listed_exchange = si.listed_exchange || null;
        out.type = out.type || si.type || null;
        out.typespecs = out.typespecs || si.typespecs || null;
        out.currency_code = si.currency_code || out.currency_code || null;
        out.original_currency_code = si.original_currency_code || null;
        out.currency_id = si.currency_id || null;
        out.original_currency_id = si.original_currency_id || null;
        out.data_status = si.data_status || null;
        out.delay = (typeof si.delay === 'number') ? si.delay : null;
        out.timezone = si.timezone || null;
        out.session = si.session || null;
        out.pricescale = si.pricescale || null;
        out.meta_sources.push('symbolInfo');
      }
    } catch(e) { out.symbol_info_error = e.message; }
    return out;
  })()
`;

/** Node side: turn the raw in-page object into the fields every price payload carries. */
export function symbolFacts(meta) {
  if (!meta || typeof meta !== 'object') {
    throw new Error('Symbol metadata unavailable — the chart may still be loading (symbolExt/symbolInfo returned nothing)');
  }
  const currency = meta.currency_code ? String(meta.currency_code).toUpperCase() : null;
  const native = meta.original_currency_code ? String(meta.original_currency_code).toUpperCase() : currency;
  const converted = !!(currency && native && currency !== native);
  const delay = typeof meta.delay === 'number' ? meta.delay : 0;
  let feed;
  if (meta.data_status === 'streaming' && !delay) feed = 'realtime';
  else if (delay) feed = `delayed_${Math.round(delay / 60)}m`;
  else if (meta.data_status === 'delayed_streaming') feed = 'delayed_15m';
  else if (meta.data_status === 'endofday') feed = 'eod';
  else if (/_DLY$/i.test(String(meta.pro_name || meta.symbol || '').split(':')[0])) feed = 'delayed_15m';
  else feed = meta.data_status || 'unknown';
  return {
    symbol_resolved: meta.pro_name || meta.full_name || meta.symbol || null,
    chart_symbol: meta.symbol || null,
    description: meta.description || null,
    exchange: meta.exchange || null,
    listed_exchange: meta.listed_exchange || null,
    type: meta.type || null,
    currency,
    native_currency: native,
    currency_converted: converted,
    feed,
    delay_s: delay,
    data_status: meta.data_status || null,
    timezone: meta.timezone || null,
    session: meta.session || null,
    resolution: meta.resolution || null,
    meta_sources: meta.meta_sources || [],
  };
}

// Exchange prefixes TradingView uses interchangeably for the same US listing on
// non-realtime plans (Cboe One feed stands in for the listing exchange).
const US_VENUE_ALIASES = new Set(['BATS', 'CBOE', 'CBOEONE', 'NASDAQ', 'NYSE', 'AMEX', 'ARCA', 'NYSEARCA']);

function splitSymbol(s) {
  const up = String(s || '').trim().toUpperCase();
  if (!up) return { exchange: null, ticker: '' };
  const i = up.indexOf(':');
  if (i === -1) return { exchange: null, ticker: up };
  return { exchange: up.slice(0, i).replace(/_DLY$/, '').replace(/\s+/g, ''), ticker: up.slice(i + 1) };
}

function exchangesCompatible(a, b) {
  if (!a || !b || a === b) return true;
  return US_VENUE_ALIASES.has(a) && US_VENUE_ALIASES.has(b);
}

/**
 * B1.1: refuse to answer when the requested symbol is not what the chart shows.
 * Ticker must match exactly; the exchange prefix must match or be a known alias.
 */
export function assertSymbolMatch(requested, facts, tool = 'quote_get') {
  if (!requested || !String(requested).trim()) return { matched: null };
  const want = splitSymbol(requested);
  const candidates = [facts.symbol_resolved, facts.chart_symbol].filter(Boolean).map(splitSymbol);
  const chartLabel = facts.symbol_resolved || facts.chart_symbol || 'unknown';
  const tickerHit = candidates.find(c => c.ticker === want.ticker);
  if (!tickerHit) {
    throw new Error(
      `${tool}: requested ${String(requested).trim()} but the active chart is ${chartLabel} ` +
      `(${facts.description || 'no description'}, ${facts.exchange || '?'}). This tool reads the active chart only — ` +
      `call chart_set_symbol("${String(requested).trim()}") first, or omit symbol to quote the chart as is.`);
  }
  if (want.exchange && !candidates.some(c => c.ticker === want.ticker && exchangesCompatible(want.exchange, c.exchange))) {
    throw new Error(
      `${tool}: requested ${String(requested).trim()} but the active chart is ${chartLabel} on ${facts.exchange || '?'} ` +
      `— same ticker, different listing (different venue/currency). call chart_set_symbol("${String(requested).trim()}") first.`);
  }
  return { matched: tickerHit.ticker };
}

/** B1.2: no currency → no numbers; converted chart → no numbers unless asked for explicitly. */
export function assertCurrency(facts, allowConverted, tool = 'quote_get') {
  if (!facts.currency) {
    throw new Error(
      `${tool}: the chart series declares no currency (symbolInfo.currency_code missing) — ` +
      `refusing to return prices without a currency`);
  }
  if (facts.currency_converted && !allowConverted) {
    throw new Error(
      `${tool}: the chart is currency-converted (${facts.native_currency} → ${facts.currency}); every price on it ` +
      `is divided by the ${facts.native_currency}${facts.currency} rate. Switch the chart back to its native currency ` +
      `(chart settings → Symbol → Currency → default, or chart_set_currency) or pass allow_converted=true to read ` +
      `the converted numbers knowingly.`);
  }
}
