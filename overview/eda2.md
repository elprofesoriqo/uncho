# Project Lighthouse OS: Data Governance & Context

## 1. Database Overview
* **Database Name:** `lighthouse_os`
* **Storage Format:** Delta Lake (for ACID compliance and Time Travel)
* **Primary Objective:** To compute the **Lighthouse Priority Score (LPS)** which identifies humanitarian "blind spots" by fusing scale, severity, neglect, and AI-driven urgency.

## 2. Table Schemas

### Table A: `bronze_hno_raw`
*Direct ingestion from `hpc_hno_2025.csv`.*
* **Key Columns:** `Country_ISO3`, `Cluster`, `In_Need`, `Targeted`, `Population`, `Description`.
* **Data Humility Note:** Contains a row of HXL tags (`#country+code`, etc.) that must be excluded from analytical queries.

### Table B: `gold_decision_metrics`
*The primary table for the Decision-Support App.*
| Column | Description | Data Source |
| :--- | :--- | :--- |
| `Severity_Index` | % of local population in need (Density of suffering). | Calculated |
| `Planning_Gap` | 1 - (Targeted/In_Need). Measures structural neglect. | Calculated |
| `Importance_Score` | `log10(In_Need)`. Normalized volume of the crisis. | Calculated |
| `Time_Criticality` | AI-weighted score based on ACAPS & Cluster type. | Vertex AI / ACAPS |
| `LPS_v2` | Final Priority Score (Severity * Gap * Importance * Urgency). | Calculated |

## 3. The "Small-Scale Urgency" Logic
To ensure a flooded city or local epidemic is not ignored, the database implements a non-linear scaling system:
1.  **Concentration Bonus:** If `Severity_Index` > 0.5 (more than half the population is affected), the priority is doubled.
2.  **Survival Window Multiplier:** High-urgency clusters (WASH, Health, Shelter) receive a 1.5x boost.
3.  **Scale Dampening:** We use `log10` for total counts so that 10 million people in a slow-onset crisis don't mathematically hide 50,000 people in a life-or-death flash crisis.



## 4. External Context: ACAPS Integration (`api.acaps.org`)
The AI Agent queries ACAPS for the following "Contextual Enrichment" before updating the `Time_Criticality` column:
* **Access Constraints:** Is aid physically unable to reach the area?
* **Conflict Intensity:** Is the crisis escalating rapidly?
* **Event Type:** Is this a "Sudden Onset" (Flash flood) or "Slow Onset" (Drought)?

## 5. EDA (Exploratory Data Analysis) Guidelines
Analysts and AI Agents should use the following queries to validate the "Lighthouse" signal:

1.  **Identify the "Forgotten":** Filter for `Planning_Gap > 0.8` and `Importance_Score < 3`. These are small crises with almost no planned aid.
2.  **Cluster Bias Check:** Aggregate `Planning_Gap` by `Cluster`. Historically, "Protection" and "Education" clusters show higher neglect than "Food Security."
3.  **Data Integrity Check:** Flag any record where `Population` is null or 0. This triggers the **Data Humility Protocol**, lowering the `Confidence_Score` of the resulting recommendation.



## 6. Target Users & Actionable Output
* **CERF Coordinators:** Use the `Lighthouse_Priority` to justify emergency allocations.
* **Donor Advisors:** Use the `Planning_Gap` to identify sectors that are traditionally underfunded despite high severity.
* **Field Analysts:** Use the AI-generated "Dossiers" to understand why a specific admin-zone has been flagged as a critical blind spot.

***
