"""
Shared FastAPI dependencies: database client, caching, config.
"""
import os
import sys
from functools import lru_cache
from typing import Annotated

from cachetools import TTLCache
from fastapi import Depends

# Ensure mcp/tools are importable from backend context
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mcp"))

from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig


@lru_cache(maxsize=1)
def get_config() -> DatabricksConfig:
    return DatabricksConfig()


@lru_cache(maxsize=1)
def get_db_client() -> DatabricksClient:
    config = get_config()
    return DatabricksClient(config)


# TTL caches — one per use-case so we can tune TTL independently
# Data is updated daily, so 60–300 seconds is safe.
_rankings_cache: TTLCache = TTLCache(maxsize=200, ttl=60)
_geo_cache: TTLCache = TTLCache(maxsize=50, ttl=120)
_crisis_cache: TTLCache = TTLCache(maxsize=500, ttl=120)
_health_cache: TTLCache = TTLCache(maxsize=20, ttl=300)


def get_rankings_cache() -> TTLCache:
    return _rankings_cache


def get_geo_cache() -> TTLCache:
    return _geo_cache


def get_crisis_cache() -> TTLCache:
    return _crisis_cache


def get_health_cache() -> TTLCache:
    return _health_cache


# Convenience annotated types for route signatures
ConfigDep = Annotated[DatabricksConfig, Depends(get_config)]
ClientDep = Annotated[DatabricksClient, Depends(get_db_client)]
