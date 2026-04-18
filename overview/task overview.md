Geo-Insight: Which Crises Are Most Overlooked?
Overview
In this challenge, you will build a system that surfaces mismatches between humanitarian need and humanitarian financing coverage across active crises worldwide.

Your task is to take a crisis context, a geographic scope, or a natural-language query and return the situations that are most underserved, ranked by the gap between actual need and available funding.

This challenge is based on a real analytical problem inside the humanitarian data ecosystem. Humanitarian coordinators and donor advisors need to quickly identify where funds are not reaching, relative to the scale of a crisis.

The Problem
Humanitarian data mixes two very different kinds of signals:

Objective severity indicators that describe the scale and urgency of a crisis.
Funding and coverage data that describes what has actually been resourced.
Example questions a decision-maker might ask:

"Which crises have the highest proportion of people in need but the lowest fund allocations?"
"Are there countries with active HRPs where funding is absent or negligible?"
"Which regions are consistently underfunded relative to need across multiple years?"
"Show me acute food insecurity hotspots that have received less than 10% of their requested funding."
In all four examples, some signals are objective thresholds and some are relative or contextual judgments. Your system should separate these layers and combine them effectively.

Core Task
Given a query or geographic scope:

Identify relevant crises or countries using severity and needs data.
Filter to situations meeting a meaningful threshold of documented need.
Interpret funding coverage data to compute a gap or mismatch score.
Rank the crises by how overlooked they appear, relative to need.
Your result should ideally support:

A ranked list of crises or countries with a gap score or coverage ratio.
Map-ready outputs using country or crisis coordinates where available.
A short explanation of why the top results rank as most overlooked.
Assume you only have publicly available datasets and the current query or scope provided.

Bonus Task
Use temporal or cross-source signals to improve ranking and identify structural neglect rather than just point-in-time gaps.

Examples of additional signals:

Multi-year funding trends for the same crisis.
HRP target vs. actual coverage over time.
Whether a crisis appears in global media or advocacy reporting.
Population displacement or IDP figures as a need multiplier.
Sector-level gaps within a crisis (e.g., health vs. food vs. shelter).
Donor concentration, where a crisis relies on one or two major donors.
Bonus question: How should ranking change when a crisis has been underfunded for multiple consecutive years versus one that is newly underfunded? How can you represent structural issues differently from acute emergencies?

Directions You Can Explore
You are free to choose different solution styles as long as the core task is addressed and the final outcome is strong.

Possible directions include:

A gap-scoring pipeline using HNO and funding data only.
A retrieval system over crisis summaries and metadata.
An LLM-assisted query understanding layer that maps natural-language questions to filter criteria.
A hybrid approach combining structured funding ratios with semantic scoring over crisis descriptions.
Geospatial analysis using country centroids or crisis coordinates.
Enrichment using external data such as ACLED conflict events, IPC food security phases, or UNHCR displacement figures.
Time-series analysis of funding trends per crisis.
A lightweight visualization or dashboard.
A conversational interface where a user can refine scope across multiple turns.
Everything that helps answer the core question of where need outpaces coverage is encouraged.

Note: The core judging focus is the quality and defensibility of the gap ranking and the breadth of crisis types and queries your system can handle well.

Data Provided
You are provided with links to the following publicly available datasets as a starting point:

Humanitarian Needs Overview data (includes people in need figures by country and sector): https://data.humdata.org/dataset/global-hpc-hno
Humanitarian Response Plan data (includes funding targets and plan status): https://data.humdata.org/dataset/humanitarian-response-plans
Global common operational datasets for population: https://data.humdata.org/dataset/cod-ps-global
Global requirements and funding data (includes overall financial tracking): https://data.humdata.org/dataset/global-requirements-and-funding-data
CBPF Pooled Funds Data Hub (includes country-based pooled fund allocations and visualizations): https://cbpf.data.unocha.org/
You are encouraged to supplement these with additional public sources where it improves your analysis. Declare any external data sources you use.

What You Need to Build
You are free to choose the format of your solution, as long as it clearly solves the problem.

Examples:

A gap analysis and ranking pipeline
An API or service that accepts a query and returns ranked crises
A notebook-based prototype
An interactive dashboard or map
A conversational interface
The primary focus is analytical quality and ranking defensibility, not frontend polish.

Expected Output
Your system should return crises or countries that:

Meet a meaningful threshold of documented humanitarian need.
Are ordered by the size or severity of the mismatch between need and funding coverage.
Outputs should at least include:

A ranked list of crises or countries with a gap score or coverage ratio.
It may also include:

The filters or thresholds applied to define in-scope crises.
The scoring logic at a high level.
Brief explanations for why the top-ranked crises appear most overlooked.
Solution Ideas
