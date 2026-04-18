```
bronze.hno_raw          — WIP ZUZA
bronze.hrp_raw          — DROPPED, bc useless, since there is no useful data compared to fts_requirements
bronze.fts_requirements   — https://data.humdata.org/dataset/b2bbb33c-2cfb-4809-8dd3-6bbdc080cbb9/resource/b3232da8-f1e4-41ab-9642-b22dae10a1d7/download/fts_requirements_funding_global.csv
bronze.fts_global_raw   — https://data.humdata.org/dataset/b2bbb33c-2cfb-4809-8dd3-6bbdc080cbb9/resource/b3232da8-f1e4-41ab-9642-b22dae10a1d7/download/fts_requirements_funding_global.csv
FUNDING BY HUMANITARIAN RESPONSE PLAN
bronze.fts_cluster_raw  — https://data.humdata.org/dataset/b2bbb33c-2cfb-4809-8dd3-6bbdc080cbb9/resource/80975d5b-508b-47b2-a10c-b967104d3179/download/fts_requirements_funding_cluster_global.csv
REQUIRED DATA CLEANING (drop/recalculate percentFunded column)
bronze.cod_population   — https://data.humdata.org/dataset/cod-ps-global
ADMIN1,2,3,4 -> ADMINISTRATIVE LEVELS IN 
bronze.cbpf_allocations — https://docs.google.com/spreadsheets/d/e/2PACX-1vRyEbNqi7QufuCwGCgbcdWCC3O7dFzwoZPm6tjUJ4RAI0ah12nTZLr5Gdaz-l44bTTOcIg9l2LP3GK_/pub?gid=1866794021&single=true&output=csv
REQUIRED DATA CLEANING (Country name to ISO3, drop(['PaidAmtLocal', 'PledgeAmtLocal', 'PaidAmtCurrencyExchangeRate', 'PaidAmtLocalCurrency', 'PledgeAmtCurrencyExchangeRate', 'PledgeAmtLocalCurrency', 'ExpectedDate'], axis=1, inplace=True), rename(columns={'PledgeAmt': 'PledgeAmtUSD', 'PaidAmt': 'PaidAmtUSD'}))
bronze.inform_severity  — https://api.acaps.org/api/v1/
DOPRECYZOWAC JAKIE DANE ZEBRAC, JACEK MA API KEY
bronze.acled_events     — https://acleddata.com/platform/explorer
bronze.ipc_phases       — inaccessible without API keys
bronze.reliefweb_parsed — https://apidoc.reliefweb.int/endpoints
MCP AGENT ENRICHMENT LAYER, JACEK HAS API KEY
bronze.news_sentiment   — Vertex AI visibility/sentiment scores
```