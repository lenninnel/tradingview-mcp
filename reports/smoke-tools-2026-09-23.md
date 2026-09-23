# TradingView bridge — tool smoke test 2026-09-23

Tools advertised: **82**. CDP NOT reachable at http://localhost:9222/json/list. skipped: 46, not run: 36.

No TradingView with CDP was reachable, so this run is an inventory: nothing was called. Re-run on the Mac after `tvstart` for live results.

| Tool | Class | Result | ms | Note |
|---|---|---|---:|---|
| `alert_create` | mutating | skipped |  | changes state |
| `alert_delete` | mutating | skipped |  | changes state |
| `alert_list` | read | not run |  | CDP unreachable |
| `batch_run` | mutating | skipped |  | changes state |
| `capture_screenshot` | read | not run |  | CDP unreachable |
| `chart_get_state` | read | not run |  | CDP unreachable |
| `chart_get_visible_range` | read | not run |  | CDP unreachable |
| `chart_manage_indicator` | mutating | skipped |  | changes state |
| `chart_scroll_to_date` | mutating | skipped |  | changes state |
| `chart_set_currency` | mutating | skipped |  | changes state |
| `chart_set_symbol` | mutating | skipped |  | changes state |
| `chart_set_timeframe` | mutating | skipped |  | changes state |
| `chart_set_type` | mutating | skipped |  | changes state |
| `chart_set_visible_range` | mutating | skipped |  | changes state |
| `data_get_equity` | read | not run |  | CDP unreachable |
| `data_get_indicator` | read | not run |  | CDP unreachable |
| `data_get_ohlcv` | read | not run |  | CDP unreachable |
| `data_get_pine_boxes` | read | not run |  | CDP unreachable |
| `data_get_pine_labels` | read | not run |  | CDP unreachable |
| `data_get_pine_lines` | read | not run |  | CDP unreachable |
| `data_get_pine_tables` | read | not run |  | CDP unreachable |
| `data_get_strategy_results` | read | not run |  | CDP unreachable |
| `data_get_study_values` | read | not run |  | CDP unreachable |
| `data_get_trades` | read | not run |  | CDP unreachable |
| `depth_get` | read | not run |  | CDP unreachable |
| `draw_clear` | mutating | skipped |  | changes state |
| `draw_get_properties` | read | not run |  | CDP unreachable |
| `draw_list` | read | not run |  | CDP unreachable |
| `draw_remove_one` | mutating | skipped |  | changes state |
| `draw_shape` | mutating | skipped |  | changes state |
| `indicator_set_inputs` | mutating | skipped |  | changes state |
| `indicator_toggle_visibility` | mutating | skipped |  | changes state |
| `layout_list` | read | not run |  | CDP unreachable |
| `layout_switch` | mutating | skipped |  | changes state |
| `pane_focus` | mutating | skipped |  | changes state |
| `pane_list` | read | not run |  | CDP unreachable |
| `pane_set_layout` | mutating | skipped |  | changes state |
| `pane_set_symbol` | mutating | skipped |  | changes state |
| `pine_analyze` | read | not run |  | CDP unreachable |
| `pine_check` | read | not run |  | CDP unreachable |
| `pine_compile` | mutating | skipped |  | changes state |
| `pine_get_console` | read | not run |  | CDP unreachable |
| `pine_get_errors` | read | not run |  | CDP unreachable |
| `pine_get_source` | read | not run |  | CDP unreachable |
| `pine_list_scripts` | read | not run |  | CDP unreachable |
| `pine_new` | mutating | skipped |  | changes state |
| `pine_open` | mutating | skipped |  | changes state |
| `pine_save` | mutating | skipped |  | changes state |
| `pine_set_source` | mutating | skipped |  | changes state |
| `pine_smart_compile` | mutating | skipped |  | changes state |
| `quote_get` | read | not run |  | CDP unreachable |
| `replay_autoplay` | mutating | skipped |  | changes state |
| `replay_start` | mutating | skipped |  | changes state |
| `replay_status` | read | not run |  | CDP unreachable |
| `replay_step` | mutating | skipped |  | changes state |
| `replay_stop` | mutating | skipped |  | changes state |
| `replay_trade` | mutating | skipped |  | changes state |
| `symbol_info` | read | not run |  | CDP unreachable |
| `symbol_search` | read | not run |  | CDP unreachable |
| `tab_close` | mutating | skipped |  | changes state |
| `tab_list` | read | not run |  | CDP unreachable |
| `tab_new` | mutating | skipped |  | changes state |
| `tab_switch` | mutating | skipped |  | changes state |
| `tv_discover` | read | not run |  | CDP unreachable |
| `tv_health_check` | read | not run |  | CDP unreachable |
| `tv_launch` | mutating | skipped |  | changes state |
| `tv_ui_state` | read | not run |  | CDP unreachable |
| `ui_click` | mutating | skipped |  | changes state |
| `ui_evaluate` | mutating | skipped |  | changes state |
| `ui_find_element` | read | not run |  | CDP unreachable |
| `ui_fullscreen` | mutating | skipped |  | changes state |
| `ui_hover` | mutating | skipped |  | changes state |
| `ui_keyboard` | mutating | skipped |  | changes state |
| `ui_mouse_click` | mutating | skipped |  | changes state |
| `ui_open_panel` | mutating | skipped |  | changes state |
| `ui_scroll` | mutating | skipped |  | changes state |
| `ui_type_text` | mutating | skipped |  | changes state |
| `watchlist_add` | mutating | skipped |  | changes state |
| `watchlist_create` | mutating | skipped |  | changes state |
| `watchlist_delete` | mutating | skipped |  | changes state |
| `watchlist_get` | read | not run |  | CDP unreachable |
| `watchlist_list` | read | not run |  | CDP unreachable |

Generated by `scripts/smoke_tools.js` at 2026-09-23T10:24:32.217Z.
