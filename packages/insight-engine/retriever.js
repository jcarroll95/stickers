/**
 * retriever.js
 *
 * Embeds the queries produced by patternDetector and runs vector search
 * against MongoDB Atlas to retrieve relevant literature chunks.
 *
 * This module is deliberately thin — the intelligence is in patternDetector
 * (what to search for) and reportGenerator (what to do with results).
 * This module just handles the mechanical embedding + search.
 */

import { MongoClient } from "mongodb";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const LITERATURE_DB_NAME = "stickerboards"; // MUST match where medical_chunks is stored
const COLLECTION_NAME = "medical_chunks";
const VECTOR_INDEX_NAME = "vector_index"; // must match what you created in Atlas
const EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * TOP_K: how many chunks to retrieve per query.
 *
 * 3 is the sweet spot for this use case:
 * - With 5 queries × 3 results = up to 15 chunks in the LLM context
 * - Each chunk is ~300 words = ~4500 words of context
 * - Plus the user data summary and system prompt, you're well within
 *   even a small context window
 * - More chunks = more noise. For a focused corpus of ~80 abstracts,
 *   the top 3 are almost always the most relevant.
 */
const TOP_K = 3;

/**
 * Minimum similarity score to include a result.
 * Atlas vector search returns a score between 0 and 1 for cosine similarity.
 * Below 0.7, the results are usually not meaningfully related.
 * This prevents the LLM from being fed irrelevant context.
 */
const MIN_SCORE = 0.7;

// ---------------------------------------------------------------------------
// Embedding (same function as ingestion — could be shared module)
// ---------------------------------------------------------------------------

async function embedQuery(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

// ---------------------------------------------------------------------------
// Vector search
// ---------------------------------------------------------------------------

/**
 * Run a single vector search query against Atlas.
 *
 * Uses the $vectorSearch aggregation stage, which is Atlas-specific.
 * The filter on metadata.reliability lets us constrain to peer-reviewed
 * sources if needed.
 *
 * Returns chunks with their similarity score and full metadata.
 */
async function vectorSearch(collection, queryEmbedding, options = {}) {
  const { topK = TOP_K, minScore = MIN_SCORE, filter = {} } = options;

  const pipeline = [
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: topK * 10, // Atlas searches this many, returns topK
        limit: topK,
        ...(Object.keys(filter).length > 0 && { filter }),
      },
    },
    {
      $project: {
        _id: 0,
        textContent: 1,
        metadata: 1,
        score: { $meta: "vectorSearchScore" },
        // Exclude the embedding vector from results — it's large and
        // we don't need it after search
      },
    },
  ];

  const results = await collection.aggregate(pipeline).toArray();

  // Filter by minimum score
  console.log(`      Found ${results.length} total raw candidates`);
  results.forEach(r => console.log(`        - Score: ${r.score.toFixed(4)}: ${r.textContent.slice(0, 50)}...`));

  const filtered = results.filter((r) => r.score >= minScore);
  console.log(`      ${filtered.length} chunks passed MIN_SCORE threshold (>= ${minScore})`);
  return filtered;
}

// ---------------------------------------------------------------------------
// Main retrieval function
// ---------------------------------------------------------------------------

/**
 * Execute all retrieval queries and return deduplicated, ranked results.
 *
 * @param {Object[]} queries - from buildRetrievalQueries()
 * @param {string} mongoUri - MongoDB connection string
 * @returns {Object[]} Retrieved chunks with metadata and relevance info
 *
 * WHY DEDUPLICATION MATTERS:
 * Multiple queries might retrieve the same abstract. "weight loss plateau
 * psychological impact" and "self-monitoring frequency weight loss" could
 * both return the same study about self-monitoring during plateaus.
 * We deduplicate by pmid and keep the highest score.
 */
export async function retrieveContext(queries, mongoUri) {
  const client = new MongoClient(mongoUri);
  await client.connect();

  // EXPLICITLY Select the literature database
  const collection = client.db(LITERATURE_DB_NAME).collection(COLLECTION_NAME);

  console.log(`  Connecting to Literature DB: "${LITERATURE_DB_NAME}", Collection: "${COLLECTION_NAME}"`);

  const allResults = new Map(); // pmid → result (dedup)

  for (const queryObj of queries) {
    console.log(`  Retrieving for: "${queryObj.query}"`);
    console.log(`    Reason: ${queryObj.reason}`);

    const embedding = await embedQuery(queryObj.query);
    const results = await vectorSearch(collection, embedding);

    console.log(`    Found ${results.length} relevant chunks`);

    for (const result of results) {
      const pmid = result.metadata?.pubmedUrl?.split("/").slice(-2, -1)[0];
      const key = pmid || result.textContent.slice(0, 50); // fallback key

      if (!allResults.has(key) || allResults.get(key).score < result.score) {
        allResults.set(key, {
          ...result,
          // Track which query retrieved this — useful for the LLM prompt
          // and for debugging retrieval quality
          retrievedBy: queryObj.query,
          retrievalReason: queryObj.reason,
        });
      }
    }
  }

  await client.close();

  // Sort by score descending
  const deduplicated = Array.from(allResults.values()).sort(
    (a, b) => b.score - a.score
  );

  console.log(
    `  Total unique chunks retrieved: ${deduplicated.length}`
  );

  return deduplicated;
}
