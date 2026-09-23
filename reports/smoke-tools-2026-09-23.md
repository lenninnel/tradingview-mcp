# TradingView bridge — tool smoke test 2026-09-23

Tools advertised: **84**. CDP reachable at http://localhost:9222/json/list. skipped: 48, ok: 33, error: 2, not run: 1.

Read-only tools were called with minimal arguments against the live chart; mutating tools were listed, not called.

| Tool | Class | Result | ms | Note |
|---|---|---|---:|---|
| `alert_create` | mutating | skipped |  | changes state |
| `alert_delete` | mutating | skipped |  | changes state |
| `alert_list` | read | ok | 657 | alert_count, source, alerts |
| `batch_run` | mutating | skipped |  | changes state |
| `capture_screenshot` | read | ok | 102 | method, file_path, region, size_bytes |
| `chart_get_state` | read | ok | 4 | symbol, resolution, chartType, studies, symbol_resolved, description · currency=USD |
| `chart_get_visible_range` | read | ok | 2 | visible_range, bars_range |
| `chart_manage_indicator` | mutating | skipped |  | changes state |
| `chart_scroll_to_date` | mutating | skipped |  | changes state |
| `chart_set_currency` | mutating | skipped |  | changes state |
| `chart_set_symbol` | mutating | skipped |  | changes state |
| `chart_set_timeframe` | mutating | skipped |  | changes state |
| `chart_set_type` | mutating | skipped |  | changes state |
| `chart_set_visible_range` | mutating | skipped |  | changes state |
| `data_get_equity` | read | ok | 1 | data_points, source, data |
| `data_get_indicator` | read | ok | 1 | entity_id, visible, inputs |
| `data_get_ohlcv` | read | ok | 1 | symbol, chart_symbol, description, exchange, listed_exchange, currency · currency=USD |
| `data_get_pine_boxes` | read | ok | 1 | study_count, studies |
| `data_get_pine_labels` | read | ok | 1 | study_count, studies |
| `data_get_pine_lines` | read | ok | 1 | study_count, studies |
| `data_get_pine_tables` | read | ok | 0 | study_count, studies |
| `data_get_strategy_results` | read | ok | 1 | metric_count, source, metrics |
| `data_get_study_values` | read | ok | 1 | study_count, studies |
| `data_get_trades` | read | ok | 1 | trade_count, source, trades, error |
| `depth_get` | read | error | 1 | DOM / Depth of Market panel not found. |
| `draw_clear` | mutating | skipped |  | changes state |
| `draw_get_properties` | read | not run |  | needs an entity id and the chart has none |
| `draw_list` | read | ok | 1 | count, shapes |
| `draw_remove_one` | mutating | skipped |  | changes state |
| `draw_shape` | mutating | skipped |  | changes state |
| `indicator_set_inputs` | mutating | skipped |  | changes state |
| `indicator_toggle_visibility` | mutating | skipped |  | changes state |
| `layout_list` | read | ok | 319 | layout_count, source, layouts |
| `layout_switch` | mutating | skipped |  | changes state |
| `pane_focus` | mutating | skipped |  | changes state |
| `pane_list` | read | ok | 3 | layout, layout_name, chart_count, active_index, panes |
| `pane_set_layout` | mutating | skipped |  | changes state |
| `pane_set_symbol` | mutating | skipped |  | changes state |
| `pine_analyze` | read | ok | 2 | issue_count, diagnostics, note |
| `pine_check` | read | ok | 761 | compiled, error_count, warning_count, note |
| `pine_compile` | mutating | skipped |  | changes state |
| `pine_get_console` | read | error | 10200 | Could not open Pine Editor. |
| `pine_get_errors` | read | ok | 1 | has_errors, error_count, errors |
| `pine_get_source` | read | ok | 1 | source, line_count, char_count |
| `pine_list_scripts` | read | ok | 201 | scripts, count, source |
| `pine_new` | mutating | skipped |  | changes state |
| `pine_open` | mutating | skipped |  | changes state |
| `pine_save` | mutating | skipped |  | changes state |
| `pine_set_source` | mutating | skipped |  | changes state |
| `pine_smart_compile` | mutating | skipped |  | changes state |
| `quote_get` | read | ok | 3 | symbol_requested, symbol_resolved, symbol, chart_symbol, description, exchange · currency=USD |
| `replay_autoplay` | mutating | skipped |  | changes state |
| `replay_start` | mutating | skipped |  | changes state |
| `replay_status` | read | ok | 1 | is_replay_available, is_replay_started, is_autoplay_started, replay_mode, current_date, autoplay_delay |
| `replay_step` | mutating | skipped |  | changes state |
| `replay_stop` | mutating | skipped |  | changes state |
| `replay_trade` | mutating | skipped |  | changes state |
| `symbol_info` | read | ok | 1 | symbol, full_name, pro_name, symbol_resolved, exchange, listed_exchange · currency=USD |
| `symbol_search` | read | ok | 479 | query, source, results, count |
| `tab_close` | mutating | skipped |  | changes state |
| `tab_list` | read | ok | 2 | tab_count, tabs |
| `tab_new` | mutating | skipped |  | changes state |
| `tab_switch` | mutating | skipped |  | changes state |
| `tv_discover` | read | ok | 1 | apis_available, apis_total, apis |
| `tv_health_check` | read | ok | 1 | cdp_connected, target_id, target_url, target_title, chart_symbol, chart_resolution |
| `tv_launch` | mutating | skipped |  | changes state |
| `tv_ui_state` | read | ok | 2 | bottom_panel, right_panel, pine_editor, strategy_tester, widgetbar, buttons |
| `ui_click` | mutating | skipped |  | changes state |
| `ui_evaluate` | mutating | skipped |  | changes state |
| `ui_find_element` | read | ok | 3 | query, strategy, count, elements |
| `ui_fullscreen` | mutating | skipped |  | changes state |
| `ui_hover` | mutating | skipped |  | changes state |
| `ui_keyboard` | mutating | skipped |  | changes state |
| `ui_mouse_click` | mutating | skipped |  | changes state |
| `ui_open_panel` | mutating | skipped |  | changes state |
| `ui_scroll` | mutating | skipped |  | changes state |
| `ui_type_text` | mutating | skipped |  | changes state |
| `watchlist_add` | mutating | skipped |  | changes state |
| `watchlist_append` | mutating | skipped |  | changes state |
| `watchlist_create` | mutating | skipped |  | changes state |
| `watchlist_delete` | mutating | skipped |  | changes state |
| `watchlist_get` | read | ok | 1 | count, source, symbols |
| `watchlist_list` | read | ok | 222 | count, source, lists |
| `watchlist_remove_symbols` | mutating | skipped |  | changes state |

Generated by `scripts/smoke_tools.js` at 2026-09-23T15:12:30.784Z.
