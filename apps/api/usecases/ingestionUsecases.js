// apps/api/usecases/ingestionUsecases.js
//
// Fully explicit, resumable ingestion state machine with:
// - OperationLog durable tracking (phase + per-object/per-sticker status in payload.tracking)
// - Lease/lock (lockOwner/lockExpiresAt) for single-writer semantics + crash-safe restart
// - manifestDigest enforcement
// - contentDigest skip for DB apply idempotency
// - lifecycle separation with pack+sticker gating:
//    - ingestion never publishes
//    - new packs default isActive=false
//    - ingestion writes StickerDefinition.status="ready"
//    - publishing should be a separate admin action
//
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const OperationLog = require("../models/OperationLog");
const StickerPack = require("../models/StickerPack");
const StickerDefinition = require("../models/StickerDefinition");
const { uploadLocalFile } = require("../services/objectStore");

const LEASE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function required(v, msg) {
  if (!v) throw new Error(msg);
  return v;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function sha256FileBytes(filePath) {
  return sha256Hex(fs.readFileSync(filePath));
}

function stableStringify(value) {
  const seen = new WeakSet();
  const sorter = (v) => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) throw new Error("Cannot stableStringify circular structure.");
    seen.add(v);
    if (Array.isArray(v)) return v.map(sorter);
    const keys = Object.keys(v).sort();
    const out = {};
    for (const k of keys) out[k] = sorter(v[k]);
    return out;
  };
  return JSON.stringify(sorter(value));
}

function computeStickerContentDigest(sticker) {
  const variants = (sticker.assets?.variants || [])
    .map((v) => ({ key: v.key, sha256: v.sha256, format: v.format }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const canon = stableStringify({
    stickerId: sticker.stickerId,
    profile: sticker.assets?.profile,
    variants,
  });

  return sha256Hex(Buffer.from(canon, "utf8"));
}

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function indexBy(items, keyFn) {
  const m = new Map();
  for (const it of items) m.set(keyFn(it), it);
  return m;
}

function pickPrimaryKey(variants) {
  if (variants.find((v) => v.key === "medium")) return "medium";
  if (variants.find((v) => v.key === "small")) return "small";
  if (variants.find((v) => v.key === "thumb")) return "thumb";
  return variants[0]?.key || "medium";
}

function buildVariantFilename(key, format) {
  const ext = format === "png" ? "png" : "webp";
  return `${key}.${ext}`;
}

function findRepoRoot(startDir) {
  let dir = startDir;
  while (true) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg?.name === "stickerboards") return dir;
      } catch {
        // keep walking
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("Could not find repo root (package.json name === 'stickerboards').");
    dir = parent;
  }
}

// ---- Lease helpers ----

async function acquireLease(op, owner) {
  const now = new Date();
  if (op.lockExpiresAt && op.lockExpiresAt > now) {
    throw new Error("Ingestion already in progress for this batch.");
  }
  op.lockOwner = owner;
  op.lockExpiresAt = new Date(now.getTime() + LEASE_TTL_MS);
  await op.save();
}

async function heartbeatLease(op, owner) {
  if (op.lockOwner !== owner) {
    throw new Error("Lease lost during ingestion.");
  }
  op.lockExpiresAt = new Date(Date.now() + LEASE_TTL_MS);
  await op.save();
}

async function releaseLease(op, owner) {
  // Only the lease owner should release
  if (op.lockOwner && owner && op.lockOwner !== owner) {
    throw new Error("Cannot release lease: not the owner.");
  }
  op.lockOwner = undefined;
  op.lockExpiresAt = undefined;
  await op.save();
}

async function loadOrCreateOp({ batchId, userId, manifestDigest, totalObjects, totalStickers }) {
  let op = await OperationLog.findOne({ operationType: "catalogIngestion", batchId });

  if (!op) {
    op = await OperationLog.create({
      opId: `catalogIngestion:${batchId}`,
      userId,
      operationType: "catalogIngestion",
      batchId,
      manifestDigest,
      phase: "upload",
      status: "pending",
      progress: {
        uploadedObjects: 0,
        totalObjects,
        appliedStickers: 0,
        totalStickers,
      },
      payload: {
        tracking: {
          objects: [],
          stickers: [],
        },
      },
    });
    return op;
  }

  // enforce immutability of batch->manifest mapping
  if (op.manifestDigest && op.manifestDigest !== manifestDigest) {
    throw new Error(
      `manifestDigest mismatch for batchId ${batchId}: existing=${op.manifestDigest} new=${manifestDigest}`
    );
  }
  if (!op.manifestDigest) op.manifestDigest = manifestDigest;

  if (op.status === "failed") {
    op.status = "pending";
    op.errorMessage = undefined;
  }

  if (!op.payload) op.payload = {};
  if (!op.payload.tracking) op.payload.tracking = {};
  if (!Array.isArray(op.payload.tracking.objects)) op.payload.tracking.objects = [];
  if (!Array.isArray(op.payload.tracking.stickers)) op.payload.tracking.stickers = [];

  if (!op.progress) op.progress = {};
  if (typeof op.progress.totalObjects !== "number") op.progress.totalObjects = totalObjects;
  if (typeof op.progress.totalStickers !== "number") op.progress.totalStickers = totalStickers;

  await op.save();
  return op;
}

/**
 * Ingest a Mode-2 batchId:
 * - uploads/<batchId>/_upload.json
 * - manifests/generated/manifest.<batchId>.json
 *
 * Lifecycle separation (pack+sticker gating):
 * - ingestion never publishes
 * - pack.isActive is not set from manifest (new packs default false; existing unchanged)
 * - sticker.status is set to "ready" during ingestion
 */
async function ingestUploadBatch({ batchId, uploadsRootAbs, actor }) {
  required(batchId, "batchId is required");
  const userId = required(actor, "actor (admin userId) is required for catalog ingestion");

  const repoRoot = findRepoRoot(process.cwd());
  const uploadsRoot = uploadsRootAbs
    ? path.resolve(uploadsRootAbs)
    : path.join(repoRoot, "data", "assets", "uploads");

  const uploadPlanPath = path.join(uploadsRoot, batchId, "_upload.json");
  if (!fs.existsSync(uploadPlanPath)) throw new Error(`Upload plan not found: ${uploadPlanPath}`);

  const manifestPath = path.join(repoRoot, "data", "assets", "manifests", "generated", `manifest.${batchId}.json`);
  if (!fs.existsSync(manifestPath)) throw new Error(`Generated manifest not found: ${manifestPath}`);

  const uploadPlan = readJson(uploadPlanPath);
  const manifest = readJson(manifestPath);

  if (uploadPlan.schemaVersion !== 1) throw new Error(`Unsupported upload plan schemaVersion: ${uploadPlan.schemaVersion}`);
  if (manifest.schemaVersion !== 1) throw new Error(`Unsupported manifest schemaVersion: ${manifest.schemaVersion}`);
  if (uploadPlan.batchId !== batchId) throw new Error(`Upload plan batchId mismatch: expected ${batchId}, got ${uploadPlan.batchId}`);
  if (manifest.batchId !== batchId) throw new Error(`Manifest batchId mismatch: expected ${batchId}, got ${manifest.batchId}`);

  const manifestDigest = sha256FileBytes(manifestPath);

  const desiredObjects = (uploadPlan.objects || []).map((o) => ({
    objectKey: o.objectKey,
    sha256: o.sha256,
    mime: o.mime,
    cacheControl: o.cacheControl,
    localPath: o.localPath,
  }));

  const desiredStickers = (manifest.stickers || []).map((s) => ({
    stickerId: s.stickerId,
    name: s.name,
    description: s.description,
    tags: s.tags || [],
    assets: s.assets,
  }));

  let op = await loadOrCreateOp({
    batchId,
    userId,
    manifestDigest,
    totalObjects: desiredObjects.length,
    totalStickers: desiredStickers.length,
  });

  const leaseOwner = `catalogIngestion:${batchId}`;

  // If job already complete, return immediately.
  if (op.phase === "complete" || op.status === "completed") {
    return { success: true, batchId, status: "already-complete", progress: op.progress };
  }

  await acquireLease(op, leaseOwner);

  try {
    // initialize tracking arrays if empty
    if (op.payload.tracking.objects.length === 0) {
      op.payload.tracking.objects = desiredObjects.map((o) => ({
        objectKey: o.objectKey,
        sha256: o.sha256,
        status: "pending", // pending|uploaded|failed
        attempts: 0,
        lastError: null,
        completedAt: null,
      }));
      op.progress.uploadedObjects = 0;
    }

    if (op.payload.tracking.stickers.length === 0) {
      op.payload.tracking.stickers = desiredStickers.map((s) => ({
        stickerId: s.stickerId,
        contentDigest: computeStickerContentDigest(s),
        status: "pending", // pending|applied|skipped|failed
        attempts: 0,
        lastError: null,
        completedAt: null,
      }));
      op.progress.appliedStickers = 0;
    }

    // merge-add missing tracking entries (defensive)
    const objTrackByKey = indexBy(op.payload.tracking.objects, (x) => x.objectKey);
    for (const o of desiredObjects) {
      if (!objTrackByKey.has(o.objectKey)) {
        op.payload.tracking.objects.push({
          objectKey: o.objectKey,
          sha256: o.sha256,
          status: "pending",
          attempts: 0,
          lastError: null,
          completedAt: null,
        });
      }
    }

    const stickerTrackById = indexBy(op.payload.tracking.stickers, (x) => x.stickerId);
    for (const s of desiredStickers) {
      if (!stickerTrackById.has(s.stickerId)) {
        op.payload.tracking.stickers.push({
          stickerId: s.stickerId,
          contentDigest: computeStickerContentDigest(s),
          status: "pending",
          attempts: 0,
          lastError: null,
          completedAt: null,
        });
      }
    }

    await op.save();

    const desiredByObjectKey = indexBy(desiredObjects, (x) => x.objectKey);
    const desiredStickerById = indexBy(desiredStickers, (x) => x.stickerId);

    // -------------------------
    // PHASE: UPLOAD
    // -------------------------
    if (!op.phase) op.phase = "upload";

    if (op.phase === "upload") {
      for (const t of op.payload.tracking.objects) {
        if (t.status === "uploaded") continue;

        const desired = desiredByObjectKey.get(t.objectKey);
        if (!desired) throw new Error(`Tracking has unexpected objectKey: ${t.objectKey}`);

        const localAbs = path.isAbsolute(desired.localPath)
          ? desired.localPath
          : path.join(repoRoot, desired.localPath);

        if (!fs.existsSync(localAbs)) {
          t.status = "failed";
          t.attempts += 1;
          t.lastError = `Missing local file: ${localAbs}`;
          await op.save();
          throw new Error(t.lastError);
        }

        try {
          t.attempts += 1;
          t.lastError = null;

          await uploadLocalFile({
            filePath: localAbs,
            objectKey: desired.objectKey,
            contentType: desired.mime,
            cacheControl: desired.cacheControl,
            expectedSha256: desired.sha256,
            skipIfSame: true,
          });

          t.status = "uploaded";
          t.completedAt = new Date();

          op.progress.uploadedObjects = op.payload.tracking.objects.filter((x) => x.status === "uploaded").length;
          await heartbeatLease(op, leaseOwner);
        } catch (e) {
          t.status = "failed";
          t.lastError = e?.message ?? String(e);
          await op.save();
          throw e;
        }
      }

      op.phase = "apply_db";
      await heartbeatLease(op, leaseOwner);
    }

    // -------------------------
    // PHASE: APPLY_DB
    // -------------------------
    if (op.phase === "apply_db") {
      const packStableId = manifest.pack.packId;

      // Upsert pack deterministically:
      // - slug intended to be stable packId
      // - ingestion DOES NOT publish:
      //     - new pack defaults isActive=false
      //     - existing pack leaves isActive unchanged
      let pack =
        (await StickerPack.findOne({ slug: packStableId })) ||
        (await StickerPack.findOne({ name: manifest.pack.name }));

      const isNewPack = !pack;

      if (!pack) {
        pack = new StickerPack({
          name: manifest.pack.name,
          description: manifest.pack.description,
          slug: packStableId,
          isActive: false, // lifecycle separation: ingestion creates draft packs
        });
      } else {
        pack.name = manifest.pack.name;
        pack.description = manifest.pack.description;
        pack.slug = packStableId;
        // DO NOT touch pack.isActive here
      }

      // Optional markers if your schema includes them
      pack.lastIngestBatchId = batchId;
      pack.lastIngestManifestDigest = manifestDigest;
      pack.lastIngestedAt = new Date();

      await pack.save();

      const cdnBase = process.env.MEDIA_BASE_URL || "";
      const objectPrefix = uploadPlan.objectPrefix;

      for (const t of op.payload.tracking.stickers) {
        if (t.status === "applied" || t.status === "skipped") continue;

        const desired = desiredStickerById.get(t.stickerId);
        if (!desired) throw new Error(`Tracking has unexpected stickerId: ${t.stickerId}`);

        try {
          t.attempts += 1;
          t.lastError = null;

          const stickerKey = desired.stickerId;
          const revision = 1;

          const existing = await StickerDefinition.findOne({ stickerKey, revision });

          // Skip if identical content already applied
          if (existing && existing.contentDigest && existing.contentDigest === t.contentDigest) {
            t.status = "skipped";
            t.completedAt = new Date();
            op.progress.appliedStickers = op.payload.tracking.stickers.filter(
              (x) => x.status === "applied" || x.status === "skipped"
            ).length;
            await heartbeatLease(op, leaseOwner);
            continue;
          }

          const variants = (desired.assets?.variants || []).map((v) => {
            const filename = buildVariantFilename(v.key, v.format);
            const objectKey = `${objectPrefix}/${stickerKey}/${filename}`;
            const url = cdnBase ? `${cdnBase}/${objectKey}` : objectKey;

            return {
              key: v.key,
              format: v.format,
              width: v.width,
              height: v.height,
              url,
              bytes: v.bytes,
              sha256: v.sha256,
              // If you add objectKey to MediaVariant later, add it here too.
              // objectKey
            };
          });

          const primaryKey = pickPrimaryKey(variants);

          const doc = existing || new StickerDefinition({ stickerKey, revision });

          doc.name = desired.name;
          doc.packId = pack._id;

          // lifecycle separation: ingestion does NOT publish stickers
          // Publishing step should flip these to "active" (and/or pack.isActive=true)
          doc.status = "ready";

          doc.tags = uniq(desired.tags);
          doc.media = { primaryKey, variants };

          // Content-addressed markers (you said you added these)
          doc.contentDigest = t.contentDigest;
          doc.sourceBatchId = batchId;
          doc.sourceManifestDigest = manifestDigest;
          doc.ingestedAt = new Date();

          if (!doc.slug) doc.slug = stickerKey;

          await doc.save();

          // Ensure membership (idempotent union)
          if (!pack.stickers) pack.stickers = [];
          const existingIds = pack.stickers.map(String);
          if (!existingIds.includes(String(doc._id))) {
            pack.stickers.push(doc._id);
            await pack.save();
          }

          t.status = "applied";
          t.completedAt = new Date();

          op.progress.appliedStickers = op.payload.tracking.stickers.filter(
            (x) => x.status === "applied" || x.status === "skipped"
          ).length;

          await heartbeatLease(op, leaseOwner);
        } catch (e) {
          t.status = "failed";
          t.lastError = e?.message ?? String(e);
          await op.save();
          throw e;
        }
      }

      op.phase = "complete";
      op.status = "completed";
      op.completedAt = new Date();
      op.result = { batchId, progress: op.progress, packId: String(pack._id), packSlug: pack.slug, isNewPack };

      await releaseLease(op, leaseOwner);

      await op.save();

      return { success: true, batchId, status: "completed", progress: op.progress };
    }

    if (op.phase === "complete") {
      op.status = "completed";
      op.completedAt = op.completedAt || new Date();
      await releaseLease(op, leaseOwner);
      await op.save();
      return { success: true, batchId, status: "already-complete", progress: op.progress };
    }

    throw new Error(`Unknown ingestion phase: ${op.phase}`);
  } catch (err) {
    // Persist failure so next run can resume safely
    op.status = "failed";
    op.errorMessage = err?.message ?? String(err);
    op.failedAt = new Date();

    // Release lease even on failure (crash-safety also handled by TTL, but this is clean)
    try {
      await releaseLease(op, leaseOwner);
    } catch {
      // ignore
    }

    await op.save();
    throw err;
  }
}

module.exports = { ingestUploadBatch };
