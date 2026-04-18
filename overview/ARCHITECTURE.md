# System Architecture and Data Flow

Lighthouse OS utilizes a multi-layered architecture, separating quantitative computation from qualitative AI enrichment and user interaction to ensure data integrity for decision-makers.

## 1. The Data Foundation (Databricks Engine)
* **Ingestion:** Continuous pipelines connected to HDX APIs, ingesting HNO, HRP, COD, and FTS data.
* **Processing (PySpark/SQL):** Cleans and normalizes population figures against funding allocations.
* **Advanced Gap Scoring Logic:** Computes the Mismatch Ratio using Objective Need, Available Capital (Disbursed Funding + Time-Discounted Pledges), and a Structural Multiplier (Penalty for chronic underfunding).

## 2. The Enrichment Layer (Google Vertex AI)
Official humanitarian data lags. This layer provides real-time horizon scanning to support rapid decision-making.
* **Unstructured Data Extraction:** Uses Vertex AI Multimodal models to parse PDF Rapid Needs Assessments from ReliefWeb, bridging the gap before official HNOs are published.
* **Visibility Scoring:** Analyzes global news sentiment to detect forgotten crises that lack media attention but possess high objective severity.

## 3. The Intelligence Layer (Claude and MCP)
* **MCP Integration:** Claude directly queries the Databricks SQL warehouse based on user natural language prompts. This allows non-technical coordinators to interact with complex databases.
* **Uncertainty Guardrails:** This layer enforces the platform's core value of Data Humility. The agent cites Data Confidence Scores. If HNO figures are outdated, the system explicitly warns the user, preventing coordinators from making decisions based on false precision.

## 4. The Presentation Layer (React/Next.js and D3)
A modular frontend hosting four visual modes and handling client-side state for the predictive simulation tools used by donor advisors.