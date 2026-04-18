"""
Kumo.AI Graph Configuration (Massively Enriched Heterogeneous Graph)
Maps the Databricks Delta tables into a deeply interconnected graph for Kumo RFM.

This schema defines the architectural foundation for Layer 3: The Predictive Brain.
By utilizing a massively connected heterogeneous graph, Kumo can learn non-linear 
relationships across finance, conflict, climate, and media data to predict funding gaps.
"""

from kumo import Graph

def get_humanitarian_graph() -> Graph:
    """
    Constructs the advanced Kumo graph from the Databricks Medallion Architecture.
    
    Nodes (Entities):
    - Countries (Attributes: ISO3, Region, INFORM Risk Score, GDP baseline)
    - Crises (Attributes: Year, Duration, Crisis Type, Total People in Need)
    - Sectors (Attributes: Name, Urgency Weight, Time-Criticality)
    - Donors (Attributes: Name, Type (Gov/Private/Pooled), Historic Giving)
    - Funds (Attributes: Amount USD, Status (Pledge/Paid), Date)
    - Events (Attributes: Conflict Type, Fatalities, Geo-coordinates) [ACLED]
    - Media_Coverage (Attributes: Sentiment, Article Count, Visibility) [Layer 5B]
    - Assessments (Attributes: Extracted Needs, Source) [Layer 5A / ReliefWeb]
    - Population (Attributes: Admin 1/2, IPC Food Phase, Demographics) [COD/IPC]

    Edges (Relationships):
    - (Country) -[EXPERIENCES]-> (Crisis)
    - (Crisis) -[HAS_NEED_IN]-> (Sector)
    - (Donor) -[MAKES_PLEDGE]-> (Funds)
    - (Funds) -[ALLOCATED_TO]-> (Crisis_Sector)
    - (Country) -[SUFFERS_FROM]-> (Events)
    - (Media_Coverage) -[MENTIONS]-> (Crisis)
    - (Assessments) -[EVALUATES]-> (Crisis)
    - (Country) -[CONTAINS]-> (Population)
    """
    return Graph.from_databricks(
        catalog="amberlytics",
        schema="silver",  # Assuming normalized tables are accessed here
        tables=[
            # Core Financial & Needs Graph
            "funding_flows",           # Edges: Donor -> Funds -> Sector
            "needs_by_sector",         # Nodes: Sectors, Attributes: PiN
            "crisis_universe",         # Nodes: Crises, Attributes: Year, Duration
            
            # Demographic & Vulnerability
            "population",              # Nodes: Population segments (COD)
            "severity_index",          # Attributes: INFORM Risk & Severity
            
            # --- MASSIVELY ENRICHED DATA SOURCES ---
            
            # Donor Behavior & Concentration
            "donor_profiles",          # Nodes: Donors (Aggregated from CBPF & FTS)
            
            # Conflict & Hazard (Horizon Scanning)
            "acled_conflict_events",   # Nodes: Events, Edges: -> Country
            "ipc_food_security",       # Attributes: Famine Risk Phases 3+
            
            # Intelligence Layer Outputs (Unstructured Data)
            "reliefweb_assessments",   # Nodes: Assessments (Parsed via Claude)
            "news_visibility_metrics"  # Nodes: Media_Coverage (Global sentiment)
        ]
    )
