# Stock Insights Agents Guide

This document tracks the agent design for the finance application. Keep it aligned with the Python modules under `backend/`.

## Mission
Provide dependable, explainable equity insights (price move + reason) that can be surfaced in the dashboard and downstream notifications.

## Runtime & Environment
- **Primary Model**: `gemma3:4b-it-qat` hosted via Ollama at `http://127.0.0.1:11434`.
- Set `OLLAMA_HOST`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, or `AGENT_MODEL` to override defaults.
- `OPENAI_BASE_URL`, `OPENAI_API_BASE`, and `OPENAI_API_KEY` are auto-populated so the `openai-agents` SDK speaks to the Ollama endpoint.
- All HTTP access must respect local firewall rules. Never log secrets.

## Code Locations
| File | Purpose |
| --- | --- |
| `backend/agent_tools.py` | Tool definitions exposed to agents (currently price lookups). |
| `backend/agent_prompts.py` | Prompt templates for research and summarizer agents. |
| `backend/agent_runner.py` | Agent construction, Ollama wiring, pipeline helper. |

## Shared Tools
| Tool | Description |
| --- | --- |
| `get_stock_price_info(symbol)` | Uses yfinance to fetch current price + previous close; mandatory first step for research agent. |
| `WebSearchTool()` | Comes from the `agents` SDK; used for live news/filing lookups. |

## Agent Roster

### 1. Equity Research & Analysis Agent
- **Goal**: Explain a 24h price move with cited evidence.
- **Prompt**: `RESEARCH_AGENT_PROMPT` (see `agent_prompts.py`).
- **Workflow**:
  1. Call `get_stock_price_info`.
  2. Use `WebSearchTool` for ≥2 reputable, recent sources.
  3. Distill ≤3 drivers (earnings, macro, regulatory, flows, sentiment, etc.).
  4. Flag uncertainties in `risk_notes`.
- **Output Contract**: JSON with keys `symbol`, `move_percent`, `thesis` (≤400 chars), `drivers[]`, `confidence`, `sources[]`, `risk_notes`.

### 2. Insight Summarizer Agent
- **Goal**: Convert structured research into a single SMS/dashboard blurb (≤160 chars).
- **Prompt**: `SUMMARIZER_AGENT_PROMPT`.
- **Input Packet**: `{ symbol, current_price, previous_close, move_percent, research: {…} }` where `research` matches the contract above.
- **Rules**:
  1. Begin with `"{SYMBOL} UP|DOWN {abs(move_percent):.2f}%: "`.
  2. Highlight the strongest driver or thesis detail plus a callout (risk or implication).
  3. Factual tone; no emojis/hashtags.
  4. Attribute using first-source domain when space allows (e.g., `via WSJ`).
  5. Hard cap 160 characters.

## Control Flow (planned)
1. Scheduler detects a tracked holding with `track_insights = TRUE` whose move exceeds threshold.
2. Backend calls `run_insights_pipeline(symbol, current_price, previous_close)` from `agent_runner.py`.
3. Research agent investigates; summarizer produces SMS/dashboard line.
4. Result is stored in `insights_current` table and surfaced in the React UI.

## Operational Discipline
- Log each agent invocation with ticker, timestamps, and confidence levels.
- If parsing fails, downgrade confidence and note fallback path rather than aborting.
- Consider caching search results briefly to avoid hammering sources when multiple holdings move simultaneously.
- Add regression tests before altering prompt structure or output schema.
