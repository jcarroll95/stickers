/**
 * generateInsightReport.js
 *
 * Top-level orchestrator that ties the full pipeline together.
 * This is what you'd call from a cron job, a queue worker, or
 * an API endpoint.
 *
 * Usage:
 *   node generateInsightReport.js <userId>
 *
 * Or import and call programmatically:
 *   import { generateInsightForUser } from './generateInsightReport.js';
 *   const report = await generateInsightForUser(userId);
 *
 * Required env vars:
 *   OPENAI_API_KEY
 *   MONGO_URI
 */

import { MongoClient, ObjectId } from "mongodb";
import { detectPatterns, buildRetrievalQueries } from "./patternDetector.js";
import { retrieveContext } from "./retriever.js";
import { generateReport } from "./reportGenerator.js";
import dotenv from 'dotenv';
dotenv.config({ path: '../../apps/api/config/config.env' });
// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DB_NAME = "test";

// How far back to look for user data (in days)
const LOOKBACK_DAYS = 900;

// ---------------------------------------------------------------------------
// User data fetching
// ---------------------------------------------------------------------------

/**
 * Fetch a user's recent logged data from MongoDB.
 *
 * This version is updated to match the Stickerboards LogEntry schema.
 */
async function fetchUserData(db, userId) {
  const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  // All qualitative data is in the 'logentries' collection
  // Query both as ObjectId and as a fallback string to be durable against import type differences
  const allLogs = await db
    .collection("logentries")
    .find({
      $or: [
        { user: userObjectId },
        { user: userId.toString() }
      ]
    })
    .sort({ userDate: 1 })
    .toArray();

  const weights = allLogs
    .filter(l => l.type === 'weight')
    .map(l => ({ date: l.userDate, value: l.weight }));

  const moods = allLogs
    .filter(l => l.type === 'mood')
    .map(l => ({ date: l.userDate, value: l.content }));

  const sleepLogs = allLogs
    .filter(l => l.type === 'sleep')
    .map(l => ({ date: l.userDate, value: l.content }));

  const sideEffects = allLogs
    .filter(l => l.type === 'side-effect')
    .map(l => ({ date: l.userDate, effects: [l.content] }));

  const activityLogs = allLogs
    .filter(l => l.type === 'activity')
    .map(l => ({ date: l.userDate, content: l.content }));

  // Check-ins: any log entry
  const checkIns = allLogs.map(l => ({ userDate: l.userDate }));

  console.log(`  DEBUG: Found ${allLogs.length} total logs for user.`);
  console.log(`    Weights: ${weights.length}, Moods: ${moods.length}, Sleep: ${sleepLogs.length}, Side Effects: ${sideEffects.length}, Activity: ${activityLogs.length}`);
  console.log(`    Data dates: ${allLogs.length > 0 ? allLogs[0].userDate : 'N/A'} to ${allLogs.length > 0 ? allLogs[allLogs.length-1].userDate : 'N/A'}`);

  return {
    weights: weights.map((w) => ({
      date: new Date(w.date).toISOString().split("T")[0],
      value: w.value,
    })),
    moods: moods.map((m) => ({
      date: new Date(m.date).toISOString().split("T")[0],
      value: m.value,
    })),
    sleepLogs: sleepLogs.map((s) => ({
      date: new Date(s.date).toISOString().split("T")[0],
      value: s.value,
    })),
    sideEffects: sideEffects.map((se) => ({
      date: new Date(se.date).toISOString().split("T")[0],
      effects: se.effects,
    })),
    activityLogs: activityLogs.map((a) => ({
      date: new Date(a.date).toISOString().split("T")[0],
      content: a.content,
    })),
    checkIns: checkIns.map((c) => ({
      date: new Date(c.userDate).toISOString().split("T")[0],
    })),
  };
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export async function generateInsightForUser(userId) {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGODB_URI is required");

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // Step 1: Fetch user data
    console.log(`\n=== Insight Report for User ${userId} ===\n`);
    console.log("Step 1: Fetching user data...");
    const userData = await fetchUserData(db, userId);
    console.log(
      `  Weights: ${userData.weights.length}, Moods: ${userData.moods.length}, ` +
        `Sleep: ${userData.sleepLogs.length}, Check-ins: ${userData.checkIns.length}`
    );

    // Step 2: Detect patterns (pure local computation — no API calls)
    console.log("\nStep 2: Detecting patterns...");
    const patterns = detectPatterns(userData);
    console.log(`  Detected ${patterns.length} patterns:`);
    for (const p of patterns) {
      console.log(`    - ${p.type}: ${JSON.stringify(p)}`);
    }

    if (patterns.length === 0) {
      console.log("  No patterns detected. Skipping report generation.");
      return {
        userId,
        status: "skipped",
        reason: "Insufficient data for pattern detection",
      };
    }

    // Step 3: Build retrieval queries from patterns
    console.log("\nStep 3: Building retrieval queries...");
    const queries = buildRetrievalQueries(patterns);
    console.log(`  Generated ${queries.length} queries:`);
    for (const q of queries) {
      console.log(`    [P${q.priority}] "${q.query}"`);
      console.log(`           Reason: ${q.reason}`);
    }

    // Step 4: Retrieve relevant literature via vector search
    console.log("\nStep 4: Retrieving literature...");
    const retrievedChunks = await retrieveContext(queries, mongoUri);

    // Step 5: Generate and validate the report
    console.log("\nStep 5: Generating report...");
    const report = await generateReport(patterns, retrievedChunks);

    // Step 6: Store the report
    if (report.status === "approved") {
      console.log(report);
      console.log("\nStep 6: Storing approved report...");
      await db.collection("insightReports").insertOne({
        userId,
        ...report,
        createdAt: new Date(),
      });
      console.log("  Report stored successfully.");
    } else {
      console.log(report);
      console.log(`\nReport not stored — status: ${report.status}`);
      if (report.violations) {
        console.log("  Violations:", JSON.stringify(report.violations));
      }

      // Store the rejection for auditing
      await db.collection("insightReportAudit").insertOne({
        userId,
        status: report.status,
        reason: report.reason,
        violations: report.violations || [],
        attemptedAt: new Date(),
      });
    }

    return { userId, ...report };
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const userId = process.argv[2];
if (userId) {
  generateInsightForUser(userId)
    .then((result) => {
      console.log("\n=== RESULT ===");
      if (result.content) {
        console.log(result.content);
      } else {
        console.log(`Status: ${result.status}`);
        console.log(`Reason: ${result.reason}`);
      }
    })
    .catch(console.error);
}
