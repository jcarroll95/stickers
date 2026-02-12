// apps/api/usecases/validateIngestionUsecases.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OperationLog = require('../models/OperationLog');

function required(v, msg) {
  if (!v) throw new Error(msg);
  return v;
}

function findRepoRoot(startDir) {
  let dir = startDir;
  while (true) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg?.name === 'stickerboards') return dir;
      } catch {
        // continue
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("Could not find repo root (package.json name === 'stickerboards').");
    dir = parent;
  }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function sha256FileBytes(filePath) {
  return sha256Hex(fs.readFileSync(filePath));
}

/**
 * Validate a batch is well-formed and ready to ingest.
 * This does NOT modify storage or DB state (except reading OperationLog).
 *
 * Returns a report suitable for the admin dashboard.
 */
async function validateUploadBatch({ actor, batchId, uploadsRootAbs }) {
  required(actor?.id, 'actor.id is required');
  required(batchId, 'batchId is required');

  const repoRoot = findRepoRoot(process.cwd());
  const uploadsRoot = uploadsRootAbs
    ? path.resolve(uploadsRootAbs)
    : path.join(repoRoot, 'data', 'assets', 'uploads');

  const uploadPlanPath = path.join(uploadsRoot, batchId, '_upload.json');
  const manifestPath = path.join(repoRoot, 'data', 'assets', 'manifests', 'generated', `manifest.${batchId}.json`);

  const report = {
    batchId,
    paths: {
      uploadsRoot,
      uploadPlanPath,
      manifestPath,
    },
    ok: true,
    errors: [],
    warnings: [],
    uploadPlan: null,
    manifest: null,
    counts: {
      objectsTotal: 0,
      objectsPresent: 0,
      stickersTotal: 0,
    },
    manifestDigest: null,
    operation: null,
    fileChecks: [],
  };

  if (!fs.existsSync(uploadPlanPath)) {
    report.ok = false;
    report.errors.push(`Upload plan not found: ${uploadPlanPath}`);
    return report;
  }
  if (!fs.existsSync(manifestPath)) {
    report.ok = false;
    report.errors.push(`Generated manifest not found: ${manifestPath}`);
    return report;
  }

  let uploadPlan;
  let manifest;
  try {
    uploadPlan = readJson(uploadPlanPath);
    report.uploadPlan = { schemaVersion: uploadPlan.schemaVersion, batchId: uploadPlan.batchId, objectPrefix: uploadPlan.objectPrefix };
  } catch (e) {
    report.ok = false;
    report.errors.push(`Failed to parse upload plan JSON: ${e?.message ?? String(e)}`);
    return report;
  }

  try {
    manifest = readJson(manifestPath);
    report.manifest = { schemaVersion: manifest.schemaVersion, batchId: manifest.batchId, packId: manifest.pack?.packId };
  } catch (e) {
    report.ok = false;
    report.errors.push(`Failed to parse manifest JSON: ${e?.message ?? String(e)}`);
    return report;
  }

  if (uploadPlan.schemaVersion !== 1) {
    report.ok = false;
    report.errors.push(`Unsupported upload plan schemaVersion: ${uploadPlan.schemaVersion}`);
  }
  if (manifest.schemaVersion !== 1) {
    report.ok = false;
    report.errors.push(`Unsupported manifest schemaVersion: ${manifest.schemaVersion}`);
  }
  if (uploadPlan.batchId !== batchId) {
    report.ok = false;
    report.errors.push(`Upload plan batchId mismatch: expected ${batchId}, got ${uploadPlan.batchId}`);
  }
  if (manifest.batchId !== batchId) {
    report.ok = false;
    report.errors.push(`Manifest batchId mismatch: expected ${batchId}, got ${manifest.batchId}`);
  }

  // Digest
  try {
    report.manifestDigest = sha256FileBytes(manifestPath);
  } catch (e) {
    report.ok = false;
    report.errors.push(`Failed to compute manifestDigest: ${e?.message ?? String(e)}`);
  }

  // Counts + file existence checks
  const objects = Array.isArray(uploadPlan.objects) ? uploadPlan.objects : [];
  const stickers = Array.isArray(manifest.stickers) ? manifest.stickers : [];

  report.counts.objectsTotal = objects.length;
  report.counts.stickersTotal = stickers.length;

  let present = 0;
  for (const o of objects) {
    const localRelOrAbs = o.localPath;
    const localAbs = path.isAbsolute(localRelOrAbs) ? localRelOrAbs : path.join(repoRoot, localRelOrAbs);
    const exists = !!localAbs && fs.existsSync(localAbs);
    if (exists) present += 1;

    report.fileChecks.push({
      objectKey: o.objectKey,
      localPath: o.localPath,
      localAbs,
      exists,
      sha256: o.sha256,
      mime: o.mime,
    });

    if (!exists) {
      report.ok = false;
      report.errors.push(`Missing local file for objectKey ${o.objectKey}: ${localAbs}`);
    }
  }
  report.counts.objectsPresent = present;

  // OperationLog state (lock/status)
  const op = await OperationLog.findOne({ operationType: 'catalogIngestion', batchId }).lean();
  if (op) {
    report.operation = {
      status: op.status,
      phase: op.phase,
      progress: op.progress,
      manifestDigest: op.manifestDigest,
      lockOwner: op.lockOwner,
      lockExpiresAt: op.lockExpiresAt,
      errorMessage: op.errorMessage,
      updatedAt: op.updatedAt,
      createdAt: op.createdAt,
    };

    if (report.manifestDigest && op.manifestDigest && report.manifestDigest !== op.manifestDigest) {
      report.ok = false;
      report.errors.push(
        `OperationLog manifestDigest mismatch: op=${op.manifestDigest} file=${report.manifestDigest}`
      );
    }

    const now = Date.now();
    if (op.lockExpiresAt && new Date(op.lockExpiresAt).getTime() > now) {
      report.warnings.push('Batch appears to be currently locked/in progress.');
    }
  }

  return report;
}

module.exports = { validateUploadBatch };
