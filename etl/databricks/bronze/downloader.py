"""
HDX Dataset Downloader — Downloads and caches humanitarian datasets from HDX.

Supports direct CSV download links from the Humanitarian Data Exchange.
Implements local caching with staleness checks to avoid unnecessary re-downloads.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path

import httpx
from loguru import logger

from etl.databricks.config import DatabricksConfig


@dataclass
class DatasetSource:
    """Defines a downloadable HDX dataset."""
    name: str           # Human-readable name
    filename: str       # Local filename to save as
    url: str            # Direct download URL
    description: str    # What this dataset contains


# =============================================================================
# All HDX Data Sources — Direct Download URLs
# =============================================================================

HDX_SOURCES: list[DatasetSource] = [
    DatasetSource(
        name="HNO 2026 (National)",
        filename="hpc_hno_2026.csv",
        url="https://data.humdata.org/dataset/8326ed53-8f3a-47f9-a2aa-83ab4ecee476/resource/edb91329-0e6b-4ebc-b6cb-051b2a11e536/download/hpc_hno_2026.csv",
        description="Standardised national 2026 Humanitarian Needs Overview data",
    ),
    DatasetSource(
        name="HNO 2025 (Subnational)",
        filename="hpc_hno_2025.csv",
        url="https://data.humdata.org/dataset/8326ed53-8f3a-47f9-a2aa-83ab4ecee476/resource/22093993-e23b-45c8-b84f-61e4a414ebbb/download/hpc_hno_2025.csv",
        description="Standardised subnational 2025 Humanitarian Needs Overview data",
    ),
    DatasetSource(
        name="FTS Global Requirements & Funding",
        filename="fts_requirements_funding_global.csv",
        url="https://data.humdata.org/dataset/b2bbb33c-2cfb-4809-8dd3-6bbdc080cbb9/resource/b3232da8-f1e4-41ab-9642-b22dae10a1d7/download/fts_requirements_funding_global.csv",
        description="FTS Annual Requirements and Funding Data globally",
    ),
    DatasetSource(
        name="FTS Cluster-Level Requirements & Funding",
        filename="fts_requirements_funding_cluster_global.csv",
        url="https://data.humdata.org/dataset/b2bbb33c-2cfb-4809-8dd3-6bbdc080cbb9/resource/80975d5b-508b-47b2-a10c-b967104d3179/download/fts_requirements_funding_cluster_global.csv",
        description="FTS Annual Requirements and Funding Data by Cluster globally",
    ),
    DatasetSource(
        name="Global COD-PS",
        filename="cod_population_admin1.csv",
        url="https://data.humdata.org/dataset/27e3d1c6-c57a-4159-85a4-adb6b7aca6b9/resource/3f7e17af-4ffa-455a-874c-6bf75e031730/download/cod_population_admin1.csv",
        description="Global common operational datasets for population (Admin 1,2,3,4)",
    ),
    DatasetSource(
        name="CBPF Allocations",
        filename="cbpf_allocations.csv",
        url="https://docs.google.com/spreadsheets/d/e/2PACX-1vRyEbNqi7QufuCwGCgbcdWCC3O7dFzwoZPm6tjUJ4RAI0ah12nTZLr5Gdaz-l44bTTOcIg9l2LP3GK_/pub?gid=1866794021&single=true&output=csv",
        description="CBPF Pooled Funds Data Hub allocations",
    ),
]

# INFORM Severity Index — hosted externally
# TODO: Clarify data points to collect from ACAPS API (https://api.acaps.org/api/v1/) with Jacek API KEY,
#       potentially replacing or supplementing this JRC Excel source.
INFORM_SOURCE = DatasetSource(
    name="INFORM Severity Index",
    filename="inform_severity.xlsx",
    url="https://drmkc.jrc.ec.europa.eu/inform-index/Portals/0/InfoRM/Severity/2025/202503_INFORM_Severity_-_March_2025.xlsx",
    description="INFORM crisis severity index scores (0-10 scale)",
)


class HDXDownloader:
    """Downloads and caches humanitarian datasets from HDX and other sources.

    Usage:
        config = DatabricksConfig()
        downloader = HDXDownloader(config)
        paths = downloader.download_all()
    """

    def __init__(self, config: DatabricksConfig) -> None:
        self.config = config
        self.raw_dir = config.raw_dir
        self._client = httpx.Client(
            timeout=120.0,
            follow_redirects=True,
            headers={
                "User-Agent": "LighthouseOS/1.0 (humanitarian-analytics; contact@lighthouse.os)"
            },
        )

    def is_stale(self, filepath: Path) -> bool:
        """Check if a cached file is older than the staleness threshold."""
        if not filepath.exists():
            return True
        age_hours = (time.time() - filepath.stat().st_mtime) / 3600
        return age_hours > self.config.stale_threshold_hours

    def download_file(self, source: DatasetSource, force: bool = False) -> Path:
        """Download a single dataset file, with caching.

        Args:
            source: Dataset source definition
            force: If True, re-download even if cached

        Returns:
            Path to the downloaded file
        """
        filepath = self.raw_dir / source.filename

        if not force and not self.is_stale(filepath):
            logger.info(f"  ✓ Cached (fresh): {source.name} → {filepath.name}")
            return filepath

        logger.info(f"  ↓ Downloading: {source.name}...")
        logger.debug(f"    URL: {source.url}")

        try:
            response = self._client.get(source.url)
            response.raise_for_status()

            filepath.write_bytes(response.content)
            size_mb = len(response.content) / (1024 * 1024)
            logger.info(f"  ✓ Downloaded: {source.name} ({size_mb:.1f} MB) → {filepath.name}")
            return filepath

        except httpx.HTTPStatusError as e:
            logger.error(f"  ✗ HTTP {e.response.status_code} downloading {source.name}: {e}")
            raise
        except httpx.RequestError as e:
            logger.error(f"  ✗ Network error downloading {source.name}: {e}")
            raise

    def download_all(self, force: bool = False) -> dict[str, Path]:
        """Download all HDX datasets.

        Args:
            force: If True, re-download all files regardless of cache

        Returns:
            Dict mapping dataset name to local file path
        """
        logger.info("=" * 60)
        logger.info("Downloading humanitarian datasets from HDX...")
        logger.info("=" * 60)

        paths: dict[str, Path] = {}

        for source in HDX_SOURCES:
            try:
                paths[source.name] = self.download_file(source, force=force)
            except Exception as e:
                logger.error(f"Failed to download {source.name}: {e}")
                # Continue with other downloads — don't fail the whole pipeline
                continue

        # Try INFORM (may fail if hosted externally)
        try:
            paths[INFORM_SOURCE.name] = self.download_file(INFORM_SOURCE, force=force)
        except Exception as e:
            logger.warning(
                f"INFORM download failed (external source, may be unavailable): {e}. "
                f"Pipeline will continue without INFORM severity data."
            )

        logger.info(f"Download complete: {len(paths)}/{len(HDX_SOURCES) + 1} datasets ready")
        return paths

    def close(self) -> None:
        """Close the HTTP client."""
        self._client.close()

    def __enter__(self) -> HDXDownloader:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()
