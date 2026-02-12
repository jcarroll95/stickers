#!/usr/bin/env node
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

type PackIndex = {
  schemaVersion: number;
  pack: {
    packId: string;
    name: string;
    description?: string;
    isActive: boolean;
  };
  defaults?: {
    profile?: string;
    tags?: string[];
  };
  stickers: Array<{
    stickerId: string;
    name: string;
    description?: string;
    inputRef: string; // relative folder under processedRoot
    tags?: string[];
    profile?: string; // optional per-sticker override
  }>;
};

type VariantKey = "thumb" | "small" | "medium" | "full";

type VariantInfo = {
  key: VariantKey;
  format: "webp" | "png";
  mime: string;
  // path relative to processed root
  processedPath: string;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
};

type GeneratedManifest = {
  schemaVersion: 1;
  batchId: string;
  createdAt: string;
  source: {
    packIndexPath: string;   // relative to repo root for portability
    processedRoot: string;   // relative to repo root
    profile: string;
  };
  pack: {
    packId: string;
    name: string;
    description?: string;
    isActive: boolean;
    tags: string[];
  };
  stickers: Array<{
    stickerId: string;
    name: string;
    description?: string;
    tags: string[];
    inputRef: string;
    assets: {
      profile: string;
      variants: Array<{
        key: VariantKey;
        format: "webp" | "png";
        mime: string;
        path: string; // processed-relative path
        sha256: string;
        bytes: number;
        width: number;
        height: number;
      }>;
    };
  }>;
};

type UploadObject = {
  stickerId: string;
  variantKey: VariantKey;
  localPath: string;  // relative to repo root (Mode 2: points into uploads batch)
  sha256: string;
  bytes: number;
  mime: string;
  objectKey: string;
  cacheControl: string;
};

type UploadPlan = {
  schemaVersion: 1;
  batchId: string;
  createdAt: string;
  processedRoot: string; // relative to repo root
  uploadsRoot: string;   // relative to repo root (batch folder)
  objectPrefix: string;
  objects: UploadObject[];
};

type Args = {
  packFile?: string;
  all: boolean;
  dryRun: boolean;
  processedRoot: string;
  packsDir: string;
  generatedDir: string;
  uploadsDir: string;
  objectPrefixBase: string; // e.g. "catalog"
};

const EXPECTED_VARIANTS: Array<{ key: VariantKey; filename: string; format: "webp" | "png"; mime: string }> = [
  { key: "thumb",  filename: "thumb.webp",  format: "webp", mime: "image/webp" },
  { key: "small",  filename: "small.webp",  format: "webp", mime: "image/webp" },
  { key: "medium", filename: "medium.webp", format: "webp", mime: "image/webp" },
  { key: "full",   filename: "full.png",    format: "png",  mime: "image/png" }
];

function printHelpAndExit(code: number): never {
  console.log(`
sb-image-manifest [--pack <file>] [--all] [--dry-run]
                  [--processed-root <dir>] [--packs-dir <dir>]
                  [--generated-dir <dir>] [--uploads-dir <dir>]
                  [--object-prefix-base <prefix>]

Defaults:
  processed-root: <repoRoot>/data/assets/processed
  packs-dir:      <repoRoot>/data/assets/manifests/packs
  generated-dir:  <repoRoot>/data/assets/manifests/generated
  uploads-dir:    <repoRoot>/data/assets/uploads
  object-prefix-base: catalog

Behavior:
  - Reads pack index (.source.json)
  - Validates processed outputs exist for each sticker inputRef
  - Computes sha256 + image metadata for each variant
  - Computes deterministic batchId
  - Writes manifest.<batchId>.json in generated dir
  - Creates uploads/<batchId>/files/<stickerId>/<variantFile> (hardlink, fallback copy)
  - Writes uploads/<batchId>/_upload.json

Examples:
  sb-image-manifest --pack test_pack.source.json
  sb-image-manifest --all
`);
  process.exit(code);
}

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg?.name === "stickerboards") return dir;
      } catch {
        // continue walking
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("Could not find repo root (package.json name === 'stickerboards').");
    dir = parent;
  }
}

function parseArgs(argv: string[]): Args {
  const repoRoot = findRepoRoot(process.cwd());
  const assetsRoot = path.join(repoRoot, "data", "assets");

  const args: Args = {
    all: false,
    dryRun: false,
    processedRoot: path.join(assetsRoot, "processed"),
    packsDir: path.join(repoRoot, "data", "assets", "manifests", "packs"),
    generatedDir: path.join(repoRoot, "data", "assets", "manifests", "generated"),
    uploadsDir: path.join(assetsRoot, "uploads"),
    objectPrefixBase: "catalog"
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pack") args.packFile = argv[++i];
    else if (a === "--all") args.all = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--processed-root") args.processedRoot = argv[++i] ?? "";
    else if (a === "--packs-dir") args.packsDir = argv[++i] ?? "";
    else if (a === "--generated-dir") args.generatedDir = argv[++i] ?? "";
    else if (a === "--uploads-dir") args.uploadsDir = argv[++i] ?? "";
    else if (a === "--object-prefix-base") args.objectPrefixBase = argv[++i] ?? "";
    else if (a === "--help" || a === "-h") printHelpAndExit(0);
    else {
      console.error(`Unknown arg: ${a}`);
      printHelpAndExit(1);
    }
  }

  // Normalize to absolute paths
  args.processedRoot = path.resolve(args.processedRoot);
  args.packsDir = path.resolve(args.packsDir);
  args.generatedDir = path.resolve(args.generatedDir);
  args.uploadsDir = path.resolve(args.uploadsDir);

  if (!args.all && !args.packFile) {
    console.error("Must provide --pack <file> or --all");
    printHelpAndExit(1);
  }
  if (args.all && args.packFile) {
    console.error("Use either --pack or --all, not both.");
    printHelpAndExit(1);
  }
  return args;
}

async function ensureDir(p: string): Promise<void> {
  await fs.promises.mkdir(p, { recursive: true });
}

function stableStringify(value: unknown): string {
  // Deterministic JSON serialization with sorted keys.
  const seen = new WeakSet<object>();

  const sorter = (v: any): any => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) throw new Error("Cannot stableStringify circular structure.");
    seen.add(v);

    if (Array.isArray(v)) return v.map(sorter);

    const keys = Object.keys(v).sort();
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = sorter(v[k]);
    return out;
  };

  return JSON.stringify(sorter(value));
}

function sha256Hex(buf: Buffer | string): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    const s = fs.createReadStream(filePath);
    s.on("error", reject);
    s.on("data", (chunk) => h.update(chunk));
    s.on("end", () => resolve(h.digest("hex")));
  });
}

function relToRepo(repoRoot: string, absPath: string): string {
  const rel = path.relative(repoRoot, absPath);
  return rel.split(path.sep).join("/");
}

function assertNoDupes(items: string[], label: string): void {
  const s = new Set<string>();
  for (const it of items) {
    if (s.has(it)) throw new Error(`Duplicate ${label}: ${it}`);
    s.add(it);
  }
}

async function readPackIndex(packPath: string): Promise<PackIndex> {
  const raw = await fs.promises.readFile(packPath, "utf8");
  const parsed = JSON.parse(raw);
  return parsed as PackIndex;
}

function validatePackIndex(pack: PackIndex): void {
  if (pack.schemaVersion !== 1) throw new Error(`Unsupported schemaVersion: ${pack.schemaVersion}`);
  if (!pack.pack?.packId) throw new Error("pack.packId is required");
  if (!pack.pack?.name) throw new Error("pack.name is required");
  if (typeof pack.pack?.isActive !== "boolean") throw new Error("pack.isActive must be boolean");
  if (!Array.isArray(pack.stickers) || pack.stickers.length === 0) throw new Error("stickers[] is required");

  assertNoDupes(pack.stickers.map(s => s.stickerId), "stickerId");
  assertNoDupes(pack.stickers.map(s => s.inputRef), "inputRef");

  for (const s of pack.stickers) {
    if (!s.stickerId) throw new Error("stickerId is required");
    if (!s.name) throw new Error(`sticker ${s.stickerId}: name is required`);
    if (!s.inputRef) throw new Error(`sticker ${s.stickerId}: inputRef is required`);
  }
}

function mergeTags(defaults: string[] | undefined, extra: string[] | undefined): string[] {
  const out = new Set<string>();
  for (const t of defaults ?? []) out.add(t);
  for (const t of extra ?? []) out.add(t);
  return Array.from(out);
}

async function getVariantInfo(
  processedRoot: string,
  inputRef: string,
  spec: { key: VariantKey; filename: string; format: "webp" | "png"; mime: string }
): Promise<VariantInfo> {
  const abs = path.join(processedRoot, inputRef, spec.filename);
  if (!fs.existsSync(abs)) {
    throw new Error(`Missing variant for inputRef=${inputRef}: ${spec.filename}`);
  }

  const st = await fs.promises.stat(abs);
  const meta = await sharp(abs).metadata();
  if (!meta.width || !meta.height) throw new Error(`Could not read dimensions: ${abs}`);

  const hash = await sha256File(abs);

  return {
    key: spec.key,
    format: spec.format,
    mime: spec.mime,
    processedPath: relToRepo(processedRoot, abs).replace(/^(\.\.\/)+/, ""), // keep processed-relative later
    sha256: hash,
    bytes: st.size,
    width: meta.width,
    height: meta.height
  };
}

async function stageFileHardlinkOrCopy(src: string, dst: string): Promise<void> {
  await ensureDir(path.dirname(dst));
  try {
    // hardlink is deterministic & cheap; best for local ops
    await fs.promises.link(src, dst);
  } catch (e: any) {
    // EXDEV = cross-device link not permitted (common on some setups)
    // EEXIST = already exists (shouldn't happen if batchId unique, but tolerate)
    if (e?.code === "EEXIST") return;
    await fs.promises.copyFile(src, dst);
  }
}

function computeBatchId(packIndex: PackIndex, variantHashes: Array<{ stickerId: string; variantKey: string; sha256: string }>): string {
  // Deterministic: canonical pack index JSON + sorted variant hashes list.
  const packCanon = stableStringify(packIndex);
  const hashesCanon = stableStringify(
    variantHashes
      .slice()
      .sort((a, b) => (a.stickerId + ":" + a.variantKey).localeCompare(b.stickerId + ":" + b.variantKey))
  );

  const combined = packCanon + "\n" + hashesCanon;
  const digest = sha256Hex(Buffer.from(combined, "utf8"));
  return `b_${digest.slice(0, 12)}`;
}

async function buildForPack(args: Args, repoRoot: string, packPathAbs: string): Promise<{ manifest: GeneratedManifest; uploadPlan: UploadPlan }> {
  const packIndex = await readPackIndex(packPathAbs);
  validatePackIndex(packIndex);

  const defaultProfile = packIndex.defaults?.profile ?? "stickers-v1";
  const packTags = packIndex.defaults?.tags ?? [];
  const createdAt = new Date().toISOString();

  // Resolve variants + collect hashes for batchId
  const variantHashIndex: Array<{ stickerId: string; variantKey: string; sha256: string }> = [];
  const stickerVariantInfo: Record<string, VariantInfo[]> = {};

  for (const s of packIndex.stickers) {
    const profile = s.profile ?? defaultProfile;

    // Ensure processed folder exists
    const processedFolder = path.join(args.processedRoot, s.inputRef);
    if (!fs.existsSync(processedFolder)) {
      throw new Error(`Processed folder missing for inputRef=${s.inputRef} (expected: ${processedFolder})`);
    }

    // Optional receipt existence check (recommended)
    const receiptPath = path.join(processedFolder, "_receipt.json");
    if (!fs.existsSync(receiptPath)) {
      // Not fatal, but you may choose to require it.
      // throw new Error(`Missing _receipt.json in ${processedFolder}`);
    }

    const infos: VariantInfo[] = [];
    for (const spec of EXPECTED_VARIANTS) {
      const info = await getVariantInfo(args.processedRoot, s.inputRef, spec);
      infos.push(info);
      variantHashIndex.push({ stickerId: s.stickerId, variantKey: spec.key, sha256: info.sha256 });
    }
    stickerVariantInfo[s.stickerId] = infos;

    // record profile on a per-sticker basis (even though we don't use it to resolve files here)
    void profile;
  }

  const batchId = computeBatchId(packIndex, variantHashIndex);

  const packIndexPathRel = relToRepo(repoRoot, packPathAbs);
  const processedRootRel = relToRepo(repoRoot, args.processedRoot);

  const manifest: GeneratedManifest = {
    schemaVersion: 1,
    batchId,
    createdAt,
    source: {
      packIndexPath: packIndexPathRel,
      processedRoot: processedRootRel,
      profile: defaultProfile
    },
    pack: {
      packId: packIndex.pack.packId,
      name: packIndex.pack.name,
      description: packIndex.pack.description,
      isActive: packIndex.pack.isActive,
      tags: packTags
    },
    stickers: packIndex.stickers.map((s) => {
      const merged = mergeTags(packTags, s.tags);
      const profile = s.profile ?? defaultProfile;

      const variants = (stickerVariantInfo[s.stickerId] ?? []).map(v => ({
        key: v.key,
        format: v.format,
        mime: v.mime,
        path: path.posix.join(s.inputRef, `${v.key}.${v.format === "webp" ? "webp" : "png"}`),
        sha256: v.sha256,
        bytes: v.bytes,
        width: v.width,
        height: v.height
      }));

      return {
        stickerId: s.stickerId,
        name: s.name,
        description: s.description,
        tags: merged,
        inputRef: s.inputRef,
        assets: { profile, variants }
      };
    })
  };

  // Mode 2: stage ready-to-upload batch folder containing files/<stickerId>/<variantFile>
  const batchAbs = path.join(args.uploadsDir, batchId);
  const filesAbs = path.join(batchAbs, "files");
  const uploadsRootRel = relToRepo(repoRoot, batchAbs);

  const objectPrefix = `${args.objectPrefixBase}/${packIndex.pack.packId}/${batchId}`;

  const objects: UploadObject[] = [];

  for (const s of packIndex.stickers) {
    for (const spec of EXPECTED_VARIANTS) {
      const srcAbs = path.join(args.processedRoot, s.inputRef, spec.filename);
      const dstAbs = path.join(filesAbs, s.stickerId, spec.filename);

      const info = (stickerVariantInfo[s.stickerId] ?? []).find(v => v.key === spec.key);
      if (!info) throw new Error(`Internal error: missing variant info for ${s.stickerId}:${spec.key}`);

      objects.push({
        stickerId: s.stickerId,
        variantKey: spec.key,
        localPath: relToRepo(repoRoot, dstAbs),
        sha256: info.sha256,
        bytes: info.bytes,
        mime: spec.mime,
        objectKey: `${objectPrefix}/${s.stickerId}/${spec.filename}`,
        cacheControl: "public, max-age=31536000, immutable"
      });
    }
  }

  const uploadPlan: UploadPlan = {
    schemaVersion: 1,
    batchId,
    createdAt,
    processedRoot: processedRootRel,
    uploadsRoot: uploadsRootRel,
    objectPrefix,
    objects
  };

  // Write outputs + stage files (unless dry-run)
  if (!args.dryRun) {
    await ensureDir(args.generatedDir);
    await ensureDir(batchAbs);

    // stage files first (so upload plan refers to real files)
    for (const s of packIndex.stickers) {
      for (const spec of EXPECTED_VARIANTS) {
        const srcAbs = path.join(args.processedRoot, s.inputRef, spec.filename);
        const dstAbs = path.join(filesAbs, s.stickerId, spec.filename);
        await stageFileHardlinkOrCopy(srcAbs, dstAbs);
      }
    }

    const manifestPath = path.join(args.generatedDir, `manifest.${batchId}.json`);
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    const uploadPath = path.join(batchAbs, "_upload.json");
    await fs.promises.writeFile(uploadPath, JSON.stringify(uploadPlan, null, 2), "utf8");
  }

  return { manifest, uploadPlan };
}

async function listPackFiles(packsDir: string): Promise<string[]> {
  const entries = await fs.promises.readdir(packsDir, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && e.name.endsWith(".source.json"))
    .map(e => path.join(packsDir, e.name))
    .sort();
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv);
  const repoRoot = findRepoRoot(process.cwd());

  if (!fs.existsSync(args.processedRoot)) throw new Error(`Processed root does not exist: ${args.processedRoot}`);
  if (!fs.existsSync(args.packsDir)) throw new Error(`Packs dir does not exist: ${args.packsDir}`);

  const packPathsAbs: string[] = [];

  if (args.all) {
    const files = await listPackFiles(args.packsDir);
    if (files.length === 0) throw new Error(`No .source.json pack files found in ${args.packsDir}`);
    packPathsAbs.push(...files);
  } else if (args.packFile) {
    const abs = path.isAbsolute(args.packFile)
      ? args.packFile
      : path.resolve(args.packsDir, args.packFile); // allow --pack filename only
    packPathsAbs.push(abs);
  }

  console.log(`Processed root: ${args.processedRoot}`);
  console.log(`Packs dir:      ${args.packsDir}`);
  console.log(`Generated dir:  ${args.generatedDir}`);
  console.log(`Uploads dir:    ${args.uploadsDir}`);
  console.log(`Mode:           ${args.dryRun ? "dry-run" : "write+stage"}`);
  console.log("");

  let ok = 0;
  let failed = 0;

  for (const p of packPathsAbs) {
    const relPack = relToRepo(repoRoot, p);
    try {
      console.log(`Pack: ${relPack}`);
      const { manifest, uploadPlan } = await buildForPack(args, repoRoot, p);
      console.log(`  batchId:     ${manifest.batchId}`);
      console.log(`  objects:     ${uploadPlan.objects.length}`);
      if (!args.dryRun) {
        console.log(`  manifest:    ${relToRepo(repoRoot, path.join(args.generatedDir, `manifest.${manifest.batchId}.json`))}`);
        console.log(`  upload plan: ${relToRepo(repoRoot, path.join(args.uploadsDir, manifest.batchId, "_upload.json"))}`);
      }
      console.log("");
      ok++;
    } catch (e: any) {
      failed++;
      console.error(`  FAIL: ${relPack}`);
      console.error(`  ${e?.message ?? String(e)}`);
      console.log("");
    }
  }

  console.log(`Done. OK=${ok} FAILED=${failed}`);
  process.exit(failed > 0 ? 2 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(2);
});
