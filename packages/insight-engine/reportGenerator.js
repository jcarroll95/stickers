/**
 * reportGenerator.js
 *
 * Assembles the LLM prompt from user data patterns + retrieved literature,
 * generates the insight report, and validates it for safety.
 *
 * This is where the safety architecture lives.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const LLM_MODEL = "gpt-4o-mini";
const LLM_MAX_TOKENS = 1500;

// ---------------------------------------------------------------------------
// System prompt — the core safety architecture
// ---------------------------------------------------------------------------

/**
 * WHY THIS PROMPT IS STRUCTURED THIS WAY:
 *
 * 1. Identity first: Tell the model what it IS before telling it what to do.
 *    "You are a pattern analysis system" — not a doctor, not an advisor.
 *
 * 2. Explicit prohibitions with examples: "NEVER" rules with concrete
 *    examples of what violations look like. LLMs follow prohibitions better
 *    when they can pattern-match against examples.
 *
 * 3. Required citation format: Every insight must reference a specific source.
 *    This serves double duty — it makes the output verifiable AND it
 *    constrains the model to only say things grounded in the provided context.
 *    If there's no source, it can't make the claim.
 *
 * 4. Output structure: Defining the exact sections forces the model into
 *    a predictable output format that's easier to validate programmatically.
 */
const SYSTEM_PROMPT = `You are a behavioral pattern analysis system for a weight management tracking application. You analyze user-logged behavioral data alongside excerpts from published research to surface potential correlations and patterns. You use the user's data to provide parallel lines of evidence from research studies and describe the conclusions of studies, but never draw a direct bridge between the user's behavior and the conclusion of the study.

CRITICAL SAFETY RULES — VIOLATIONS ARE UNACCEPTABLE:

1. You NEVER provide medical advice, diagnoses, or treatment recommendations.
2. You NEVER mention specific medications, drugs, or pharmaceutical names — even if the user's data implies they are taking medication. You may reference a CLASS of medicines if and only if they are relevant and from a source you're referencing.
3. You NEVER use directive language: no "you should," "you need to," "try doing," "consider taking," or "I recommend."
4. You NEVER make causal claims. Say "research has observed a correlation between X and Y" — NEVER "X causes Y" or "X leads to Y."
5. You NEVER speculate about the user's medical condition, health status, or prognosis.
6. Every factual claim must cite a specific provided source by title. If no source supports a claim, do not make it.
7. If the detected patterns suggest something concerning (rapid weight change, persistent low mood, increasing symptoms), include this exact sentence: "Some of the patterns in your data may be worth discussing with your healthcare provider." Do not rephrase this sentence in any way.
8. When discussing research, speak ONLY about the study population. Do not use phrases like 'This suggests that for you...' or 'This could be beneficial for individuals like you.' Keep the research section strictly about what the researchers observed in their specific cohorts.

LANGUAGE SUBSTITUTIONS: Your output will be rejected for making suggestions to take action.
- Instead of: "You should try walking more."
+ Say: "Research in [Source] has observed that populations with similar activity levels often see [X] result."
- Forbidden: "It might be helpful to...", "A good next step would be...", "Consider adjusting..."
+ Allowed: "The data shows...", "The literature describes...", "Researchers noted..."
- Instead of: "This aligns with your data..."
+ Allowed: "The study observed this pattern between sleep and weight loss in a cohort of 200 adults over 31 weeks" letting the user make their own connection.


OUTPUT FORMAT — Follow this structure exactly:

## Your Patterns This Period
[2-3 sentences summarizing the key behavioral patterns detected in the user's data. These are OBSERVATIONS about their logged data only — no interpretation yet.]

## What Research Suggests
[2-4 paragraphs connecting the user's patterns to findings from the provided research excerpts. Every claim must cite a source. Use language like "A study published in [Journal] found that..." or "Research by [Authors] observed that...". Frame everything as what researchers have observed in populations, NOT as advice for the individual. Every single sentence in the "What Research Suggests" section that contains a health-related fact must end with a citation.]

## Things You're Doing Well
[1-2 sentences noting positive patterns, if any. Consistent logging, regular activity, improving mood trends, etc. Base this on the data, not on assumptions.]

---
*This report surfaces correlations between your logged data and published research. It is not medical advice. Discuss any health concerns with your healthcare provider.*

Before writing the report, list any medications mentioned in the sources and confirm you will not name them. Confirm you will not use the word 'should'

`;

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

/**
 * Build the user message from patterns and retrieved context.
 *
 * Note: we include the retrieval reason for each chunk. This helps the
 * LLM understand WHY a piece of literature was retrieved, which produces
 * more focused and relevant output.
 */
function buildUserMessage(patterns, retrievedChunks) {
  let message = "=== USER DATA PATTERNS ===\n\n";

  for (const pattern of patterns) {
    message += formatPattern(pattern) + "\n\n";
  }

  message += "=== RELEVANT RESEARCH EXCERPTS ===\n\n";

  for (let i = 0; i < retrievedChunks.length; i++) {
    const chunk = retrievedChunks[i];
    message += `[Source ${i + 1}]\n`;
    message += `Title: ${chunk.metadata.title}\n`;
    message += `Authors: ${chunk.metadata.authors}\n`;
    message += `Journal: ${chunk.metadata.journal} (${chunk.metadata.year})\n`;
    message += `Relevance: ${chunk.retrievalReason}\n`;
    message += `Content:\n${chunk.textContent}\n\n`;
  }

  message +=
    "=== INSTRUCTIONS ===\n" +
    "Analyze the user's behavioral patterns above in the context of the provided " +
    "research excerpts. Follow the output format specified in your system instructions. " +
    "Cite sources by title when referencing research findings. Do not make any claims " +
    "about the user's health; identify relevant study conclusions and how those populations " +
    "behaved versus their outcome, let the reader make their own bridge between their behavior and the study. Do not give medical advice.";

  return message;
}

/**
 * Format a detected pattern into human-readable text for the prompt.
 */
function formatPattern(pattern) {
  switch (pattern.type) {
    case "plateau":
      return (
        `WEIGHT PLATEAU: Weight has been stable at ~${pattern.plateauWeight} lbs ` +
        `for approximately ${pattern.daysOnPlateau} days (confidence: ${pattern.confidence}).`
      );

    case "weight_trend":
      return (
        `WEIGHT TREND: Weight is ${pattern.direction} at approximately ` +
        `${Math.abs(pattern.weeklyRate)} lbs/week. Total change this period: ` +
        `${pattern.totalChange > 0 ? "+" : ""}${pattern.totalChange} lbs.`
      );

    case "mood":
      return (
        `MOOD: Average mood rating ${pattern.averageMood}/5, trend is ${pattern.trend}. ` +
        `Low mood reported on ${pattern.lowMoodFrequency}% of logged days.` +
        (pattern.moodWeightCorrelation
          ? " A correlation between low mood days and higher-than-average weight was detected."
          : "")
      );

    case "sleep":
      return (
        `SLEEP: Average sleep quality ${pattern.averageSleep}/5, trend is ${pattern.trend}. ` +
        `Poor sleep reported on ${pattern.poorSleepFrequency}% of logged days.`
      );

    case "engagement":
      return (
        `ENGAGEMENT: User has been on the platform for ${pattern.totalWeeks} weeks ` +
        `with ${pattern.totalCheckIns} total check-ins. Average gap between check-ins: ` +
        `${pattern.averageGapDays} days. Engagement trend: ${pattern.trend}.`
      );

    case "side_effects":
      return (
        `REPORTED SYMPTOMS: Most common: ${pattern.mostCommon.map((s) => `${s.effect} (${s.frequency}%)`).join(", ")}. ` +
        `Symptom reporting trend: ${pattern.trend}.`
      );

    case "activity":
      return (
        `PHYSICAL ACTIVITY: Active on ${pattern.activeDaysPercent}% of logged days ` +
        `(${pattern.activeDaysCount} of ${pattern.totalDays} days).`
      );

    default:
      return `${pattern.type}: ${JSON.stringify(pattern)}`;
  }
}

// ---------------------------------------------------------------------------
// LLM call
// ---------------------------------------------------------------------------

async function callLLM(systemPrompt, userMessage) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      max_tokens: LLM_MAX_TOKENS,
      temperature: 0.3, // Low temperature for consistent, factual output
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// ---------------------------------------------------------------------------
// Output validation — the safety net
// ---------------------------------------------------------------------------

/**
 * SAFETY VALIDATION PIPELINE
 *
 * Two layers:
 * 1. Heuristic scan (fast, free) — regex patterns for known-bad phrases
 * 2. LLM classifier (slower, costs money) — catches subtle violations
 *
 * Both must pass for the report to be served.
 */

/**
 * Layer 1: Heuristic scanner.
 *
 * Fast regex-based check for phrases that should never appear in output.
 * This catches obvious violations instantly. The patterns are conservative —
 * better to flag a false positive than miss a real violation.
 */
function heuristicSafetyCheck(report) {
  const violations = [];

  // Directive language patterns
  const directivePatterns = [
    /\byou should\b/i,
    /\byou need to\b/i,
    /\byou must\b/i,
    /\btry (?:to |doing|taking|eating|increasing|decreasing)\b/i,
    /\bI (?:recommend|suggest|advise)\b/i,
    /\bconsider (?:taking|starting|stopping|changing|adjusting)\b/i,
    /\bmake sure (?:you|to)\b/i,
    /\bit(?:'s| is) important (?:that you|to)\b/i,
  ];

  for (const pattern of directivePatterns) {
    const match = report.match(pattern);
    if (match) {
      violations.push({
        type: "directive_language",
        matched: match[0],
        severity: "high",
      });
    }
  }

  // Medication/drug name patterns — should never appear
  const drugPatterns = [
    /\btirzepatide\b/i,
    /\bsemaglutide\b/i,
    /\bmounjaro\b/i,
    /\bozempic\b/i,
    /\bwegovy\b/i,
    /\bzepbound\b/i,
    /\bglp-?1\b/i,
    /\bmetformin\b/i,
    /\borlistat\b/i,
    /\bphentermine\b/i,
    /\bcontrave\b/i,
    /\bsaxenda\b/i,
    // Generic pattern for "take [any] medication"
    /\btake (?:your |the |this )?\w*(?:medication|medicine|drug|pill|injection|dose)\b/i,
  ];

  for (const pattern of drugPatterns) {
    const match = report.match(pattern);
    if (match) {
      violations.push({
        type: "medication_reference",
        matched: match[0],
        severity: "critical",
      });
    }
  }

  // Causal claim patterns
  const causalPatterns = [
    /\bthis (?:causes?|leads? to|results? in)\b/i,
    /\byou(?:'re| are) (?:likely |probably )?(?:experiencing|suffering|developing)\b/i,
    /\byour (?:condition|diagnosis|symptoms? (?:indicate|suggest))\b/i,
  ];

  for (const pattern of causalPatterns) {
    const match = report.match(pattern);
    if (match) {
      violations.push({
        type: "causal_claim",
        matched: match[0],
        severity: "high",
      });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Layer 2: LLM safety classifier.
 *
 * WHY A SEPARATE LLM CALL:
 * The generating model and the evaluating model should be independent.
 * If the generator "decided" to give medical advice despite the prompt,
 * it's already in a mode where it's not following instructions. A fresh
 * model call with a different, focused prompt is more reliable.
 */
async function llmSafetyCheck(report) {
  const classifierPrompt = `You are a safety classifier for a health-adjacent application. Your job is to determine whether the following report contains any of these violations:

1. MEDICAL ADVICE: Direct or implied recommendations about treatment, medication, dosage, or medical decisions.
2. DRUG REFERENCES: Any mention of specific medications or pharmaceutical names.
3. DIAGNOSES: Any statement that diagnoses or implies a medical condition.
4. DIRECTIVE LANGUAGE: Any "you should" / "you need to" / "try doing" style recommendations.
5. UNSOURCED CLAIMS: Factual claims about health/medicine that don't cite a specific source within the same paragraph of text.

It is acceptable for the report to reference claims made by a study as long as the study is referenced within the same paragraph as the claim.

NOTE: The sentence "Some of the patterns in your data may be worth discussing with your healthcare provider" is a mandatory safety disclaimer and should NOT be flagged as directive language.

Respond with EXACTLY this JSON format and nothing else:
{"safe": true/false, "violations": ["description of each violation found"]}

If the report is safe, respond: {"safe": true, "violations": []}`;

  try {
    const response = await callLLM(classifierPrompt, `REPORT TO EVALUATE:\n\n${report}`);
    // Strip markdown fences if present
    const cleaned = response.replace(/```json\s*|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    // If the classifier fails, fail CLOSED — reject the report.
    // This is a deliberate safety decision: uncertainty = rejection.
    console.error("Safety classifier failed:", err.message);
    return {
      safe: false,
      violations: ["Safety classifier failed — report rejected by default"],
    };
  }
}

// ---------------------------------------------------------------------------
// Main report generation
// ---------------------------------------------------------------------------

/**
 * Generate a complete insight report for a user.
 *
 * @param {Object[]} patterns — from detectPatterns()
 * @param {Object[]} retrievedChunks — from retrieveContext()
 * @returns {Object} The report object with content, sources, and safety status
 */
export async function generateReport(patterns, retrievedChunks) {
  console.log("Generating report...");

  // Skip generation if we have no patterns or no context
  if (patterns.length === 0) {
    return {
      status: "skipped",
      reason: "Insufficient data to detect patterns",
      content: null,
    };
  }

  if (retrievedChunks.length === 0) {
    return {
      status: "skipped",
      reason: "No relevant literature found for detected patterns",
      content: null,
    };
  }

  // Assemble and send to LLM
  const userMessage = buildUserMessage(patterns, retrievedChunks);
  const reportContent = await callLLM(SYSTEM_PROMPT, userMessage);

  console.log("Report generated. Running safety validation...");

  // Layer 1: Heuristic check (instant, free)
  const heuristicResult = heuristicSafetyCheck(reportContent);
  if (!heuristicResult.passed) {
    console.warn(
      "HEURISTIC SAFETY CHECK FAILED:",
      JSON.stringify(heuristicResult.violations, null, 2)
    );
    return {
      status: "rejected",
      reason: "Failed heuristic safety check",
      violations: heuristicResult.violations,
      content: null,
      // Store the raw content for debugging — but NEVER serve it
      _debug_rawContent: reportContent,
    };
  }

  console.log("  Heuristic check: PASSED");

  // Layer 2: LLM classifier
  const classifierResult = await llmSafetyCheck(reportContent);
  if (!classifierResult.safe) {
    console.warn(
      "LLM SAFETY CLASSIFIER FAILED:",
      JSON.stringify(classifierResult.violations, null, 2)
    );
    return {
      status: "rejected",
      reason: "Failed LLM safety classifier",
      violations: classifierResult.violations,
      content: null,
      _debug_rawContent: reportContent,
    };
  }

  console.log("  LLM classifier: PASSED");

  // Both checks passed — report is safe to serve
  return {
    status: "approved",
    content: reportContent,
    generatedAt: new Date().toISOString(),
    patternsAnalyzed: patterns.map((p) => p.type),
    sourcesUsed: retrievedChunks.map((c) => ({
      title: c.metadata.title,
      journal: c.metadata.journal,
      year: c.metadata.year,
      url: c.metadata.pubmedUrl,
      relevanceScore: c.score,
    })),
  };
}
