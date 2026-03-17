#!/usr/bin/env python3

import json
import sys
from typing import Any

from notebooklm_mcp.server import notebook_list, notebook_query, refresh_auth


def emit(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def handle_request(message: dict[str, Any]) -> dict[str, Any]:
    request_id = message.get("id")
    action = message.get("action")
    payload = message.get("payload", {})

    try:
        if action == "refresh_auth":
            result = refresh_auth()
        elif action == "list_notebooks":
            result = notebook_list(max_results=payload.get("max_results", 100))
        elif action == "query_notebook":
            result = notebook_query(
                notebook_id=payload["notebook_id"],
                query=payload["query"],
                conversation_id=payload.get("conversation_id"),
            )
        else:
            result = {"status": "error", "error": f"Unsupported action: {action}"}
    except Exception as exc:
        result = {"status": "error", "error": str(exc)}

    return {"id": request_id, "result": result}


def main() -> int:
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        try:
            message = json.loads(line)
        except json.JSONDecodeError as exc:
            emit({"id": None, "result": {"status": "error", "error": f"Invalid JSON: {exc}"}})
            continue

        emit(handle_request(message))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
