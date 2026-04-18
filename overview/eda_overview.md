
## The Lighthouse Priority score combines three dimensions to identify humanitarian crises that are both urgent and neglected

# Importance Score (Scale)
Uses a logarithmic scale to measure the absolute magnitude of need:

Formula: log₁₀(In_Need + 1), rounded to 2 decimals

Why logarithmic? This prevents massive crises from completely dominating the ranking. A crisis with 20 million people in need gets a score of ~7.30, while 10 million gets ~7.00. The difference is meaningful but not overwhelming, allowing smaller high-severity crises to remain visible in the analysis.
Example: Afghanistan with 22.3M in need → Importance Score of 7.35
Severity Index (Urgency)
Measures the percentage of the local population affected:

Formula: In_Need / Population, rounded to 4 decimals

This normalizes by population size to identify where the crisis is most acute relative to the local context
Example: If 14.2M out of 20M population are in need → Severity Index of 0.71 (71%)

# Planning Gap (Neglect)
Identifies how much need is going unaddressed

Formula: 1 - (Targeted / In_Need), rounded to 4 decimals
A high gap means few people are being targeted for assistance relative to the total in need
Example: If only 4M are targeted out of 14M in need → Planning Gap of 0.72 (72% unmet)

# Lighthouse Priority (Final Score)
The product of all three dimensions

Formula: Severity_Index × Planning_Gap × Importance_Score
This multiplicative approach ensures crises rank high only when they score well on all three dimensions: they must be urgent (high severity), neglected (high planning gap), AND significant in scale (high importance)
The scores in your results range into the millions because you're multiplying the raw In_Need values by the percentage factors
