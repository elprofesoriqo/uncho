"""
Simulate router — Decision Impact Simulator and Gini-Optimized Auto-Allocation.
"""
import json
from fastapi import APIRouter, HTTPException

from backend.deps import ClientDep, ConfigDep
from backend.models import BatchSimulateRequest, OptimizeRequest, SimulateRequest
from tools.simulate_impact import simulate_impact_impl
from tools.optimize_allocation import optimize_allocation_impl

router = APIRouter(prefix="/api/simulate", tags=["Simulator"])


@router.post("")
async def simulate_funding_impact(body: SimulateRequest, client: ClientDep, config: ConfigDep):
    """
    Decision Impact Simulator — single scenario.
    Recalculates global rank, coverage change, people reached, and Gini equity shift
    if `additional_funding_usd` is added to `crisis_id`.
    """
    try:
        result = simulate_impact_impl(client, config, body.crisis_id, body.additional_funding_usd)
        data = json.loads(result)
        if "error" in data:
            raise HTTPException(status_code=404, detail=data["error"])
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch")
async def batch_simulate(body: BatchSimulateRequest, client: ClientDep, config: ConfigDep):
    """
    Batch Decision Impact Simulator — run up to 20 scenarios in one call.
    Useful for before/after comparisons across multiple allocation options.
    """
    results = []
    for scenario in body.scenarios:
        try:
            raw = simulate_impact_impl(client, config, scenario.crisis_id, scenario.additional_funding_usd)
            results.append(json.loads(raw))
        except Exception as e:
            results.append({"crisis_id": scenario.crisis_id, "error": str(e)})
    return {"status": "success", "results": results}


@router.post("/optimize")
async def optimize_allocation(body: OptimizeRequest, client: ClientDep, config: ConfigDep):
    """
    Gini-Optimized Auto-Allocation.
    Given a total budget, distributes it across all underfunded crises to
    mathematically minimize the Gini coefficient of global coverage ratios.
    Returns the optimal allocation plan with equity improvement metrics.
    """
    try:
        result = optimize_allocation_impl(client, config, body.total_budget_usd)
        data = json.loads(result)
        if "error" in data:
            raise HTTPException(status_code=500, detail=data["error"])
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
