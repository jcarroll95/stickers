/**
 * fetchPubmedAbstracts.js
 *
 * Fetches abstracts from PubMed's E-utilities API for a curated set of
 * search terms. Writes results to a JSON file for the chunking/ingestion
 * stage.
 *
 * Usage: node fetchPubmedAbstracts.js
 *
 * No API key required, but rate-limited to 3 requests/second without one.
 * With a key (free from NCBI), you get 10/second.
 * Set NCBI_API_KEY env var if you have one.
 *
 * Why this approach:
 * - PubMed abstracts are public domain (US government work)
 * - Abstracts are self-contained semantic units (no chunking needed)
 * - E-utilities returns structured XML with clean metadata
 * - We control exactly what enters our corpus
 *
 * Concerns:
 * - We are not providing medical advice! I am specifically staying out of
 * drug-relevant literature and focusing on user behaviors on this website
 * - We must leverage implicit data: user frequency of self-monitoring their
 * health effort should richly correlate to potential insights about weight
 * loss success.
 */

import { writeFileSync, existsSync, mkdirSync } from "fs";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// These search terms map to behaviors users can log.
// Each query targets a specific correlation the insight system might surface.

const SEARCH_QUERIES = [
  // === Weight trajectory patterns ===
  // Users log weights over time — these target plateau/stall psychology
  "weight loss plateau psychological impact",
  "weight fluctuation patterns during weight loss",
  "rate of weight loss long term maintenance",
  "unrealistic weight loss expectations outcomes",

  // === Mood : weight loss ===
  // Users log mood on a simple scale
  "mood changes during weight loss",
  "emotional wellbeing weight management",
  "positive affect weight loss adherence",

  // === Sleep : weight loss ===
  // Users log sleep quality on a simple scale
  "sleep quality weight loss outcomes",
  "poor sleep weight loss adherence",
  "sleep improvement during weight management",

  // === Physical activity (low resolution) ===
  // Users log whether they were active, not specifics
  "physical activity frequency weight management",
  "light exercise mood improvement",
  "any physical activity vs sedentary health outcomes",

  // === Non-scale victories / qualitative progress ===
  "non-scale victories weight loss motivation",
  "body image perception during weight loss",

  // === Self-monitoring and engagement ===
  "self-monitoring frequency weight loss success",
  "weight tracking adherence outcomes",
  "digital health app engagement weight management",
  "self-weighing frequency psychological effects",

  // === General symptoms during weight loss (NOT drug-specific) ===
  "nausea during caloric deficit",
  "fatigue during weight loss",
  "gastrointestinal symptoms weight management",

  // === Duration and long-term patterns ===
  "long term weight management behavioral factors",
  "weight loss maintenance one year outcomes",
  "sustained behavior change weight management",
];

const RESULTS_PER_QUERY = 6; // ~96 abstracts total, some overlap expected
const API_KEY = process.env.NCBI_API_KEY || "";
const BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const OUTPUT_DIR = "./data/corpus";
const OUTPUT_FILE = `${OUTPUT_DIR}/pubmed_abstracts.json`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Rate-limit delay between API calls.
 * NCBI allows 3 req/sec without key, 10 req/sec with key.
 * We're conservative — burst too fast and you get temp-banned.
 */
function getRateDelay() {
  return API_KEY ? 150 : 400;
}

function buildUrl(endpoint, params) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  for (const [key, val] of Object.entries(params)) {
    url.searchParams.set(key, val);
  }
  if (API_KEY) url.searchParams.set("api_key", API_KEY);
  return url.toString();
}

/**
 * Search PubMed for article IDs matching a query.
 * Returns an array of PMIDs (PubMed ID strings).
 */
async function searchPubmed(query, maxResults) {
  const url = buildUrl("esearch.fcgi", {
    db: "pubmed",
    term: query,
    retmax: maxResults,
    retmode: "json",
    sort: "relevance",
    // Restrict to articles with abstracts and from the last 10 years
    // for recency. You should be able to explain this filter in an interview.
    datetype: "pdat",
    mindate: "2015",
    maxdate: "2025",
  });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`esearch failed: ${res.status}`);
  const data = await res.json();
  return data.esearchresult?.idlist || [];
}

/**
 * Fetch full records for a list of PMIDs.
 * Returns raw XML — we parse the fields we need.
 *
 * Why XML and not JSON? PubMed's efetch only returns XML or plain text
 * for the pubmed database. Their JSON support is limited to esearch/esummary.
 * This is a real-world API constraint you should be ready to mention.
 */
async function fetchAbstracts(pmids) {
  if (pmids.length === 0) return [];

  const url = buildUrl("efetch.fcgi", {
    db: "pubmed",
    id: pmids.join(","),
    retmode: "xml",
    rettype: "abstract",
  });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`efetch failed: ${res.status}`);
  const xml = await res.text();

  return parseAbstractsFromXml(xml);
}

/**
 * Parse PubMed XML into structured abstract objects.
 *
 * We're doing lightweight XML parsing with regex here rather than pulling
 * in a full XML parser. This is a deliberate tradeoff for a small ingestion
 * script — we control the input format and only need a few fields.
 * In a production system you'd use a proper XML parser.
 */
function parseAbstractsFromXml(xml) {
  const articles = [];
  const articleMatches = xml.split("<PubmedArticle>");

  for (const chunk of articleMatches) {
    // Extract PMID
    const pmidMatch = chunk.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    if (!pmidMatch) continue;

    // Extract title
    const titleMatch = chunk.match(
      /<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/
    );

    // Extract abstract text — may have multiple <AbstractText> sections
    // (structured abstracts have labeled sections like BACKGROUND, METHODS, etc.)
    const abstractParts = [];
    const abstractRegex =
      /<AbstractText(?:\s+Label="([^"]*)")?[^>]*>([\s\S]*?)<\/AbstractText>/g;
    let match;
    while ((match = abstractRegex.exec(chunk)) !== null) {
      const label = match[1];
      const text = match[2].replace(/<[^>]+>/g, "").trim(); // strip inline XML
      if (label) {
        abstractParts.push(`${label}: ${text}`);
      } else {
        abstractParts.push(text);
      }
    }

    // Extract journal name
    const journalMatch = chunk.match(/<Title>([\s\S]*?)<\/Title>/);

    // Extract publication year
    const yearMatch = chunk.match(
      /<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>[\s\S]*?<\/PubDate>/
    );

    // Extract authors (first 3 + et al)
    const authorNames = [];
    const authorRegex =
      /<Author[\s\S]*?<LastName>([\s\S]*?)<\/LastName>[\s\S]*?<Initials>([\s\S]*?)<\/Initials>/g;
    let authorMatch;
    while ((authorMatch = authorRegex.exec(chunk)) !== null) {
      authorNames.push(`${authorMatch[1]} ${authorMatch[2]}`);
    }

    const abstractText = abstractParts.join("\n\n");

    // Skip articles without abstracts — they're useless for our corpus
    if (!abstractText.trim()) continue;

    articles.push({
      pmid: pmidMatch[1],
      title: titleMatch
        ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
        : "Untitled",
      abstract: abstractText,
      journal: journalMatch ? journalMatch[1].trim() : "Unknown",
      year: yearMatch ? parseInt(yearMatch[1]) : null,
      authors:
        authorNames.length > 3
          ? [...authorNames.slice(0, 3), "et al."].join(", ")
          : authorNames.join(", "),
      // Metadata for your retrieval pipeline
      source: "pubmed",
      reliability: "peer-reviewed",
      fetchedAt: new Date().toISOString(),
    });
  }

  return articles;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Starting PubMed fetch for ${SEARCH_QUERIES.length} queries...`);
  console.log(
    `Targeting ~${SEARCH_QUERIES.length * RESULTS_PER_QUERY} abstracts (before dedup)\n`
  );

  const allArticles = new Map(); // pmid → article, for deduplication

  for (const query of SEARCH_QUERIES) {
    console.log(`Searching: "${query}"`);
    try {
      const pmids = await searchPubmed(query, RESULTS_PER_QUERY);
      console.log(`  Found ${pmids.length} results`);

      await sleep(getRateDelay());

      const articles = await fetchAbstracts(pmids);
      console.log(`  Parsed ${articles.length} abstracts`);

      for (const article of articles) {
        if (!allArticles.has(article.pmid)) {
          // Tag which query found this article — useful for debugging
          // retrieval relevance later
          article.sourceQuery = query;
          allArticles.set(article.pmid, article);
        }
      }

      await sleep(getRateDelay());
    } catch (err) {
      console.error(`  Error on query "${query}": ${err.message}`);
      // Continue with other queries — don't let one failure kill the run
    }
  }

  // Write output
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  const corpus = Array.from(allArticles.values());
  writeFileSync(OUTPUT_FILE, JSON.stringify(corpus, null, 2));

  console.log(`\nDone. ${corpus.length} unique abstracts → ${OUTPUT_FILE}`);
}

main().catch(console.error);
