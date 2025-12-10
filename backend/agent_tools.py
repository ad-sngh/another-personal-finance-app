from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import List

from duckduckgo_search import DDGS
import yfinance as yf


@dataclass
class StockQuote:
    symbol: str
    current_price: float
    previous_close: float


@dataclass
class NewsArticle:
    title: str
    url: str
    source: str
    snippet: str
    published_at: str | None


def get_stock_price_info(symbol: str) -> StockQuote:
    """
    Fetch the current price and previous close for a ticker using yfinance.
    """
    ticker = yf.Ticker(symbol)
    info = ticker.fast_info
    current_price = float(info.get("last_price") or info.get("lastClose") or 0)
    previous_close = float(info.get("previous_close") or 0)
    return StockQuote(symbol=symbol.upper(), current_price=current_price, previous_close=previous_close)


def search_recent_news(query: str, max_results: int = 5) -> List[NewsArticle]:
    """
    Retrieve the latest news headlines for a ticker/keyword using DuckDuckGo.
    """
    articles: List[NewsArticle] = []
    with DDGS() as ddgs:
        for item in ddgs.news(keywords=query, region="us-en", max_results=max_results):
            published = item.get("date") or item.get("published")
            # DDG returns timestamps as strings or epoch; normalize to ISO string when possible
            if isinstance(published, (int, float)):
                published_at = datetime.fromtimestamp(published).isoformat()
            else:
                published_at = published

            articles.append(
                NewsArticle(
                    title=item.get("title", ""),
                    url=item.get("url", ""),
                    source=item.get("source", ""),
                    snippet=item.get("body", ""),
                    published_at=published_at,
                )
            )
            if len(articles) >= max_results:
                break

    return articles
