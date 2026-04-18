"""
Layer 5A: Unstructured Document Extraction
Parses ReliefWeb PDF Rapid Needs Assessments into structured data using Claude.
"""

import os
import httpx
import base64
import json
from loguru import logger
from anthropic import AsyncAnthropic
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

class ReliefWebParser:
    """Parses ReliefWeb PDF Rapid Needs Assessments into structured data.
    Bridges the gap between a crisis emerging and the official HNO being published."""
    
    def __init__(self):
        self.client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        # Default to a standard model if the user's specific model string fails or isn't set
        self.model = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20241022")
        
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(httpx.RequestError)
    )
    async def fetch_pdf_base64(self, pdf_url: str) -> str:
        """Download a PDF and encode it in base64."""
        logger.info(f"Downloading PDF from {pdf_url}")
        async with httpx.AsyncClient(timeout=60.0) as http:
            response = await http.get(pdf_url)
            response.raise_for_status()
            return base64.b64encode(response.content).decode("utf-8")
            
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=4, max=20),
        retry=retry_if_exception_type(Exception)
    )
    async def parse_assessment(self, pdf_url: str) -> dict:
        """Send the PDF to Claude and ask it to extract structured humanitarian data."""
        try:
            pdf_data = await self.fetch_pdf_base64(pdf_url)
        except Exception as e:
            logger.error(f"Failed to download PDF: {e}")
            return {"error": str(e)}

        logger.info(f"Sending PDF to Claude model ({self.model}) for extraction...")
        
        try:
            message = await self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "document",
                                "source": {
                                    "type": "base64",
                                    "media_type": "application/pdf",
                                    "data": pdf_data
                                }
                            },
                            {
                                "type": "text",
                                "text": '''Extract the following fields from this humanitarian assessment:
                                - "country_region": string
                                - "date_of_assessment": string
                                - "estimated_people_in_need": number (total)
                                - "sectors_assessed": list of strings
                                - "recommended_funding_requirements_usd": number (if stated, otherwise null)
                                - "key_severity_indicators": list of strings
                                
                                Return ONLY a valid JSON object matching these keys. Do not include markdown code blocks around the JSON. If a field is not found, set it to null.'''
                            }
                        ]
                    }
                ]
            )
            
            # Parse the JSON response
            raw_text = message.content[0].text.strip()
            
            # Sometimes Claude still wraps in ```json ... ```
            if raw_text.startswith("```json"):
                raw_text = raw_text.split("```json")[1]
            if raw_text.endswith("```"):
                raw_text = raw_text.rsplit("```", 1)[0]
                
            data = json.loads(raw_text.strip())
            data["source_url"] = pdf_url
            
            logger.info("Successfully extracted structured data from PDF.")
            return data
            
        except Exception as e:
            logger.error(f"Claude extraction failed: {e}")
            return {"error": str(e)}
