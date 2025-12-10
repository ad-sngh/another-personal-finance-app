"""
Lightweight compatibility shim for the deprecated stdlib `cgi` module.

Python 3.13+ removed `cgi`, but some third-party tools (e.g., LiteLLM)
still import `parse_header`. We implement the minimal API they expect.
"""

from __future__ import annotations

from typing import Dict, Tuple


def parse_header(line: str) -> Tuple[str, Dict[str, str]]:
    """
    Parse a Content-Type style header into a main value and params.

    This mirrors `cgi.parse_header` from Python <=3.12 well enough for
    LiteLLM's usage.
    """
    if not line:
        return "", {}

    parts = [segment.strip() for segment in line.split(";")]
    main_value = parts[0].lower()
    params: Dict[str, str] = {}

    for segment in parts[1:]:
        if not segment:
            continue
        if "=" in segment:
            key, value = segment.split("=", 1)
            params[key.strip().lower()] = value.strip().strip('"')
        else:
            params[segment.lower()] = ""

    return main_value, params
