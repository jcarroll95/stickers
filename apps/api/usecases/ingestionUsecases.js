// apps/api/usecases/ingestionUsecases.js
const fs = require("fs");
const path = require("path");

const StickerPack = require("../models/StickerPack");
const StickerDefinition = require("../models/StickerDefinition");
const { uploadLocalFile, sha256File } = require("../services/objectStore");

function required(value, msg) {
  if (!value) throw new Error(msg);
  return value;
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function variantFilenameFor(key, format) {
  // Your manifest uses key + format; the staged uploads use filename from upload plan.
  // This helper is only used when building URLs; objectKey is the source of truth.
  const ext = format === "png" ? "png" : "webp";
  return `${key}.${ext}`;
}

/**
 * Ingest a Mode-2 batch:
 *  - Upload objects referenced in uploads/<batchId>/_upload.json
 *  - Upsert pack + sticker defs using manifests/generated/manifest.<batchId>.json
 *
 * Assumes the batch folder exists on the same machine running the API.
 */
async function ingestUploadBatch({ batchId, uploadsRootAbs, actor }) {
  required(batchId, "batchId is required");

  const repoRoot = findRepoRoot(process.cwd());

  const uploadsRoot = uploadsRootAbs
    ? path.resolve(uploadsRootAbs)
    : path.join(repoRoot, "data", "assets", "uploads");

  const uploadPlanPath = path.join(uploadsRoot, batchId, "_upload.json");
  if (!fs.existsSync(uploadPlanPath)) {
    throw new Error(`Upload plan not found: ${uploadPlanPath}`);
  }

  const uploadPlan = readJson(uploadPlanPath);
  if (uploadPlan.schemaVersion !== 1) throw new Error(`Unsupported upload plan schemaVersion: ${uploadPlan.schemaVersion}`);
  if (uploadPlan.batchId !== batchId) throw new Error(`Upload plan batchId mismatch: expected ${batchId}, got ${uploadPlan.batchId}`);

  const manifestPath = path.join(repoRoot, "data", "assets", "manifests", "generated", `manifest.${batchId}.json`);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Generated manifest not found: ${manifestPath}`);
  }

  const manifest = readJson(manifestPath);
  if (manifest.schemaVersion !== 1) throw new Error(`Unsupported manifest schemaVersion: ${manifest.schemaVersion}`);
  if (manifest.batchId !== batchId) throw new Error(`Manifest batchId mismatch: expected ${batchId}, got ${manifest.batchId}`);

  // ---------- PHASE 1: Upload objects ----------
  let uploaded = 0;
  let skipped = 0;

  for (const obj of uploadPlan.objects || []) {
    const localAbs = path.isAbsolute(obj.localPath)
      ? obj.localPath
      : path.join(repoRoot, obj.localPath);

    if (!fs.existsSync(localAbs)) {
      throw new Error(`Missing local file referenced in upload plan: ${localAbs}`);
    }

    // Extra safety: verify local hash matches plan before uploading
    const actualSha = await sha256File(localAbs);
    if (obj.sha256 && obj.sha256 !== actualSha) {
      throw new Error(`sha256 mismatch for ${obj.localPath}: expected ${obj.sha256}, got ${actualSha}`);
    }

    const result = await uploadLocalFile({
      filePath: localAbs,
      objectKey: obj.objectKey,
      contentType: obj.mime,
      cacheControl: obj.cacheControl,
      expectedSha256: obj.sha256,
      skipIfSame: true
    });

    if (result.skipped) skipped++;
    else uploaded++;
  }

  // ---------- PHASE 2: Upsert DB state ----------
  // Pack identity: best practice is packId as stable slug.
  // NOTE: your StickerPack pre-save currently overwrites slug from name. :contentReference[oaicite:3]{index=3}
  // If you haven't fixed that hook, pack.slug will end up slugified from name instead of packId.
  const packId = manifest.pack.packId;
  const packName = manifest.pack.name;

  let pack = await StickerPack.findOne({ slug: packId });
  if (!pack) {
    pack = new StickerPack({
      name: packName,
      description: manifest.pack.description,
      isActive: !!manifest.pack.isActive,
      slug: packId
    });
  } else {
    pack.name = packName;
    pack.description = manifest.pack.description;
    pack.isActive = !!manifest.pack.isActive;
  }
  await pack.save();

  // Upsert stickers by stickerKey + revision
  // You already enforce (stickerKey, revision) uniqueness. :contentReference[oaicite:4]{index=4}
  const cdnBase = process.env.MEDIA_BASE_URL || "";
  const updatedStickerIds = [];

  for (const s of manifest.stickers || []) {
    const stickerKey = s.stickerId; // stable identity from pack index
    const revision = 1;

    // Build variants from manifest + upload plan prefix/objectKey convention
    // Source of truth: uploaded object keys.
    const variants = (s.assets?.variants || []).map((v) => {
      const filename = variantFilenameFor(v.key, v.format);
      const objectKey = `${uploadPlan.objectPrefix}/${stickerKey}/${filename}`;
      const url = cdnBase ? `${cdnBase}/${objectKey}` : objectKey;

      return {
        key: v.key,
        format: v.format,
        width: v.width,
        height: v.height,
        url,
        bytes: v.bytes,
        sha256: v.sha256
      };
    });

    // Choose a sensible primary
    const primaryKey = variants.find(x => x.key === "medium") ? "medium"
      : variants.find(x => x.key === "small") ? "small"
        : variants[0]?.key;

    let doc = await StickerDefinition.findOne({ stickerKey, revision });
    if (!doc) {
      doc = new StickerDefinition({
        name: s.name,
        description: s.description, // note: your schema doesn’t include description currently; safe to omit if not present
        slug: stickerKey,          // keep stable and unique; StickerDefinition only auto-sets slug if missing :contentReference[oaicite:5]{index=5}
        stickerKey,
        revision,
        packId: pack._id,
        status: "active",
        tags: uniq(s.tags),
        media: {
          primaryKey: primaryKey || "medium",
          variants
        }
      });
    } else {
      doc.name = s.name;
      doc.packId = pack._id;
      doc.status = "active";
      doc.tags = uniq(s.tags);
      doc.media = {
        primaryKey: primaryKey || doc.media?.primaryKey || "medium",
        variants
      };
    }

    await doc.save();
    updatedStickerIds.push(doc._id);
  }

  // Ensure pack.stickers contains exactly these (optional).
  // If you want incremental packs, change this to union instead.
  pack.stickers = uniq([...(pack.stickers || []), ...updatedStickerIds.map(String)]).map(id => id);
  await pack.save();

  // TODO: emit your audit event here using your audit utility (actor, packId, batchId, counts)

  return {
    success: true,
    batchId,
    uploaded,
    skipped,
    pack: { id: pack._id, slug: pack.slug, name: pack.name },
    stickersUpserted: updatedStickerIds.length
  };
}

module.exports = { ingestUploadBatch };
