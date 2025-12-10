from __future__ import annotations

import json
import os
import re
from dataclasses import asdict
from typing import Any, Dict, List

import ollama

from agent_prompts import RESEARCH_AGENT_PROMPT, SUMMARIZER_AGENT_PROMPT
from agent_tools import get_stock_price_info, search_recent_news


def _normalize_host(value: str) -> str:
    if value.startswith(("http://", "https://")):
        return value.rstrip("/")
    return f"http://{value}".rstrip("/")


OLLAMA_HOST = _normalize_host(os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434"))
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b-it-qat")
OLLAMA_CLIENT = ollama.Client(host=OLLAMA_HOST)


def _chat_with_ollama(messages: List[Dict[str, str]], temperature: float = 0.2) -> str:
    response = OLLAMA_CLIENT.chat(
        model=OLLAMA_MODEL,
        messages=messages,
        options={
            "temperature": temperature,
        },
    )
    return response["message"]["content"]


def _extract_json_block(text: str) -> str:
    """
    Attempt to pull a JSON object from arbitrary model output.
    """
    text = text.strip()
    if text.startswith("{") and text.endswith("}"):
        return text

    # Look for the first {...} block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return match.group(0)
    return text


def run_research_agent(symbol: str) -> Dict[str, Any]:
    price_info = get_stock_price_info(symbol)
    news_items = search_recent_news(f"{symbol} stock news", max_results=6)

    context = {
        "price": asdict(price_info),
        "news": [asdict(article) for article in news_items],
    }

    user_payload = json.dumps(
        {
            "symbol": symbol.upper(),
            "context": context,
        },
        ensure_ascii=False,
        indent=2,
    )

    messages = [
        {"role": "system", "content": RESEARCH_AGENT_PROMPT.strip()},
        {
            "role": "user",
            "content": (
                "Use the structured context below to explain the price move. "
                "Return ONLY valid JSON.\n\n"
                f"{user_payload}"
            ),
        },
    ]

    raw_output = _chat_with_ollama(messages, temperature=0.1)
    parsed_output = _extract_json_block(raw_output)

    try:
        analysis = json.loads(parsed_output)
    except json.JSONDecodeError:
        analysis = {
            "symbol": symbol.upper(),
            "thesis": raw_output.strip(),
            "drivers": [],
            "confidence": "low - unstructured output",
            "sources": [],
            "risk_notes": "Parser fallback path",
        }

    return {"analysis": analysis, "raw": raw_output}


def run_summarizer_agent(packet: Dict[str, Any]) -> Dict[str, str]:
    payload = json.dumps(packet, ensure_ascii=False, indent=2)
    messages = [
        {"role": "system", "content": SUMMARIZER_AGENT_PROMPT.strip()},
        {"role": "user", "content": f"Input packet:\n{payload}"},
    ]
    summary_text = _chat_with_ollama(messages, temperature=0.4).strip()
    return {"summary": summary_text}


def run_insights_pipeline(symbol: str, current_price: float, previous_close: float) -> Dict[str, Any]:
    research_result = run_research_agent(symbol)
    analysis = research_result["analysis"]

    move_percent = 0.0
    if previous_close:
        move_percent = ((current_price - previous_close) / previous_close) * 100

    analysis_packet = {
        "symbol": symbol.upper(),
        "current_price": current_price,
        "previous_close": previous_close,
        "move_percent": move_percent,
        "research": analysis,
    }

    summary_result = run_summarizer_agent(analysis_packet)

    return {
        "analysis": analysis,
        "analysis_raw": research_result["raw"],
        "summary": summary_result["summary"],
    }
