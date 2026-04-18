"""
Chat router — SSE streaming Conversational AI Co-Pilot backed by Claude + MCP tools.
"""
import asyncio
import json
import os

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from backend.deps import ClientDep, ConfigDep
from backend.models import ChatRequest

router = APIRouter(prefix="/api/chat", tags=["AI Co-Pilot"])

_TOOL_DEFINITIONS = [
    {
        "name": "query_crisis_rankings",
        "description": (
            "Query the ranked humanitarian crisis index with optional filters. "
            "Returns crises ordered by MismatchScore with full confidence metadata. "
            "Use this to answer questions about which crises are most overlooked, underfunded, or severe."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Max results (default 5)"},
                "region": {"type": "string", "description": "e.g. Africa, Middle East, Asia"},
                "sector": {"type": "string", "description": "e.g. Health, WASH, Food Security"},
                "max_coverage_ratio": {"type": "number", "description": "Filter to crises below this coverage (0.0-1.0)"},
                "year": {"type": "integer", "description": "Specific year filter"},
            },
        },
    },
    {
        "name": "simulate_funding_impact",
        "description": (
            "Simulate the real-time impact of adding a hypothetical funding amount to a specific crisis. "
            "Returns: new coverage ratio, new global rank, estimated people reached, global equity shift (Gini)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "crisis_id": {"type": "string", "description": "e.g. MOZ_2025_Total"},
                "additional_funding_usd": {"type": "number", "description": "Amount to add in USD"},
            },
            "required": ["crisis_id", "additional_funding_usd"],
        },
    },
    {
        "name": "check_data_health",
        "description": (
            "Returns data freshness, completeness, and confidence metadata for a country or globally. "
            "Use this to validate data quality before making a recommendation."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "iso3": {"type": "string", "description": "3-letter country code, or omit for global view"},
            },
        },
    },
    {
        "name": "get_crisis_detail",
        "description": (
            "Get the full detail record for a specific crisis including all scoring factors, "
            "sector breakdown hints, and Kumo predictions."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "crisis_id": {"type": "string", "description": "e.g. SYR_2026_Health"},
            },
            "required": ["crisis_id"],
        },
    },
]


def _execute_tool(tool_name: str, tool_input: dict, client, config) -> str:
    """Execute an MCP tool and return a JSON string result, truncated to fit Claude's context."""
    MAX_CHARS = 40_000  # ~10K tokens — enough for rankings/health without blowing the context window

    try:
        if tool_name == "query_crisis_rankings":
            from tools.query_rankings import query_rankings_impl
            result = query_rankings_impl(
                client, config,
                region=tool_input.get("region"),
                sector=tool_input.get("sector"),
                max_coverage_ratio=tool_input.get("max_coverage_ratio"),
                year=tool_input.get("year"),
                limit=tool_input.get("limit", 5),
            )
        elif tool_name == "simulate_funding_impact":
            from tools.simulate_impact import simulate_impact_impl
            result = simulate_impact_impl(client, config, tool_input["crisis_id"], tool_input["additional_funding_usd"])
        elif tool_name == "check_data_health":
            from tools.check_data_health import check_data_health_impl
            raw = check_data_health_impl(client, config, tool_input.get("iso3"))
            # Truncate the transparency matrix to avoid token overflow
            data = json.loads(raw)
            if "transparency_matrix" in data and len(data["transparency_matrix"]) > 20:
                data["transparency_matrix"] = data["transparency_matrix"][:20]
                data["transparency_matrix_truncated"] = True
            result = json.dumps(data)
        elif tool_name == "get_crisis_detail":
            table = config.gold_table("crisis_index")
            df = client.query(f"SELECT * FROM {table} WHERE crisis_id = '{tool_input['crisis_id']}'")
            result = json.dumps(df.fillna(0).to_dict(orient="records") if not df.empty else {})
        else:
            return json.dumps({"error": f"Unknown tool: {tool_name}"})

        # Hard cap on result size to prevent context overflow
        if len(result) > MAX_CHARS:
            result = result[:MAX_CHARS] + '... [truncated for context window]"}'
        return result

    except Exception as e:
        return json.dumps({"error": str(e)})


def _load_system_prompt() -> str:
    prompt_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "mcp", "prompts", "system_prompt.md"
    )
    try:
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return "You are the Lighthouse OS humanitarian intelligence agent."


@router.post("")
async def chat_copilot(body: ChatRequest, client: ClientDep, config: ConfigDep):
    """
    Server-Sent Events streaming endpoint for the AI Co-Pilot.
    Claude iterates through tool calls until it can form a complete response.
    Each SSE event has a `type` field: 'status' | 'message' | 'tool_call' | 'error' | 'done'.
    """
    messages = list(body.messages)
    if not any(m.get("role") == "user" for m in messages):
        messages.append({"role": "user", "content": body.message})

    async def event_generator():
        from anthropic import AsyncAnthropic

        anthropic_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        model = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20241022")
        system_prompt = _load_system_prompt()

        try:
            max_iterations = 6  # Safety cap: no infinite loops
            iteration = 0

            while iteration < max_iterations:
                iteration += 1
                response = await anthropic_client.messages.create(
                    model=model,
                    max_tokens=1500,
                    system=system_prompt,
                    messages=messages,
                    tools=_TOOL_DEFINITIONS,
                )

                tool_uses = [b for b in response.content if b.type == "tool_use"]

                if not tool_uses:
                    # Final text response
                    text = next((b.text for b in response.content if b.type == "text"), "")
                    words = text.split(" ")
                    for word in words:
                        yield {"data": json.dumps({"type": "message", "content": word + " "})}
                    break

                # Process each tool call
                tool_results = []
                for tool in tool_uses:
                    yield {"data": json.dumps({"type": "tool_call", "tool": tool.name, "input": tool.input})}
                    await asyncio.sleep(0.05)

                    result = _execute_tool(tool.name, tool.input, client, config)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool.id,
                        "content": result,
                    })

                yield {"data": json.dumps({"type": "status", "content": f"Processed {len(tool_uses)} tool(s), analyzing..."})}

                messages.append({"role": "assistant", "content": [t.model_dump() for t in tool_uses]})
                messages.append({"role": "user", "content": tool_results})

            yield {"data": json.dumps({"type": "done"})}

        except Exception as e:
            yield {"data": json.dumps({"type": "error", "content": str(e)})}
            yield {"data": json.dumps({"type": "done"})}

    return EventSourceResponse(event_generator())
