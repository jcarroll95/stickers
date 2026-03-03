/**
 * ingestToMongo.js
 *
 * Reads the fetched PubMed abstracts, generates embeddings via OpenAI,
 * and upserts them into MongoDB Atlas with vector-searchable fields.
 *
 * Usage: node ingestToMongo.js
 *
 * Required env vars:
 *   OPENAI_API_KEY   — for the embedding API
 *   MONGODB_URI      — your Atlas connection string
 *
 * Architecture decisions documented inline — read these carefully,
 * they're what you'll discuss in interviews.
 */

import { readFileSync } from "fs";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config({ path: 'apps/api/config/config.env' });
// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CORPUS_FILE = "./data/corpus/pubmed_abstracts.json";
const DB_NAME = "stickerboards"; // or whatever your DB is called
const COLLECTION_NAME = "medical_chunks";

/**
 * EMBEDDING MODEL DECISION:
 *
 * text-embedding-3-small (1536 dimensions) vs text-embedding-3-large (3072).
 *
 * We use `small` because:
 * 1. Our corpus is <100 documents. The quality difference between small and
 *    large is negligible at this scale — it matters when you're searching
 *    millions of vectors where small precision differences compound.
 * 2. Smaller vectors = less storage, faster search, lower cost.
 * 3. 1536 dimensions is the standard that most tutorials and Atlas examples
 *    assume, which reduces friction.
 *
 * You should be able to explain this tradeoff. "I chose the smaller model
 * because my corpus is small enough that retrieval quality is bottlenecked
 * by corpus coverage, not embedding precision" is a strong answer.
 */
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

/**
 * BATCH SIZE for embedding API calls.
 * OpenAI's embedding endpoint accepts up to 2048 inputs per call.
 * We batch at 20 to stay well under rate limits and to get
 * progress feedback during ingestion.
 */
const EMBEDDING_BATCH_SIZE = 20;

// ---------------------------------------------------------------------------
// Embedding
// ---------------------------------------------------------------------------

/**
 * Generate embeddings for an array of text strings.
 *
 * WHY WE EMBED THE TITLE + ABSTRACT TOGETHER:
 * The title often contains the key finding in compressed form
 * ("Late-night eating impairs next-day glucose tolerance").
 * Concatenating title + abstract into a single embedding means the
 * vector captures both the high-level claim and the supporting detail.
 * This improves retrieval when a user query is vague ("eating late
 * makes me feel bad") — the title's direct language bridges the gap.
 *
 * An alternative would be to embed them separately and store two vectors
 * per document. That's overkill for our corpus size.
 */
async function generateEmbeddings(texts) {
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
      input: texts,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embedding API error ${res.status}: ${err}`);
  }

  const data = await res.json();

  // The API returns embeddings in the same order as inputs,
  // but we sort by index defensively
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

// ---------------------------------------------------------------------------
// Document preparation
// ---------------------------------------------------------------------------

/**
 * Transform a raw PubMed article into the document shape we store in MongoDB.
 *
 * SCHEMA DESIGN DECISIONS:
 *
 * 1. `embedding` field — the vector, indexed by Atlas Search.
 *
 * 2. `textContent` — the raw text that was embedded. You MUST store this.
 *    When you retrieve chunks to feed to the LLM, you send the text, not
 *    the vector. This is a mistake beginners make — they store vectors
 *    but forget they need the original text for the prompt.
 *
 * 3. `metadata` as a nested object — keeps the document clean and lets you
 *    add metadata fields without polluting the top-level namespace.
 *    The `reliability` field is critical: it lets your retrieval pipeline
 *    weight peer-reviewed sources higher than other content.
 *
 * 4. `pmid` as a unique identifier — this gives us content-addressed
 *    idempotency. Re-running ingestion won't create duplicates because
 *    we upsert on pmid. You already understand this pattern from your
 *    asset ingestion pipeline.
 *
 * 5. `embeddingModel` — versioning which model produced the embedding.
 *    If you ever switch models, old vectors are incompatible with new ones
 *    (different vector spaces). This field lets you identify and re-embed
 *    stale documents. Interviewers love this kind of forward-thinking.
 */
function prepareDocument(article, embedding) {
  return {
    // Unique identifier for upsert idempotency
    pmid: article.pmid,

    // The text that was embedded — this is what gets sent to the LLM
    textContent: `${article.title}\n\n${article.abstract}`,

    // The vector — indexed by Atlas Search
    embedding: embedding,

    // Metadata for filtering, ranking, and citation
    metadata: {
      title: article.title,
      authors: article.authors,
      journal: article.journal,
      year: article.year,
      source: article.source,
      reliability: article.reliability,
      sourceQuery: article.sourceQuery,
      pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
    },

    // Embedding provenance — critical for model migration
    embeddingModel: EMBEDDING_MODEL,
    embeddingDimensions: EMBEDDING_DIMENSIONS,

    // Timestamps
    ingestedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// MongoDB operations
// ---------------------------------------------------------------------------

/**
 * Upsert documents into MongoDB.
 *
 * We use bulkWrite with updateOne + upsert:true rather than insertMany because:
 * 1. Re-running the script is safe (idempotent on pmid)
 * 2. If you update the embedding model, re-running will update existing docs
 * 3. bulkWrite is a single round-trip to the server for the whole batch
 *
 * This is the same idempotency pattern you use in your asset ingestion
 * pipeline — consistent patterns across the codebase signal maturity.
 */
async function upsertDocuments(collection, documents) {
  const operations = documents.map((doc) => ({
    updateOne: {
      filter: { pmid: doc.pmid },
      update: { $set: doc },
      upsert: true,
    },
  }));

  const result = await collection.bulkWrite(operations);
  return {
    upserted: result.upsertedCount,
    modified: result.modifiedCount,
    matched: result.matchedCount,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Load corpus
  const raw = readFileSync(CORPUS_FILE, "utf-8");
  const articles = JSON.parse(raw);
  console.log(`Loaded ${articles.length} articles from ${CORPUS_FILE}\n`);

  // Connect to MongoDB
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is required");

  const client = new MongoClient(uri);
  await client.connect();
  console.log("Connected to MongoDB Atlas\n");

  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);

  // Create a standard index on pmid for upsert performance
  await collection.createIndex({ pmid: 1 }, { unique: true });

  // Process in batches
  let totalUpserted = 0;
  let totalModified = 0;

  for (let i = 0; i < articles.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = articles.slice(i, i + EMBEDDING_BATCH_SIZE);
    const batchNum = Math.floor(i / EMBEDDING_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(articles.length / EMBEDDING_BATCH_SIZE);

    console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} articles)`);

    // Prepare text for embedding: title + abstract concatenated
    const texts = batch.map((a) => `${a.title}\n\n${a.abstract}`);

    // Generate embeddings
    console.log("  Generating embeddings...");
    const embeddings = await generateEmbeddings(texts);

    // Prepare MongoDB documents
    const documents = batch.map((article, idx) =>
      prepareDocument(article, embeddings[idx])
    );

    // Upsert to MongoDB
    console.log("  Upserting to MongoDB...");
    const result = await upsertDocuments(collection, documents);
    console.log(
      `  ✓ ${result.upserted} new, ${result.modified} updated\n`
    );

    totalUpserted += result.upserted;
    totalModified += result.modified;

    // Brief pause between batches to respect rate limits
    if (i + EMBEDDING_BATCH_SIZE < articles.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log("---");
  console.log(
    `Ingestion complete: ${totalUpserted} new, ${totalModified} updated`
  );
  console.log(`Collection: ${DB_NAME}.${COLLECTION_NAME}`);

  await client.close();

  // Print next steps
  console.log(`
=== NEXT STEP: Create the Vector Search Index ===

In the Atlas UI (or via the Atlas CLI), create a search index on the
'${COLLECTION_NAME}' collection with this definition:

{
  "type": "vectorSearch",
  "fields": [
    {
      "path": "embedding",
      "type": "vector",
      "numDimensions": ${EMBEDDING_DIMENSIONS},
      "similarity": "cosine"
    },
    {
      "path": "metadata.reliability",
      "type": "filter"
    },
    {
      "path": "metadata.year",
      "type": "filter"
    }
  ]
}

Name it "vector_index" (or whatever you prefer — just match it in your
retrieval code).

The filter fields on reliability and year let you constrain vector search
results to peer-reviewed sources or recent publications. This is a
meaningful capability that most RAG tutorials skip.
`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
