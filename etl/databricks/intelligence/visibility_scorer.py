"""
Layer 5B: Media Visibility Scoring
Analyzes global news coverage to detect forgotten crises using open APIs.
A crisis with HIGH severity but LOW visibility is likely overlooked.
"""

import httpx
import os
from loguru import logger
import urllib.parse
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

class VisibilityScorer:
    """Detects 'forgotten crises' by analyzing media coverage volume."""
    
    def __init__(self):
        # In a full production environment, this would hit GDELT GKG or NewsAPI
        self.api_key = os.getenv("NEWS_API_KEY")
        
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError))
    )
    async def _fetch_from_api(self, query_url: str) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(query_url, headers={"X-Api-Key": self.api_key})
            if response.status_code in (426, 429):
                # Do not retry on 426 or 429 (rate limit / upgrade required), just fail fast
                raise ValueError(f"NewsAPI returned {response.status_code}. Rate limit exceeded or upgrade required.")
            response.raise_for_status()
            return response.json()

    async def score_crisis_visibility(self, crisis_id: str, country_name: str) -> float:
        """
        Calculate a visibility score (0.0 to 1.0) based on news mentions.
        1.0 = Dominating global news
        0.0 = Media blackout (forgotten crisis)
        """
        logger.debug(f"Calculating media visibility score for {country_name}...")
        
        if not self.api_key:
            logger.warning("No NEWS_API_KEY found. Falling back to default (0.5). "
                           "Register at newsapi.org for live visibility tracking.")
            return 0.5
            
        # URL encode the country name for query
        query = urllib.parse.quote(f"{country_name} AND (humanitarian OR crisis OR conflict)")
        query_url = f"https://newsapi.org/v2/everything?q={query}&sortBy=publishedAt&language=en"
        
        try:
            data = await self._fetch_from_api(query_url)
            total_results = data.get("totalResults", 0)
            
            # Normalization curve
            # E.g., > 1000 articles in the past month = 1.0 (Very visible)
            # 0 articles = 0.0 (Invisible)
            MAX_ARTICLES_BENCHMARK = 1000.0
            
            score = min(total_results / MAX_ARTICLES_BENCHMARK, 1.0)
            logger.debug(f"Visibility score for {country_name}: {score:.2f} ({total_results} articles)")
            return score
            
        except ValueError as e:
            logger.warning(f"NewsAPI Error for {country_name}: {e}")
            return 0.5 # Neutral fallback
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching visibility score for {country_name}: {e.response.status_code}")
            return 0.5 # Neutral fallback
        except Exception as e:
            logger.error(f"Failed to fetch visibility score for {country_name}: {e}")
            return 0.5 # Neutral fallback
