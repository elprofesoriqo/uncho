import json
import asyncio
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from cachetools import TTLCache, cached

# Import our Databricks logic directly into the web server
from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig
import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mcp"))

from tools.simulate_impact import simulate_impact_impl
from tools.generate_dossier import generate_dossier_impl
from tools.optimize_allocation import optimize_allocation_impl

app = FastAPI(
    title="Lighthouse OS Backend",
    description="Advanced Intelligence API connecting Databricks Gold Layer, Kumo.AI, and Claude MCP to the Next.js Frontend.",
    version="2.0.0" # Major version bump for advanced features
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the Vercel Next.js URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Databricks connection pooling
config = DatabricksConfig()
client = DatabricksClient(config)

# In-memory caching for massive performance boost
# Cache up to 100 queries for 60 seconds (since data updates daily, this is safe and fast)
query_cache = TTLCache(maxsize=100, ttl=60)

# -------------------------------------------------------------------------
# Core Endpoints - Defined by our frontend_api_contract.md
# -------------------------------------------------------------------------

@app.get("/api/rankings")
@cached(cache=query_cache)
async def get_rankings(
    region: str = None, 
    min_people_in_need: int = None, 
    max_coverage_ratio: float = None,
    limit: int = 20
):
    """
    Fetches the deeply scored Crisis Universe from the Databricks Gold Layer.
    Includes Bayesian Uncertainty Bounds and Efficiency Discounts.
    """
    try:
        table_name = config.gold_table('crisis_index')
        query = f"SELECT * FROM {table_name} WHERE is_in_scope = True"
        
        # Apply strict filters dynamically
        if region:
            query += f" AND region = '{region}'"
        if min_people_in_need:
            query += f" AND CAST(people_in_need AS DOUBLE) >= {min_people_in_need}"
        if max_coverage_ratio is not None:
            query += f" AND CAST(coverage_ratio AS DOUBLE) <= {max_coverage_ratio}"
            
        # Sort conservatively by the lower bound to guarantee defensibility
        query += f" ORDER BY CAST(mismatch_score_lower_bound AS DOUBLE) DESC LIMIT {limit}"
        
        df = client.query(query)
        if df.empty:
            return {"status": "success", "crises": []}
            
        # Clean up Pandas NaN to standard None for JSON serialization
        df = df.fillna(0)
        return {"status": "success", "crises": df.to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/geo/map-data")
async def get_map_data(mode: str = "CHOROPLETH_COVERAGE"):
    """
    Returns specific GeoJSON or map layers for Deck.gl/Mapbox visualization.
    Modes: CHOROPLETH_COVERAGE, HEATMAP_SEVERITY, FLOW_DONORS, PREDICTIVE_RISK
    """
    # This endpoint translates the Gold Layer into spatial coordinates.
    try:
        df = client.query(f"SELECT iso3, country, region, coverage_ratio, mismatch_score, inform_severity, crisis_type FROM {config.gold_table('crisis_index')}")
        return {"status": "success", "mode": mode, "data": df.fillna(0).to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/simulate")
async def simulate_funding_impact(request: Request):
    """
    The Decision Impact Simulator.
    Recalculates the global Gini equity coefficient if $X is added to a crisis.
    Uses the exact MCP tool logic to ensure consistency between Claude and UI.
    """
    data = await request.json()
    crisis_id = data.get("crisis_id")
    additional_funding_usd = data.get("additional_funding_usd")
    
    if not crisis_id or additional_funding_usd is None:
        raise HTTPException(status_code=400, detail="Missing required parameters")
        
    try:
        # Execute the advanced simulation logic directly
        result_json = simulate_impact_impl(client, config, crisis_id, float(additional_funding_usd))
        return json.loads(result_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/optimize-allocation")
async def optimize_allocation(request: Request):
    """
    Component 3 (Advanced Mode): Gini-Optimized Target Auto-Solver.
    User inputs a total budget, and the AI mathematically optimally distributes
    it across all crises to achieve perfect global equity.
    """
    data = await request.json()
    total_budget_usd = data.get("total_budget_usd")
    
    if total_budget_usd is None:
        raise HTTPException(status_code=400, detail="Missing required parameter: total_budget_usd")
        
    try:
        result_json = optimize_allocation_impl(client, config, float(total_budget_usd))
        return json.loads(result_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/intelligence/news-feed")
async def get_news_feed(crisis_id: str):
    """
    Component 8: Narrative Dashboard
    Returns visibility scores, latest parsed ReliefWeb assessments, and human-centric metrics.
    """
    try:
        # Example logic integrating Layer 5 Horizon Scanning
        table_name = config.gold_table('crisis_index')
        df = client.query(f"SELECT country, visibility_penalty FROM {table_name} WHERE crisis_id = '{crisis_id}'")
        if df.empty:
            return {"error": "Crisis not found"}
            
        country = df.iloc[0]['country']
        visibility = df.iloc[0]['visibility_penalty']
        
        assessment_data = None
        bronze_table = config.bronze_table("reliefweb_parsed_raw")
        if client.table_exists(bronze_table):
            # Query the real parsed data if available
            rel_df = client.query(f"SELECT * FROM {bronze_table} WHERE country_region LIKE '%{country}%' LIMIT 1")
            if not rel_df.empty:
                row = rel_df.iloc[0]
                assessment_data = {
                    "source": row.get("source_url", "ReliefWeb"),
                    "extracted_needs": str(row.get("key_severity_indicators", "")),
                    "date": row.get("date_of_assessment", "")
                }
        
        return {
            "status": "success",
            "crisis_id": crisis_id,
            "human_narrative_metric": f"Media visibility penalty is {visibility:.2f}x.",
            "latest_assessment": assessment_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dossier")
async def generate_dossier(crisis_id: str):
    """
    Fetches the deep analytical view: Donor Concentration (HHI),
    Kumo.AI Predictions, and raw Bronze data to generate a CERF Dossier.
    """
    try:
        result_json = generate_dossier_impl(client, config, crisis_id)
        return json.loads(result_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/data-health")
async def get_data_health(iso3: str = None):
    """
    Component 5: Data Health & Transparency Matrix
    Instantly shows which countries have active needs but no HRP, outdated HNOs, or missing sector data.
    """
    from tools.check_data_health import check_data_health_impl
    try:
        result_json = check_data_health_impl(client, config, iso3)
        return json.loads(result_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/structural-timeline")
async def get_structural_timeline(iso3: str, sector: str):
    """
    Component 4: Multi-Year Structural Timeline
    Returns 5-year historical funding/requirements trend plus Kumo.AI 6-month projection.
    """
    try:
        # Fetch historical data from the Gold Layer
        table_name = config.gold_table('crisis_index')
        query = f"SELECT year, requirements_usd, funding_usd, coverage_ratio FROM {table_name} WHERE iso3 = '{iso3}' AND sector = '{sector}' ORDER BY year ASC"
        df = client.query(query)
        
        # Fetch Kumo projection for this crisis_id
        crisis_id = f"{iso3}_{df['year'].max() if not df.empty else '2025'}_{sector}"
        from tools.query_kumo_predictions import query_kumo_predictions_impl
        preds_json = query_kumo_predictions_impl(client, config, crisis_id)
        predictions = json.loads(preds_json)
        
        return {
            "status": "success",
            "crisis_id": crisis_id,
            "historical_trend": df.fillna(0).to_dict(orient="records"),
            "projection": predictions.get("gap_projection", {})
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------------------
# SSE Endpoint - Conversational AI Co-Pilot
# -------------------------------------------------------------------------

from anthropic import AsyncAnthropic

@app.post("/api/chat")
async def chat_copilot(request: Request):
    """
    Server-Sent Events endpoint for real-time Claude streaming and UI control.
    """
    data = await request.json()
    user_message = data.get("message")
    
    # Simple state handling
    messages = data.get("messages", [])
    if not any(m.get("role") == "user" for m in messages):
        messages.append({"role": "user", "content": user_message})
        
    async def event_generator():
        client_anthropic = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        model = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20241022")
        
        system_prompt_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mcp", "prompts", "system_prompt.md")
        try:
            with open(system_prompt_path, "r", encoding="utf-8") as f:
                system_prompt = f.read()
        except:
            system_prompt = "You are the Lighthouse OS humanitarian intelligence agent."
            
        tools = [
            {
                "name": "query_crisis_rankings",
                "description": "Query the ranked crisis index with optional filters. Returns crises ordered by MismatchScore with confidence scores.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "limit": {"type": "integer", "description": "Number of results to return (default 10)"},
                        "region": {"type": "string", "description": "Filter by region (e.g., Africa)"}
                    }
                }
            },
            {
                "name": "simulate_funding_impact",
                "description": "Simulate the impact of a hypothetical funding allocation.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "crisis_id": {"type": "string"},
                        "additional_funding_usd": {"type": "number"}
                    },
                    "required": ["crisis_id", "additional_funding_usd"]
                }
            },
            {
                "name": "check_data_health",
                "description": "Returns data freshness, completeness, and quality metrics for a given country or globally.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "iso3": {"type": "string", "description": "3-letter country code"}
                    }
                }
            }
        ]
        
        try:
            # We will use a loop to handle potential multiple tool calls
            while True:
                response = await client_anthropic.messages.create(
                    model=model,
                    max_tokens=1024,
                    system=system_prompt,
                    messages=messages,
                    tools=tools
                )
                
                tool_uses = [block for block in response.content if block.type == 'tool_use']
                
                if tool_uses:
                    tool = tool_uses[0]
                    yield {"data": json.dumps({"type": "status", "content": f"Using tool {tool.name}..."})}
                    await asyncio.sleep(0.1)
                    
                    # Execute tool locally in backend
                    tool_result = ""
                    try:
                        if tool.name == "query_crisis_rankings":
                            from tools.query_rankings import query_rankings_impl
                            res = query_rankings_impl(client, config, limit=tool.input.get("limit", 5), region=tool.input.get("region"))
                            tool_result = res
                        elif tool.name == "simulate_funding_impact":
                            res = simulate_impact_impl(client, config, tool.input["crisis_id"], tool.input["additional_funding_usd"])
                            tool_result = res
                        elif tool.name == "check_data_health":
                            from tools.check_data_health import check_data_health_impl
                            res = check_data_health_impl(client, config, tool.input.get("iso3"))
                            tool_result = res
                        else:
                            tool_result = f"Unknown tool {tool.name}"
                    except Exception as e:
                        tool_result = str(e)
                        
                    messages.append({"role": "assistant", "content": [tool.model_dump()]})
                    messages.append({
                        "role": "user", 
                        "content": [{"type": "tool_result", "tool_use_id": tool.id, "content": tool_result}]
                    })
                    
                    yield {"data": json.dumps({"type": "status", "content": "Analyzing results..."})}
                    # Loop continues, Claude will be called again with the tool result
                else:
                    # No more tool uses, we can break and stream the final response
                    # Actually, the response object already has the final text if there were no tools!
                    # But we want to stream the final response. So let's re-run with stream=True for the final text.
                    # Wait, if we just ran it without stream=True and got text, we can just yield it.
                    text = next((block.text for block in response.content if block.type == "text"), "")
                    for chunk in text.split(" "):
                        yield {"data": json.dumps({"type": "message", "content": chunk + " "})}
                    break
                    
            yield {"data": json.dumps({"type": "done"})}
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield {"data": json.dumps({"type": "error", "content": f"Chat Error: {str(e)}"})}
            yield {"data": json.dumps({"type": "done"})}

    return EventSourceResponse(event_generator())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)