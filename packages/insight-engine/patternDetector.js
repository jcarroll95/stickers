/**
 * patternDetector.js
 *
 * Analyzes a user's recent logged data to detect patterns BEFORE
 * touching the LLM or vector search.
 *
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a numeric rating (1-5) from potentially string-formatted content.
 * Handles:
 * - Pure numbers (3)
 * - Strings with rating first ("5, this is my text")
 * - Strings that are just the rating ("3")
 * Defaults to 3 if input is invalid or missing.
 */
function parseRating(val) {
  if (val === null || val === undefined) return 3;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const firstChar = val.trim().charAt(0);
    const num = parseInt(firstChar, 10);
    if (!isNaN(num) && num >= 1 && num <= 5) return num;
  }
  return 3;
}

// ---------------------------------------------------------------------------
// Pattern detectors
// ---------------------------------------------------------------------------

/**
 * Detect weight plateau.
 *
 * Definition: 30+ days where weight variance is < 1% of mean weight.
 * This is a deliberately simple heuristic.
 * (e.g., someone losing 0.1lb/day consistently would NOT trigger this,
 * which is correct — that's slow loss, not a plateau).
 */
function detectPlateau(weights) {
  if (weights.length < 7) return null;

  // Use the most recent 14 entries (or all if fewer)
  const recent = weights.slice(-30);
  const values = recent.map((w) => w.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const coeffOfVariation = Math.sqrt(variance) / mean;

  // Also check: is there a downward trend despite low variance?
  // If the last 7 readings are all below the mean, it might be
  // slow progress, not a true stall.
  const lastThree = values.slice(-7);
  const slowlyDecreasing = lastThree.every((v) => v < mean);

  if (coeffOfVariation < 0.01 && !slowlyDecreasing) {
    const daysOnPlateau = recent.length;
    const plateauWeight = mean;
    return {
      type: "plateau",
      daysOnPlateau,
      plateauWeight: Math.round(plateauWeight * 10) / 10,
      confidence: coeffOfVariation < 0.005 ? "high" : "moderate",
    };
  }

  return null;
}

/**
 * Detect overall weight trend direction and rate.
 */
function detectWeightTrend(weights) {
  if (weights.length < 5) return null;

  const recent = weights.slice(-30);
  const values = recent.map((w) => w.value);

  // Simple linear regression — we don't need anything fancier
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) * (i - xMean);
  }
  const slope = numerator / denominator;

  // Slope is in units per entry. Convert to approximate weekly rate
  // assuming roughly daily weigh-ins.
  const weeklyRate = slope * 7;

  let direction;
  if (weeklyRate < -0.5) direction = "losing";
  else if (weeklyRate > 0.5) direction = "gaining";
  else direction = "stable";

  return {
    type: "weight_trend",
    direction,
    weeklyRate: Math.round(weeklyRate * 100) / 100,
    totalChange:
      Math.round((values[values.length - 1] - values[0]) * 10) / 10,
  };
}

/**
 * Detect mood patterns and mood-weight correlation.
 *
 * Mood is stored as 1-5 (frown to happy). We look for:
 * - Overall mood trend (improving, declining, stable)
 * - Days where low mood coincides with weight increases
 */
function detectMoodPatterns(moods, weights) {
  if (moods.length < 5) return null;

  const recent = moods.slice(-14);
  const values = recent.map((m) => parseRating(m.value));
  const avgMood = values.reduce((a, b) => a + b, 0) / values.length;

  // Trend: compare first half average to second half average
  const midpoint = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, midpoint);
  const secondHalf = values.slice(midpoint);
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  let trend;
  if (secondAvg - firstAvg > 0.5) trend = "improving";
  else if (firstAvg - secondAvg > 0.5) trend = "declining";
  else trend = "stable";

  // Check for low mood days (1-2 on the scale)
  const lowMoodDays = values.filter((v) => v <= 2).length;
  const lowMoodFrequency = lowMoodDays / values.length;

  const pattern = {
    type: "mood",
    averageMood: Math.round(avgMood * 10) / 10,
    trend,
    lowMoodFrequency: Math.round(lowMoodFrequency * 100),
  };

  // Correlate with weight if we have overlapping dates
  if (weights.length >= 5) {
    const moodByDate = new Map(recent.map((m) => [m.date, parseRating(m.value)]));
    const weightByDate = new Map(
      weights.slice(-14).map((w) => [w.date, w.value])
    );

    let correlatedDays = 0;
    let lowMoodHighWeight = 0;

    for (const [date, mood] of moodByDate) {
      if (weightByDate.has(date)) {
        correlatedDays++;
        // "High weight" = above the period's mean
        const weightMean =
          weights
            .slice(-14)
            .map((w) => w.value)
            .reduce((a, b) => a + b, 0) / weights.slice(-14).length;
        if (mood <= 2 && weightByDate.get(date) > weightMean) {
          lowMoodHighWeight++;
        }
      }
    }

    if (correlatedDays >= 5 && lowMoodHighWeight / correlatedDays > 0.3) {
      pattern.moodWeightCorrelation = true;
    }
  }

  return pattern;
}

/**
 * Detect sleep patterns.
 * Same scale as mood (1-5), same analysis approach.
 */
function detectSleepPatterns(sleepLogs) {
  if (sleepLogs.length < 5) return null;

  const recent = sleepLogs.slice(-14);
  const values = recent.map((s) => parseRating(s.value));
  const avgSleep = values.reduce((a, b) => a + b, 0) / values.length;

  const poorSleepDays = values.filter((v) => v <= 2).length;
  const poorSleepFrequency = poorSleepDays / values.length;

  // Trend
  const midpoint = Math.floor(values.length / 2);
  const firstAvg =
    values.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint;
  const secondAvg =
    values.slice(midpoint).reduce((a, b) => a + b, 0) /
    (values.length - midpoint);

  let trend;
  if (secondAvg - firstAvg > 0.5) trend = "improving";
  else if (firstAvg - secondAvg > 0.5) trend = "declining";
  else trend = "stable";

  return {
    type: "sleep",
    averageSleep: Math.round(avgSleep * 10) / 10,
    trend,
    poorSleepFrequency: Math.round(poorSleepFrequency * 100),
  };
}

/**
 * Detect engagement patterns from check-in timestamps.
 *
*/
function detectEngagementPatterns(checkIns) {
  if (checkIns.length < 7) return null;

  // Calculate days between consecutive check-ins
  const gaps = [];
  for (let i = 1; i < checkIns.length; i++) {
    const prev = new Date(checkIns[i - 1].date);
    const curr = new Date(checkIns[i].date);
    const daysBetween = (curr - prev) / (1000 * 60 * 60 * 24);
    gaps.push(daysBetween);
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

  // Compare recent gap to earlier gap — is engagement dropping?
  const recentGaps = gaps.slice(-5);
  const earlierGaps = gaps.slice(0, Math.max(gaps.length - 5, 1));
  const recentAvg = recentGaps.reduce((a, b) => a + b, 0) / recentGaps.length;
  const earlierAvg =
    earlierGaps.reduce((a, b) => a + b, 0) / earlierGaps.length;

  let trend;
  if (recentAvg > earlierAvg * 1.5) trend = "declining";
  else if (recentAvg < earlierAvg * 0.75) trend = "increasing";
  else trend = "stable";

  // Total duration on platform
  const firstDate = new Date(checkIns[0].date);
  const lastDate = new Date(checkIns[checkIns.length - 1].date);
  const totalWeeks = Math.round(
    (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 7)
  );

  return {
    type: "engagement",
    averageGapDays: Math.round(avgGap * 10) / 10,
    trend,
    totalWeeks,
    totalCheckIns: checkIns.length,
  };
}

/**
 * Detect side effect patterns.
 * Side effects are logged as categories (nausea, fatigue, etc.)
 * We look for frequency and whether they're increasing or decreasing.
 */
function detectSideEffectPatterns(sideEffects) {
  if (sideEffects.length < 3) return null;

  // Count by category
  const counts = {};
  for (const entry of sideEffects) {
    for (const effect of entry.effects) {
      counts[effect] = (counts[effect] || 0) + 1;
    }
  }

  // Find most common
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const mostCommon = sorted.slice(0, 3).map(([effect, count]) => ({
    effect,
    count,
    frequency: Math.round((count / sideEffects.length) * 100),
  }));

  // Trend: are reports increasing or decreasing?
  const midpoint = Math.floor(sideEffects.length / 2);
  const firstHalfCount = sideEffects
    .slice(0, midpoint)
    .reduce((sum, e) => sum + e.effects.length, 0);
  const secondHalfCount = sideEffects
    .slice(midpoint)
    .reduce((sum, e) => sum + e.effects.length, 0);

  let trend;
  if (secondHalfCount > firstHalfCount * 1.3) trend = "increasing";
  else if (secondHalfCount < firstHalfCount * 0.7) trend = "decreasing";
  else trend = "stable";

  return {
    type: "side_effects",
    mostCommon,
    trend,
    totalReports: sideEffects.length,
  };
}

/**
 * Detect physical activity patterns.
 * Activity is now logged as a 1-5 rating (how much/intense).
 * 3+ is considered "active" for simple binary heuristics.
 */
function detectActivityPatterns(activityLogs) {
  if (activityLogs.length < 5) return null;

  const recent = activityLogs.slice(-14);
  const values = recent.map((a) => parseRating(a.value || a.content));
  const activeDays = values.filter((v) => v >= 3).length;
  const activeRate = activeDays / recent.length;

  return {
    type: "activity",
    averageIntensity: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
    activeDaysPercent: Math.round(activeRate * 100),
    activeDaysCount: activeDays,
    totalDays: recent.length,
  };
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run all detectors against a user's data and return detected patterns.
 *
 * @param {Object} userData — the user's recent logs, shaped like:
 *   {
 *     weights: [{ date: "2025-01-15", value: 185.2 }, ...],
 *     moods: [{ date: "2025-01-15", value: 3 }, ...],
 *     sleepLogs: [{ date: "2025-01-15", value: 4 }, ...],
 *     sideEffects: [{ date: "2025-01-15", effects: ["nausea", "fatigue"] }, ...],
 *     activityLogs: [{ date: "2025-01-15", wasActive: true }, ...],
 *     checkIns: [{ date: "2025-01-15" }, ...],  // any logged interaction
 *   }
 *
 * @returns {Object[]} Array of detected pattern objects
 */
export function detectPatterns(userData) {
  const patterns = [];

  const plateau = detectPlateau(userData.weights || []);
  if (plateau) patterns.push(plateau);

  const trend = detectWeightTrend(userData.weights || []);
  if (trend) patterns.push(trend);

  const mood = detectMoodPatterns(
    userData.moods || [],
    userData.weights || []
  );
  if (mood) patterns.push(mood);

  const sleep = detectSleepPatterns(userData.sleepLogs || []);
  if (sleep) patterns.push(sleep);

  const engagement = detectEngagementPatterns(userData.checkIns || []);
  if (engagement) patterns.push(engagement);

  const sideEffects = detectSideEffectPatterns(userData.sideEffects || []);
  if (sideEffects) patterns.push(sideEffects);

  const activity = detectActivityPatterns(userData.activityLogs || []);
  if (activity) patterns.push(activity);

  return patterns;
}

// ---------------------------------------------------------------------------
// Query builder — translates patterns into vector search queries
// ---------------------------------------------------------------------------

/**
 * Convert detected patterns into retrieval queries for vector search.
 *
 * THIS IS THE KEY ENGINEERING DECISION IN THE WHOLE PIPELINE.
 *
 * Each pattern maps to 1-2 specific retrieval queries. The queries are
 * written in "literature language" — terms that will semantically match
 * PubMed abstracts — not user language. This is why vector search earns
 * its keep: the user never writes these queries, and the patterns are
 * expressed in clinical/research vocabulary that bridges to the corpus.
 *
 * We cap at 5 queries per report to control cost and context window size.
 * Patterns are prioritized: actionable patterns (plateau, declining
 * engagement) rank higher than stable/positive ones.
 */
export function buildRetrievalQueries(patterns) {
  const queryMap = [];

  for (const pattern of patterns) {
    switch (pattern.type) {
      case "plateau":
        queryMap.push({
          query:
            "weight loss plateau psychological impact self-monitoring",
          reason: `Plateau detected: ${pattern.daysOnPlateau} days at ~${pattern.plateauWeight}lbs`,
          priority: 1,
        });
        break;

      case "weight_trend":
        if (pattern.direction === "losing" && pattern.weeklyRate < -2) {
          queryMap.push({
            query: "rapid weight loss health risks sustainability",
            reason: `Rapid loss: ${pattern.weeklyRate} lbs/week`,
            priority: 2,
          });
        } else if (pattern.direction === "gaining") {
          queryMap.push({
            query:
              "weight regain behavioral factors prevention",
            reason: `Weight trending up: ${pattern.weeklyRate} lbs/week`,
            priority: 1,
          });
        } else if (pattern.direction === "losing") {
          queryMap.push({
            query:
              "sustained weight loss behavioral predictors",
            reason: `Steady loss: ${pattern.weeklyRate} lbs/week`,
            priority: 3,
          });
        }
        break;

      case "mood":
        if (pattern.trend === "declining" || pattern.lowMoodFrequency > 40) {
          queryMap.push({
            query: "mood changes during weight loss emotional wellbeing",
            reason: `Declining mood trend, ${pattern.lowMoodFrequency}% low-mood days`,
            priority: 1,
          });
        }
        if (pattern.moodWeightCorrelation) {
          queryMap.push({
            query:
              "emotional eating weight fluctuation mood correlation",
            reason: "Detected mood-weight correlation",
            priority: 2,
          });
        }
        break;

      case "sleep":
        if (pattern.poorSleepFrequency > 30) {
          queryMap.push({
            query: "poor sleep quality weight loss outcomes adherence",
            reason: `Poor sleep on ${pattern.poorSleepFrequency}% of days`,
            priority: 2,
          });
        }
        break;

      case "engagement":
        if (pattern.trend === "declining") {
          queryMap.push({
            query:
              "self-monitoring frequency weight loss adherence dropout",
            reason: `Engagement declining: avg gap ${pattern.averageGapDays} days`,
            priority: 1,
          });
        }
        if (pattern.totalWeeks > 26) {
          queryMap.push({
            query:
              "long term weight management maintenance behavioral factors",
            reason: `${pattern.totalWeeks} weeks on platform`,
            priority: 3,
          });
        }
        break;

      case "side_effects":
        if (pattern.trend === "increasing") {
          // Generic symptom queries — deliberately NOT drug-specific
          queryMap.push({
            query:
              "managing symptoms during weight loss fatigue nausea",
            reason: `Side effects increasing: ${pattern.mostCommon.map((s) => s.effect).join(", ")}`,
            priority: 2,
          });
        }
        break;

      case "activity":
        if (pattern.activeDaysPercent < 30) {
          queryMap.push({
            query: "physical activity barriers weight management",
            reason: `Active only ${pattern.activeDaysPercent}% of days`,
            priority: 2,
          });
        } else if (pattern.activeDaysPercent > 60) {
          queryMap.push({
            query:
              "regular physical activity weight loss mood benefits",
            reason: `Active ${pattern.activeDaysPercent}% of days`,
            priority: 3,
          });
        }
        break;
    }
  }

  // Sort by priority (1 = highest), take top 5
  return queryMap.sort((a, b) => a.priority - b.priority).slice(0, 5);
}
