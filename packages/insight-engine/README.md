# Insight Pipeline — RAG-Powered Behavioral Pattern Analysis

A retrieval-augmented generation system that analyzes user-logged weight management data against curated medical literature to produce periodic insight reports. Designed with explicit safety constraints to surface evidence-linked correlations without providing medical advice.

## Architecture

```
User Data (MongoDB)     PubMed Corpus (MongoDB + Vector Index)
        │                            │
        ▼                            │
  patternDetector.js                 │
  Detects: plateaus, trends,         │
  mood/sleep shifts, engagement      │
  dropoff, side effect patterns      │
        │                            │
        ▼                            │
  buildRetrievalQueries()            │
  Translates detected patterns       │
  into clinical search terms         │
        │                            │
        ▼                            ▼
              retriever.js
              Embeds queries → $vectorSearch
              Deduplicates by PMID, ranks by score
                      │
                      ▼
              reportGenerator.js
              Assembles LLM prompt with safety constraints
              Generates report
              Validates output (heuristic + LLM classifier)
                      │
                      ▼
              Approved report stored │ Rejected report audited
```

## Setup

### Prerequisites

- Node.js 18+
- MongoDB Atlas cluster with M10+ tier (required for Atlas Search / vector search)
- OpenAI API key (for embeddings and report generation)

### Install dependencies

```bash
npm install mongodb
```

### Environment variables

```bash
export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net"
export OPENAI_API_KEY="sk-..."
# Optional: increases PubMed rate limit from 3/sec to 10/sec
export NCBI_API_KEY="your-ncbi-key"
```

## Scripts

### 1. `fetchPubmedAbstracts.js` — Corpus acquisition

Fetches 50–100 PubMed abstracts across curated search terms mapped to user-loggable behaviors (weight trajectories, mood, sleep, self-monitoring adherence, general symptoms). Writes deduplicated results to `./data/corpus/pubmed_abstracts.json`.

```bash
node fetchPubmedAbstracts.js
```

Search terms deliberately exclude drug-specific literature. The corpus is scoped to lifestyle and behavioral factors where surfacing correlations carries low risk. See the `SEARCH_QUERIES` array for the full list and rationale.

Output: `./data/corpus/pubmed_abstracts.json`

### 2. `ingestToMongo.js` — Embedding and storage

Reads the fetched abstracts, generates embeddings via OpenAI's `text-embedding-3-small`, and upserts them into MongoDB Atlas. Each document stores the original text, the embedding vector, source metadata, and embedding model provenance.

```bash
node ingestToMongo.js
```

Upserts are idempotent on PMID — re-running the script is safe and will update existing documents.

After ingestion, create a vector search index in Atlas with the definition the script prints. The index includes filter paths for `metadata.reliability` and `metadata.year` to enable filtered vector search.

### 3. `patternDetector.js` — Local data analysis (imported, not run directly)

Pure functions that analyze a user's recent logged data to detect behavioral patterns. No API calls, no network — just math over arrays. Detects:

- Weight plateaus (low variance over 14+ days)
- Weight trend direction and rate (linear regression)
- Mood trends and mood–weight correlation
- Sleep quality patterns
- Engagement frequency and dropoff
- Side effect trends
- Physical activity frequency

Also exports `buildRetrievalQueries()`, which translates detected patterns into retrieval queries using clinical vocabulary. Queries are prioritized (actionable patterns rank higher) and capped at 5 per report.

### 4. `retriever.js` — Vector search (imported, not run directly)

Embeds the queries from `buildRetrievalQueries()`, runs `$vectorSearch` against Atlas, deduplicates results by PMID, and filters by a minimum similarity score (0.7). Returns ranked chunks with metadata and retrieval provenance.

### 5. `reportGenerator.js` — LLM generation + safety validation (imported, not run directly)

Assembles the prompt from detected patterns and retrieved literature, calls the LLM (gpt-4o-mini), and runs the output through a two-layer safety validation pipeline:

- **Layer 1 — Heuristic scanner**: Regex patterns catching directive language ("you should"), medication names, and causal claims. Instant and free.
- **Layer 2 — LLM classifier**: A separate model call that evaluates the report for subtle violations. Fails closed (classifier failure = report rejection).

Reports that pass both layers are returned with full source citations. Rejected reports are logged with violation details for auditing.

### 6. `generateInsightReport.js` — Orchestrator

Ties the full pipeline together. Fetches a user's recent data, runs pattern detection, builds and executes retrieval queries, generates the report, validates it, and stores the result.

```bash
node generateInsightReport.js <userId>
```

Approved reports go to the `insightReports` collection. Rejected reports go to `insightReportAudit` with violation details.

**You will need to adapt `fetchUserData()`** to match your actual Mongoose schema — the collection names and field paths are placeholders.

## Key design decisions

**Why no chunking?** PubMed abstracts are 200–300 words — already the right size for embedding. Splitting them would destroy semantic coherence and produce worse retrieval. Longer documents would require section-level chunking.

**Why `text-embedding-3-small`?** For a corpus under 100 documents, the quality gap vs. the large model is negligible. Retrieval quality is bottlenecked by corpus coverage, not embedding precision.

**Why Atlas vector search instead of Pinecone/Weaviate?** Colocation with application data enables transactional consistency (ingest chunks and update manifests atomically) and eliminates cross-system consistency problems. One connection string, one backup strategy. A dedicated vector DB would be warranted at millions of documents; at this scale it adds operational complexity without benefit.

**Why gpt-4o-mini for generation?** This is a constrained, structured generation task with a tightly controlled prompt. The cheaper model performs adequately, and for a periodic batch job, cost efficiency matters.

**Why patterns before retrieval?** The system doesn't have a user query to embed. It has structured data. `patternDetector` bridges that gap by deriving retrieval queries from behavioral patterns — the engineering that distinguishes this from a tutorial-grade RAG implementation.

## Safety architecture

The system never provides medical advice. Three layers enforce this:

1. **Corpus scoping**: No drug-specific literature is ingested. The LLM cannot hallucinate pharmaceutical guidance from context it was never given.
2. **Prompt constraints**: The system prompt defines identity ("you are a pattern analysis system"), explicit prohibitions with examples, and a mandatory citation format that grounds all claims in provided sources.
3. **Output validation**: Dual-layer post-generation check (heuristic + LLM classifier) with fail-closed semantics. Rejected reports are never served.


## Accepted Report Example:
```
=== Insight Report for User 69a525ad2f93be5f00ce950f ===

Step 1: Fetching user data...
  DEBUG: Found 395 total logs for user.
    Weights: 139, Moods: 90, Sleep: 71, Side Effects: 22, Activity: 73
    Data dates: 2024-11-21T01:00:00.000Z to 2025-05-14T00:00:00.000Z
  Weights: 139, Moods: 90, Sleep: 71, Check-ins: 395

Step 2: Detecting patterns...
  Detected 6 patterns:
    - weight_trend: {"type":"weight_trend","direction":"losing","weeklyRate":-1.04,"totalChange":-3.8}
    - mood: {"type":"mood","averageMood":3.7,"trend":"stable","lowMoodFrequency":0}
    - sleep: {"type":"sleep","averageSleep":4.4,"trend":"stable","poorSleepFrequency":0}
    - engagement: {"type":"engagement","averageGapDays":0.4,"trend":"stable","totalWeeks":25,"totalCheckIns":395}
    - side_effects: {"type":"side_effects","mostCommon":[{"effect":"fatigue","count":4,"frequency":18},{"effect":"dizziness","count":4,"frequency":18},{"effect":"constipation","count":3,"frequency":14}],"trend":"stable","totalReports":22}
    - activity: {"type":"activity","averageIntensity":3,"activeDaysPercent":100,"activeDaysCount":14,"totalDays":14}

Step 3: Building retrieval queries...
  Generated 2 queries:
    [P3] "sustained weight loss behavioral predictors"
           Reason: Steady loss: -1.04 lbs/week
    [P3] "regular physical activity weight loss mood benefits"
           Reason: Active 100% of days

Step 4: Retrieving literature...
  Connecting to Literature DB: "stickerboards", Collection: "medical_chunks"
  Retrieving for: "sustained weight loss behavioral predictors"
    Reason: Steady loss: -1.04 lbs/week
      Found 3 total raw candidates
        - Score: 0.7954: Weight Bias Internalization and Long-Term Weight L...
        - Score: 0.7936: The role of self-monitoring in the maintenance of ...
        - Score: 0.7931: Maintenance of Lost Weight and Long-Term Managemen...
      3 chunks passed MIN_SCORE threshold (>= 0.7)
    Found 3 relevant chunks
  Retrieving for: "regular physical activity weight loss mood benefits"
    Reason: Active 100% of days
      Found 3 total raw candidates
        - Score: 0.7672: Physical activity and exercise for weight loss and...
        - Score: 0.7543: Weight Loss and Improvement in Comorbidity: Differ...
        - Score: 0.7542: Eating pathology and psychological outcomes in you...
      3 chunks passed MIN_SCORE threshold (>= 0.7)
    Found 3 relevant chunks
  Total unique chunks retrieved: 6

Step 5: Generating report...
Generating report...
Report generated. Running safety validation...
  Heuristic check: PASSED
  LLM classifier: PASSED
{
  status: 'approved',
  content: '## Your Patterns This Period\n' +
    'Your weight has been steadily decreasing at a rate of approximately 1.04 lbs per week, with a total loss of 3.8 lbs this period. Your mood and sleep quality ratings are stable and positive, with no reported low mood or poor sleep days. You have demonstrated consistent engagement with the platform, logging activity every day.\n' +
    '\n' +
    '## What Research Suggests\n' +
    'A study published in the *Annals of Behavioral Medicine* found that participants with obesity who maintained a steady weight loss of approximately 1.04 lbs per week were able to achieve significant weight loss over time, although the relationship between weight bias internalization and weight loss was complex and varied among different demographic groups (Pearl et al., 2019). This highlights the importance of consistent weight loss patterns in achieving long-term weight management goals.\n' +
    '\n' +
    'Research by Laitner et al. in *Eating Behaviors* emphasized the role of self-monitoring in maintaining weight loss success. The study observed that participants who engaged in higher levels of self-monitoring during an extended care period were more likely to maintain their weight loss, suggesting that consistent engagement in tracking behaviors can be beneficial for long-term outcomes (Laitner et al., 2016).\n' +
    '\n' +
    'Additionally, a review in *The Medical Clinics of North America* discussed the challenges of maintaining lost weight and emphasized the necessity of ongoing support and counseling for sustainable healthful behaviors (Hall & Kahan, 2018). This aligns with the observed stable engagement in your logging activities, which may reflect a commitment to monitoring your progress.\n' +
    '\n' +
    'Research from *Reviews in Endocrine & Metabolic Disorders* noted that regular physical activity is integral to effective weight management, particularly in individuals with obesity. The study highlighted that consistent exercise can lead to additional weight loss and improvements in overall health (Oppert et al., 2023). Your data indicates that you have been active on 100% of logged days, which aligns with findings that regular physical activity contributes positively to weight loss and maintenance.\n' +
    '\n' +
    "## Things You're Doing Well\n" +
    'You have shown consistent engagement with the platform, logging your activities regularly, and maintaining a positive mood and sleep quality. Your commitment to daily physical activity is commendable and aligns with research highlighting its importance in weight management. \n' +
    '\n' +
    '---\n' +
    '*This report surfaces correlations between your logged data and published research. It is not medical advice. Discuss any health concerns with your healthcare provider.*',
  generatedAt: '2026-03-03T18:35:58.013Z',
  patternsAnalyzed: [
    'weight_trend',
    'mood',
    'sleep',
    'engagement',
    'side_effects',
    'activity'
  ],
  sourcesUsed: [
    {
      title: 'Weight Bias Internalization and Long-Term Weight Loss in Patients With Obesity.',
      journal: 'Annals of behavioral medicine : a publication of the Society of Behavioral Medicine',
      year: 2019,
      url: 'https://pubmed.ncbi.nlm.nih.gov/30304382/',
      relevanceScore: 0.7953855395317078
    },
    {
      title: 'The role of self-monitoring in the maintenance of weight loss success.',
      journal: 'Eating behaviors',
      year: 2016,
      url: 'https://pubmed.ncbi.nlm.nih.gov/26974582/',
      relevanceScore: 0.7936049699783325
    },
    {
      title: 'Maintenance of Lost Weight and Long-Term Management of Obesity.',
      journal: 'The Medical clinics of North America',
      year: 2018,
      url: 'https://pubmed.ncbi.nlm.nih.gov/29156185/',
      relevanceScore: 0.7931010723114014
    },
    {
      title: 'Physical activity and exercise for weight loss and maintenance in people living with obesity.',
      journal: 'Reviews in endocrine &amp; metabolic disorders',
      year: 2023,
      url: 'https://pubmed.ncbi.nlm.nih.gov/37142892/',
      relevanceScore: 0.7672275900840759
    },
    {
      title: 'Weight Loss and Improvement in Comorbidity: Differences at 5%, 10%, 15%, and Over.',
      journal: 'Current obesity reports',
      year: 2017,
      url: 'https://pubmed.ncbi.nlm.nih.gov/28455679/',
      relevanceScore: 0.7543208599090576
    },
    {
      title: 'Eating pathology and psychological outcomes in young adults in self-regulation interventions using daily self-weighing.',
      journal: 'Health psychology : official journal of the Division of Health Psychology, American Psychological Association',
      year: 2019,
      url: 'https://pubmed.ncbi.nlm.nih.gov/30550313/',
      relevanceScore: 0.7542102336883545
    }
  ]
}

Step 6: Storing approved report...
  Report stored successfully.

=== RESULT ===
## Your Patterns This Period
Your weight has been steadily decreasing at a rate of approximately 1.04 lbs per week, with a total loss of 3.8 lbs this period. Your mood and sleep quality ratings are stable and positive, with no reported low mood or poor sleep days. You have demonstrated consistent engagement with the platform, logging activity every day.

## What Research Suggests
A study published in the *Annals of Behavioral Medicine* found that participants with obesity who maintained a steady weight loss of approximately 1.04 lbs per week were able to achieve significant weight loss over time, although the relationship between weight bias internalization and weight loss was complex and varied among different demographic groups (Pearl et al., 2019). This highlights the importance of consistent weight loss patterns in achieving long-term weight management goals.

Research by Laitner et al. in *Eating Behaviors* emphasized the role of self-monitoring in maintaining weight loss success. The study observed that participants who engaged in higher levels of self-monitoring during an extended care period were more likely to maintain their weight loss, suggesting that consistent engagement in tracking behaviors can be beneficial for long-term outcomes (Laitner et al., 2016).

Additionally, a review in *The Medical Clinics of North America* discussed the challenges of maintaining lost weight and emphasized the necessity of ongoing support and counseling for sustainable healthful behaviors (Hall & Kahan, 2018). This aligns with the observed stable engagement in your logging activities, which may reflect a commitment to monitoring your progress.

Research from *Reviews in Endocrine & Metabolic Disorders* noted that regular physical activity is integral to effective weight management, particularly in individuals with obesity. The study highlighted that consistent exercise can lead to additional weight loss and improvements in overall health (Oppert et al., 2023). Your data indicates that you have been active on 100% of logged days, which aligns with findings that regular physical activity contributes positively to weight loss and maintenance.

## Things You're Doing Well
You have shown consistent engagement with the platform, logging your activities regularly, and maintaining a positive mood and sleep quality. Your commitment to daily physical activity is commendable and aligns with research highlighting its importance in weight management.

---
*This report surfaces correlations between your logged data and published research. It is not medical advice. Discuss any health concerns with your healthcare provider.*
```

## Rejected Report Example:
```
=== Insight Report for User 69a525ad2f93be5f00ce950f ===

Step 1: Fetching user data...
  DEBUG: Found 395 total logs for user.
    Weights: 139, Moods: 90, Sleep: 71, Side Effects: 22, Activity: 73
    Data dates: 2024-11-21T01:00:00.000Z to 2025-05-14T00:00:00.000Z
  Weights: 139, Moods: 90, Sleep: 71, Check-ins: 395

Step 2: Detecting patterns...
  Detected 6 patterns:
    - weight_trend: {"type":"weight_trend","direction":"losing","weeklyRate":-1.04,"totalChange":-3.8}
    - mood: {"type":"mood","averageMood":3.7,"trend":"stable","lowMoodFrequency":0}
    - sleep: {"type":"sleep","averageSleep":4.4,"trend":"stable","poorSleepFrequency":0}
    - engagement: {"type":"engagement","averageGapDays":0.4,"trend":"stable","totalWeeks":25,"totalCheckIns":395}
    - side_effects: {"type":"side_effects","mostCommon":[{"effect":"fatigue","count":4,"frequency":18},{"effect":"dizziness","count":4,"frequency":18},{"effect":"constipation","count":3,"frequency":14}],"trend":"stable","totalReports":22}
    - activity: {"type":"activity","averageIntensity":3,"activeDaysPercent":100,"activeDaysCount":14,"totalDays":14}

Step 3: Building retrieval queries...
  Generated 2 queries:
    [P3] "sustained weight loss behavioral predictors"
           Reason: Steady loss: -1.04 lbs/week
    [P3] "regular physical activity weight loss mood benefits"
           Reason: Active 100% of days

Step 4: Retrieving literature...
  Connecting to Literature DB: "stickerboards", Collection: "medical_chunks"
  Retrieving for: "sustained weight loss behavioral predictors"
    Reason: Steady loss: -1.04 lbs/week
      Found 3 total raw candidates
        - Score: 0.7954: Weight Bias Internalization and Long-Term Weight L...
        - Score: 0.7936: The role of self-monitoring in the maintenance of ...
        - Score: 0.7931: Maintenance of Lost Weight and Long-Term Managemen...
      3 chunks passed MIN_SCORE threshold (>= 0.7)
    Found 3 relevant chunks
  Retrieving for: "regular physical activity weight loss mood benefits"
    Reason: Active 100% of days
      Found 3 total raw candidates
        - Score: 0.7672: Physical activity and exercise for weight loss and...
        - Score: 0.7543: Weight Loss and Improvement in Comorbidity: Differ...
        - Score: 0.7542: Eating pathology and psychological outcomes in you...
      3 chunks passed MIN_SCORE threshold (>= 0.7)
    Found 3 relevant chunks
  Total unique chunks retrieved: 6

Step 5: Generating report...
Generating report...
Report generated. Running safety validation...
  Heuristic check: PASSED
LLM SAFETY CLASSIFIER FAILED: [
  "UNSOURCED CLAIMS: Claims about the benefits of weight loss and the importance of physical activity are made without specific sources in the same paragraph."
]
{
  status: 'rejected',
  reason: 'Failed LLM safety classifier',
  violations: [
    'UNSOURCED CLAIMS: Claims about the benefits of weight loss and the importance of physical activity are made without specific sources in the same paragraph.'
  ],
  content: null,
  _debug_rawContent: '## Your Patterns This Period\n' +
    'The data indicates a consistent weight loss trend of approximately 1.04 lbs per week, totaling a loss of 3.8 lbs this period. Mood and sleep quality ratings are stable and positive, with no reported low mood or poor sleep days. Engagement with the platform remains high, with daily activity logged consistently.\n' +
    '\n' +
    '## What Research Suggests\n' +
    'Research published in the *Annals of Behavioral Medicine* found that a steady weight loss of around 1.04 lbs per week can be observed in populations undergoing lifestyle interventions for obesity. This study highlighted the importance of understanding the relationship between weight loss and psychological factors, such as weight bias internalization, which did not significantly predict weight change over time in their cohort (Pearl et al., 2019). \n' +
    '\n' +
    'Additionally, a study in *Eating Behaviors* emphasized the role of self-monitoring in maintaining weight loss success. Participants who engaged in higher levels of self-monitoring during extended care periods demonstrated better weight maintenance outcomes, suggesting that consistent tracking can be beneficial for long-term weight management (Laitner et al., 2016). \n' +
    '\n' +
    'Physical activity has also been identified as a critical component in weight loss and maintenance. A review in *Reviews in Endocrine & Metabolic Disorders* noted that regular exercise, particularly aerobic training, is associated with additional weight loss and improvements in health markers among individuals with obesity. The study emphasized the necessity of integrating physical activity into comprehensive obesity management strategies (Oppert et al., 2023).\n' +
    '\n' +
    'Moreover, research in *Current Obesity Reports* indicated that even modest weight loss (5-10%) can lead to significant improvements in various health metrics, including glycemic control and blood pressure, underscoring the potential benefits of sustained weight loss efforts (Ryan & Yockey, 2017).\n' +
    '\n' +
    "## Things You're Doing Well\n" +
    'The consistent engagement with the platform and the high levels of physical activity logged are positive patterns. Maintaining a stable mood and sleep quality further supports a healthy lifestyle approach. \n' +
    '\n' +
    '---\n' +
    '*This report surfaces correlations between your logged data and published research. It is not medical advice. Discuss any health concerns with your healthcare provider.*'
}

Report not stored — status: rejected
  Violations: ["UNSOURCED CLAIMS: Claims about the benefits of weight loss and the importance of physical activity are made without specific sources in the same paragraph."]

=== RESULT ===
Status: rejected
Reason: Failed LLM safety classifier
```
