/**
 * seedTestData.mjs
 *
 * Generates realistic, pattern-controlled test data for validating the
 * insight pipeline. Uses deterministic archetypes so you KNOW which
 * users should trigger which patterns.
 *
 * Usage: node seedTestData.mjs
 *
 * Outputs JSON files to ./data/seed/ that can be imported via mongoimport,
 * or connects directly to MongoDB if MONGODB_URI is set.
 *
 * WHY NOT USE AN LLM FOR THIS:
 * You need precise control over data distributions. If detectPlateau()
 * should fire for users with 14+ days of <1% weight variance, you need
 * to KNOW which users have that pattern. A deterministic generator with
 * defined archetypes gives you a ground truth table you can test against.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { MongoClient, ObjectId } from "mongodb";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const OUTPUT_DIR = "../../data/seedInsights";
const DB_NAME = "test";
const NUM_USERS = 100;

/**
 * SEEDED RANDOM NUMBER GENERATOR
 *
 * We use a simple mulberry32 PRNG seeded with a fixed value.
 * This means every run produces identical data — critical for
 * reproducible test results. If a test fails, you can re-run
 * the seed and get the exact same dataset.
 *
 * In an interview: "I used a seeded PRNG so the test data is
 * deterministic and test failures are reproducible."
 */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42); // Fixed seed for reproducibility

// Helpers using seeded RNG
function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function randFloat(min, max) {
  return min + rand() * (max - min);
}
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}
function chance(probability) {
  return rand() < probability;
}

// Generate a date N days ago from a reference point
function daysAgo(days, from = new Date("2025-05-15")) {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return d;
}

// ---------------------------------------------------------------------------
// User archetypes
// ---------------------------------------------------------------------------

/**
 * Each archetype defines the PATTERN PROFILE for a group of users.
 * This is the ground truth for your test suite.
 *
 * After seeding, you can assert:
 *   "All users with archetype 'plateau_frustrated' should trigger
 *    the 'plateau' pattern detector AND the 'mood declining' detector."
 *
 * The distribution is weighted to give you enough of each archetype
 * to validate, while keeping the overall dataset realistic.
 */
const ARCHETYPES = [
  {
    name: "steady_loser",
    count: 20,
    description: "Consistent weight loss, good engagement, stable mood",
    effortWeeks: () => randInt(12, 40),
    startWeight: () => randFloat(200, 280),
    weeklyLossRate: () => randFloat(0.8, 1.5), // lbs/week
    plateauAtWeek: null,
    moodBase: () => randInt(3, 5),
    moodTrend: "stable",
    sleepBase: () => randInt(3, 5),
    engagementPattern: "consistent", // logs most days
    activityRate: () => randFloat(0.4, 0.7), // % of days active
    sideEffectRate: () => randFloat(0.05, 0.15),
    expectedPatterns: ["weight_trend:losing"],
  },
  {
    name: "plateau_frustrated",
    count: 15,
    description: "Was losing, hit plateau, mood declining, engagement dropping",
    effortWeeks: () => randInt(10, 30),
    startWeight: () => randFloat(210, 270),
    weeklyLossRate: () => randFloat(1.0, 2.0),
    plateauAtWeek: (totalWeeks) => Math.floor(totalWeeks * 0.6), // plateau at 60% mark
    plateauDurationWeeks: () => randInt(2, 5),
    moodBase: () => randInt(2, 4),
    moodTrend: "declining",
    sleepBase: () => randInt(2, 4),
    engagementPattern: "declining", // starts frequent, gaps widen
    activityRate: () => randFloat(0.2, 0.4),
    sideEffectRate: () => randFloat(0.1, 0.25),
    expectedPatterns: ["plateau", "mood:declining", "engagement:declining"],
  },
  {
    name: "rapid_loser",
    count: 10,
    description: "Losing weight too fast, potential concern flag",
    effortWeeks: () => randInt(6, 16),
    startWeight: () => randFloat(240, 300),
    weeklyLossRate: () => randFloat(2.5, 4.0), // aggressive
    plateauAtWeek: null,
    moodBase: () => randInt(3, 5),
    moodTrend: "stable",
    sleepBase: () => randInt(2, 4),
    engagementPattern: "consistent",
    activityRate: () => randFloat(0.3, 0.6),
    sideEffectRate: () => randFloat(0.2, 0.4), // more side effects
    expectedPatterns: ["weight_trend:rapid_loss", "side_effects:increasing"],
  },
  {
    name: "regainer",
    count: 10,
    description: "Lost weight, now gaining back",
    effortWeeks: () => randInt(16, 40),
    startWeight: () => randFloat(220, 260),
    weeklyLossRate: () => randFloat(1.0, 1.5), // initial loss
    regainAtWeek: (totalWeeks) => Math.floor(totalWeeks * 0.5),
    weeklyGainRate: () => randFloat(0.5, 1.5),
    moodBase: () => randInt(2, 3),
    moodTrend: "declining",
    sleepBase: () => randInt(2, 4),
    engagementPattern: "declining",
    activityRate: () => randFloat(0.1, 0.3),
    sideEffectRate: () => randFloat(0.05, 0.1),
    expectedPatterns: ["weight_trend:gaining", "mood:declining", "engagement:declining"],
  },
  {
    name: "high_engagement_stable",
    count: 15,
    description: "Logs religiously, moderate results, good mood",
    effortWeeks: () => randInt(20, 52),
    startWeight: () => randFloat(180, 230),
    weeklyLossRate: () => randFloat(0.3, 0.8), // slow and steady
    plateauAtWeek: null,
    moodBase: () => randInt(3, 5),
    moodTrend: "improving",
    sleepBase: () => randInt(3, 5),
    engagementPattern: "high", // logs every day, sometimes twice
    activityRate: () => randFloat(0.6, 0.9),
    sideEffectRate: () => randFloat(0.02, 0.08),
    expectedPatterns: ["engagement:high", "activity:high"],
  },
  {
    name: "low_engagement_dropout",
    count: 15,
    description: "Started strong, barely logs anymore",
    effortWeeks: () => randInt(8, 30),
    startWeight: () => randFloat(200, 260),
    weeklyLossRate: () => randFloat(0.5, 1.5),
    plateauAtWeek: null,
    moodBase: () => randInt(2, 4),
    moodTrend: "stable",
    sleepBase: () => randInt(2, 4),
    engagementPattern: "dropout", // first few weeks active, then sparse
    activityRate: () => randFloat(0.1, 0.2),
    sideEffectRate: () => randFloat(0.05, 0.15),
    expectedPatterns: ["engagement:declining"],
  },
  {
    name: "mood_weight_correlated",
    count: 10,
    description: "Clear correlation between low mood days and weight spikes",
    effortWeeks: () => randInt(10, 30),
    startWeight: () => randFloat(190, 250),
    weeklyLossRate: () => randFloat(0.5, 1.2),
    plateauAtWeek: null,
    moodBase: () => randInt(2, 4),
    moodTrend: "volatile", // mood swings
    sleepBase: () => randInt(2, 4),
    engagementPattern: "consistent",
    activityRate: () => randFloat(0.2, 0.5),
    sideEffectRate: () => randFloat(0.1, 0.2),
    expectedPatterns: ["mood:moodWeightCorrelation"],
  },
  {
    name: "new_user",
    count: 5,
    description: "Just started, minimal data — should trigger 'insufficient data'",
    effortWeeks: () => randInt(1, 2),
    startWeight: () => randFloat(180, 280),
    weeklyLossRate: () => randFloat(0.5, 2.0),
    plateauAtWeek: null,
    moodBase: () => randInt(3, 5),
    moodTrend: "stable",
    sleepBase: () => randInt(3, 5),
    engagementPattern: "consistent",
    activityRate: () => randFloat(0.3, 0.6),
    sideEffectRate: () => randFloat(0.05, 0.1),
    expectedPatterns: [], // not enough data for any pattern
  },
];

// Validate counts sum to NUM_USERS
const totalArchetypeUsers = ARCHETYPES.reduce((sum, a) => sum + a.count, 0);
if (totalArchetypeUsers !== NUM_USERS) {
  throw new Error(
    `Archetype counts sum to ${totalArchetypeUsers}, expected ${NUM_USERS}`
  );
}

// ---------------------------------------------------------------------------
// Data generators
// ---------------------------------------------------------------------------

function generateUsers() {
  const users = [];
  let userIndex = 0;

  for (const archetype of ARCHETYPES) {
    for (let i = 0; i < archetype.count; i++) {
      const id = new ObjectId();
      users.push({
        _id: id,
        name: `TestUser_${archetype.name}_${i}`,
        email: `test_${archetype.name}_${i}@seed.local`,
        password: "$2a$10$fakehashfakehashfakehashfakehashfakehashfakehas", // placeholder
        role: "user",
        isVerified: true,
        cheersStickers: [0, 1, 2, 3, 4],
        momentumBalance: randInt(0, 500),
        createdAt: daysAgo(archetype.effortWeeks() * 7),
        // Track archetype for validation — NOT part of your real User schema,
        // but useful in the seed data for testing assertions.
        _archetype: archetype.name,
        _expectedPatterns: archetype.expectedPatterns,
      });
      userIndex++;
    }
  }

  return users;
}

function generateStickerboard(user) {
  return {
    _id: new ObjectId(),
    user: user._id,
    name: `${user.name}'s Board`,
    slug: `${user.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-board`,
    description: "Test stickerboard for seed data",
    createdAt: user.createdAt,
    tags: ["test"],
    width: 1000,
    height: 700,
    stickers: [],
  };
}

/**
 * Generate weight entries following the archetype's trajectory.
 *
 * This is where the archetype patterns get baked into data:
 * - steady_loser: linear decline with small daily noise
 * - plateau_frustrated: decline → flat → decline resumes
 * - rapid_loser: steep decline
 * - regainer: decline → increase
 * - mood_weight_correlated: decline with spikes on low-mood days (generated later, linked)
 */
function generateWeightEntries(user, board, archetype) {
  const effortWeeks =
    (new Date("2025-05-15") - new Date(user.createdAt)) /
    (1000 * 60 * 60 * 24 * 7);
  const totalDays = Math.round(effortWeeks * 7);
  const startWeight = archetype.startWeight();
  const weeklyLoss = archetype.weeklyLossRate();

  const entries = [];
  let currentWeight = startWeight;

  // Determine engagement gaps based on archetype
  const logProbability = getLogProbability(archetype, totalDays);

  for (let day = 0; day < totalDays; day++) {
    // Should we log today? Based on engagement pattern
    if (!chance(logProbability(day))) continue;

    const weekNum = day / 7;

    // Calculate target weight based on archetype trajectory
    if (archetype.name === "plateau_frustrated") {
      const plateauStart = archetype.plateauAtWeek(Math.round(effortWeeks));
      const plateauDuration = archetype.plateauDurationWeeks?.() || 3;
      if (weekNum >= plateauStart && weekNum < plateauStart + plateauDuration) {
        // Plateau: weight stays flat with minimal noise
        currentWeight = startWeight - plateauStart * (weeklyLoss / 7) * 7;
        currentWeight += randFloat(-0.3, 0.3); // tiny noise
      } else if (weekNum >= plateauStart + plateauDuration) {
        // Post-plateau: resume loss
        const postPlateauWeeks = weekNum - (plateauStart + plateauDuration);
        currentWeight =
          startWeight -
          plateauStart * (weeklyLoss / 7) * 7 -
          postPlateauWeeks * (weeklyLoss / 7) * 7;
        currentWeight += randFloat(-1, 1);
      } else {
        // Pre-plateau: normal loss
        currentWeight = startWeight - day * (weeklyLoss / 7);
        currentWeight += randFloat(-1, 1);
      }
    } else if (archetype.name === "regainer") {
      const regainWeek = archetype.regainAtWeek(Math.round(effortWeeks));
      const gainRate = archetype.weeklyGainRate?.() || 1.0;
      if (weekNum < regainWeek) {
        currentWeight = startWeight - day * (weeklyLoss / 7);
        currentWeight += randFloat(-1, 1);
      } else {
        // Regaining
        const lowestWeight = startWeight - regainWeek * 7 * (weeklyLoss / 7);
        const regainDays = (weekNum - regainWeek) * 7;
        currentWeight = lowestWeight + regainDays * (gainRate / 7);
        currentWeight += randFloat(-0.5, 1.5); // biased upward noise
      }
    } else {
      // Default: linear loss with daily noise
      currentWeight = startWeight - day * (weeklyLoss / 7);
      currentWeight += randFloat(-1.5, 1.5);
    }

    // Clamp to realistic range
    currentWeight = Math.max(currentWeight, 100);
    currentWeight = Math.round(currentWeight * 10) / 10;

    entries.push({
      _id: new ObjectId(),
      user: user._id,
      belongsToBoard: board._id,
      type: "weight",
      weight: currentWeight,
      userDate: daysAgo(totalDays - day),
      createdAt: daysAgo(totalDays - day),
    });
  }

  return entries;
}

/**
 * Generate mood entries that align with archetype patterns.
 * For mood_weight_correlated archetype, low mood days intentionally
 * coincide with weight spike days.
 */
function generateMoodEntries(user, board, archetype, weightEntries) {
  const totalDays =
    (new Date("2025-05-15") - new Date(user.createdAt)) /
    (1000 * 60 * 60 * 24);
  const base = archetype.moodBase();
  const logProb = getLogProbability(archetype, totalDays);
  const entries = [];

  // Build weight-by-date map for correlation archetype
  const weightByDay = new Map();
  if (weightEntries) {
    const weights = weightEntries.map((w) => w.weight);
    const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
    for (const w of weightEntries) {
      const dayKey = w.userDate.toISOString().split("T")[0];
      weightByDay.set(dayKey, w.weight > avgWeight);
    }
  }

  for (let day = 0; day < totalDays; day++) {
    if (!chance(logProb(day) * 0.7)) continue; // mood logged less often than weight

    let mood = base;
    const dayDate = daysAgo(totalDays - day);
    const dayKey = dayDate.toISOString().split("T")[0];

    // Apply trend
    const progress = day / totalDays;
    if (archetype.moodTrend === "declining") {
      mood = base - Math.floor(progress * 2); // drops ~2 points over effort
    } else if (archetype.moodTrend === "improving") {
      mood = base + Math.floor(progress * 1.5);
    } else if (archetype.moodTrend === "volatile") {
      // Swing between 1 and 5
      mood = chance(0.4) ? randInt(1, 2) : randInt(3, 5);
      // For correlated archetype: force low mood when weight is above average
      if (
        archetype.name === "mood_weight_correlated" &&
        weightByDay.get(dayKey)
      ) {
        mood = randInt(1, 2);
      }
    }

    // Add noise and clamp
    mood += randInt(-1, 1);
    mood = Math.max(1, Math.min(5, mood));

    entries.push({
      _id: new ObjectId(),
      user: user._id,
      belongsToBoard: board._id,
      type: "mood",
      content: String(mood), // store as content since LogEntry uses content for non-weight
      userDate: dayDate,
      createdAt: dayDate,
    });
  }

  return entries;
}

function generateSleepEntries(user, board, archetype) {
  const totalDays =
    (new Date("2025-05-15") - new Date(user.createdAt)) /
    (1000 * 60 * 60 * 24);
  const base = archetype.sleepBase();
  const logProb = getLogProbability(archetype, totalDays);
  const entries = [];

  for (let day = 0; day < totalDays; day++) {
    if (!chance(logProb(day) * 0.6)) continue; // sleep logged even less often

    let sleep = base + randInt(-1, 1);
    sleep = Math.max(1, Math.min(5, sleep));

    entries.push({
      _id: new ObjectId(),
      user: user._id,
      belongsToBoard: board._id,
      type: "sleep",
      content: String(sleep),
      userDate: daysAgo(totalDays - day),
      createdAt: daysAgo(totalDays - day),
    });
  }

  return entries;
}

function generateActivityEntries(user, board, archetype) {
  const totalDays =
    (new Date("2025-05-15") - new Date(user.createdAt)) /
    (1000 * 60 * 60 * 24);
  const activityRate = archetype.activityRate();
  const logProb = getLogProbability(archetype, totalDays);
  const entries = [];

  for (let day = 0; day < totalDays; day++) {
    if (!chance(logProb(day) * 0.5)) continue;

    entries.push({
      _id: new ObjectId(),
      user: user._id,
      belongsToBoard: board._id,
      type: "activity",
      content: chance(activityRate) ? "active" : "rest",
      userDate: daysAgo(totalDays - day),
      createdAt: daysAgo(totalDays - day),
    });
  }

  return entries;
}

function generateSideEffectEntries(user, board, archetype) {
  const totalDays =
    (new Date("2025-05-15") - new Date(user.createdAt)) /
    (1000 * 60 * 60 * 24);
  const rate = archetype.sideEffectRate();
  const effects = ["nausea", "fatigue", "headache", "constipation", "dizziness"];
  const entries = [];

  for (let day = 0; day < totalDays; day++) {
    if (!chance(rate)) continue;

    // For rapid_loser, side effects increase over time
    let effectCount = randInt(1, 2);
    if (archetype.name === "rapid_loser") {
      const progress = day / totalDays;
      if (progress > 0.5) effectCount = randInt(2, 3);
    }

    const dayEffects = [];
    for (let i = 0; i < effectCount; i++) {
      const e = pick(effects);
      if (!dayEffects.includes(e)) dayEffects.push(e);
    }

    entries.push({
      _id: new ObjectId(),
      user: user._id,
      belongsToBoard: board._id,
      type: "side-effect",
      content: dayEffects.join(","),
      userDate: daysAgo(totalDays - day),
      createdAt: daysAgo(totalDays - day),
    });
  }

  return entries;
}

/**
 * Generate Stick entries (dose logs). Between 4 and 52 per user
 * depending on effort length. Weekly-ish cadence.
 */
function generateStickEntries(user, board, archetype) {
  const effortWeeks =
    (new Date("2025-05-15") - new Date(user.createdAt)) /
    (1000 * 60 * 60 * 24 * 7);
  const stickCount = Math.min(52, Math.max(4, Math.round(effortWeeks)));
  const entries = [];
  const locations = ["Stomach", "Arm", "Thigh"];
  const locMods = ["Left", "Right"];

  for (let i = 0; i < stickCount; i++) {
    const dayOffset = Math.round((i / stickCount) * effortWeeks * 7);
    entries.push({
      _id: new ObjectId(),
      belongsToBoard: board._id,
      user: user._id,
      stickNumber: i + 1,
      stickLocation: pick(locations),
      stickLocMod: pick(locMods),
      stickDose: pick([2.5, 5, 7.5, 10, 12.5, 15]),
      cost: randInt(0, 1200),
      userDate: daysAgo(Math.round(effortWeeks * 7) - dayOffset),
      createdAt: daysAgo(Math.round(effortWeeks * 7) - dayOffset),
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Engagement pattern helpers
// ---------------------------------------------------------------------------

/**
 * Returns a function day → probability of logging on that day.
 * This controls how engagement varies over time for each archetype.
 */
function getLogProbability(archetype, totalDays) {
  switch (archetype.engagementPattern) {
    case "consistent":
      return () => 0.75; // logs ~75% of days
    case "high":
      return () => 0.92; // logs nearly every day
    case "declining":
      // Starts at 80%, drops to 20% by end
      return (day) => 0.8 - 0.6 * (day / totalDays);
    case "dropout":
      // 90% first 25% of days, then drops to 10%
      return (day) => {
        const progress = day / totalDays;
        return progress < 0.25 ? 0.9 : 0.1;
      };
    default:
      return () => 0.6;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Generating seed data...\n");

  // Step 1: Users
  const users = generateUsers();
  console.log(`Generated ${users.length} users across ${ARCHETYPES.length} archetypes:`);
  for (const a of ARCHETYPES) {
    console.log(`  ${a.name}: ${a.count} users — ${a.description}`);
  }

  // Step 2: Stickerboards (1 per user)
  const boards = users.map((u) => generateStickerboard(u));
  console.log(`\nGenerated ${boards.length} stickerboards`);

  // Step 3: All log entries
  const allLogEntries = [];
  const allSticks = [];

  // Build archetype lookup
  const archetypeByName = new Map(ARCHETYPES.map((a) => [a.name, a]));

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const board = boards[i];
    const archetype = archetypeByName.get(user._archetype);

    // Sticks (dose logs)
    const sticks = generateStickEntries(user, board, archetype);
    allSticks.push(...sticks);

    // Weight entries
    const weights = generateWeightEntries(user, board, archetype);
    allLogEntries.push(...weights);

    // Mood entries (depends on weight for correlation archetype)
    const moods = generateMoodEntries(user, board, archetype, weights);
    allLogEntries.push(...moods);

    // Sleep
    const sleeps = generateSleepEntries(user, board, archetype);
    allLogEntries.push(...sleeps);

    // Activity
    const activities = generateActivityEntries(user, board, archetype);
    allLogEntries.push(...activities);

    // Side effects
    const sideEffects = generateSideEffectEntries(user, board, archetype);
    allLogEntries.push(...sideEffects);
  }

  console.log(`Generated ${allSticks.length} stick entries`);
  console.log(`Generated ${allLogEntries.length} log entries:`);
  console.log(
    `  weight: ${allLogEntries.filter((e) => e.type === "weight").length}`
  );
  console.log(
    `  mood: ${allLogEntries.filter((e) => e.type === "mood").length}`
  );
  console.log(
    `  sleep: ${allLogEntries.filter((e) => e.type === "sleep").length}`
  );
  console.log(
    `  activity: ${allLogEntries.filter((e) => e.type === "activity").length}`
  );
  console.log(
    `  side-effect: ${allLogEntries.filter((e) => e.type === "side-effect").length}`
  );

  // Step 4: Generate ground truth table for test assertions
  const groundTruth = users.map((u) => ({
    userId: u._id.toString(),
    name: u.name,
    archetype: u._archetype,
    expectedPatterns: u._expectedPatterns,
  }));

  // Step 5: Output
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  // Strip test metadata from users before export
  const cleanUsers = users.map(({ _archetype, _expectedPatterns, ...rest }) => rest);

  writeFileSync(`${OUTPUT_DIR}/users.json`, JSON.stringify(cleanUsers, null, 2));
  writeFileSync(`${OUTPUT_DIR}/stickerboards.json`, JSON.stringify(boards, null, 2));
  writeFileSync(`${OUTPUT_DIR}/sticks.json`, JSON.stringify(allSticks, null, 2));
  writeFileSync(`${OUTPUT_DIR}/logentries.json`, JSON.stringify(allLogEntries, null, 2));
  writeFileSync(`${OUTPUT_DIR}/ground_truth.json`, JSON.stringify(groundTruth, null, 2));

  console.log(`\nFiles written to ${OUTPUT_DIR}/`);
  console.log(`Ground truth table: ${OUTPUT_DIR}/ground_truth.json`);

  // Step 6: Direct import if MONGODB_URI is set
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    console.log("\nMONGODB_URI found — importing directly...");
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(DB_NAME);

    // Drop existing test data (only seed data, identified by email domain)
    console.log("  Clearing previous seed data...");
    const seedUserIds = cleanUsers.map((u) => u._id);
    await db.collection("users").deleteMany({ _id: { $in: seedUserIds } });
    await db.collection("stickerboards").deleteMany({ user: { $in: seedUserIds } });
    await db.collection("sticks").deleteMany({ user: { $in: seedUserIds } });
    await db.collection("logentries").deleteMany({ user: { $in: seedUserIds } });

    console.log("  Inserting users...");
    await db.collection("users").insertMany(cleanUsers);
    console.log("  Inserting stickerboards...");
    await db.collection("stickerboards").insertMany(boards);
    console.log("  Inserting sticks...");
    await db.collection("sticks").insertMany(allSticks);
    console.log("  Inserting log entries...");
    await db.collection("logentries").insertMany(allLogEntries);

    await client.close();
    console.log("  Import complete.");
  } else {
    console.log(`
To import manually with mongoimport:
  mongoimport --uri="$MONGODB_URI" --db=${DB_NAME} --collection=users --file=${OUTPUT_DIR}/users.json --jsonArray
  mongoimport --uri="$MONGODB_URI" --db=${DB_NAME} --collection=stickerboards --file=${OUTPUT_DIR}/stickerboards.json --jsonArray
  mongoimport --uri="$MONGODB_URI" --db=${DB_NAME} --collection=sticks --file=${OUTPUT_DIR}/sticks.json --jsonArray
  mongoimport --uri="$MONGODB_URI" --db=${DB_NAME} --collection=logentries --file=${OUTPUT_DIR}/logentries.json --jsonArray
    `);
  }
}

main().catch(console.error);
