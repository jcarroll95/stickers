#!/usr/bin/env node
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { transformAsset } from "../transformer";
import { stickersV1 } from "../profiles";
import type { TransformProfile, VariantResult } from "../types";

function findRepoRoot(startDir: string): string {
  let dir = startDir;

  while (true) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg?.name === "stickerboards") {
          return dir;
        }
      } catch {
        // ignore parse errors, keep walking
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("Could not find repo root (package.json with name 'stickerboards').");
    }
    dir = parent;
  }
}

type Args = {
  stagedDir: string;
  processedDir: string;
  dryRun: boolean;
  failFast: boolean;
};

function parseArgs(argv: string[]): Args {
  const repoRoot = findRepoRoot(process.cwd());
  const defaultAssetsRoot = path.join(repoRoot, "data", "assets");

  const args: Args = {
    stagedDir: path.join(defaultAssetsRoot, "staged"),
    processedDir: path.join(defaultAssetsRoot, "processed"),
    dryRun: false,
    failFast: false
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--staged") args.stagedDir = path.resolve(argv[++i] ?? "");
    else if (a === "--processed") args.processedDir = path.resolve(argv[++i] ?? "");
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--fail-fast") args.failFast = true;
    else if (a === "--help" || a === "-h") {
      printHelpAndExit(0);
    } else {
      console.error(`Unknown arg: ${a}`);
      printHelpAndExit(1);
    }
  }

  return args;
}


function printHelpAndExit(code: number): never {
  console.log(`
sb-image-optimize [options]

Defaults:
  staged:    <repoRoot>/data/assets/staged
  processed: <repoRoot>/data/assets/processed

Options:
  --staged <dir>       Override staged input directory
  --processed <dir>    Override processed output directory
  --dry-run            Validate and report, do not write files
  --fail-fast          Stop on first error
  -h, --help           Show help

Purpose:
  Scan staged assets, transform into pipeline-compliant variants,
  and write them into the processed folder. No manifest or upload
  metadata is generated in this step.
`);
  process.exit(code);
}

async function* walkFiles(dir: string): AsyncGenerator<string> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkFiles(full);
    else if (e.isFile()) yield full;
  }
}

function isImageFile(p: string): boolean {
  const ext = path.extname(p).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp"].includes(ext);
}

async function ensureDir(p: string): Promise<void> {
  await fs.promises.mkdir(p, { recursive: true });
}


async function validateVariant(
  v: VariantResult,
  specMaxSizePx: number,
  inputHadAlpha: boolean
): Promise<void> {
  // Size constraints
  if (v.width <= 0 || v.height <= 0) throw new Error(`Invalid dimensions for ${v.key}: ${v.width}x${v.height}`);
  if (v.width > specMaxSizePx || v.height > specMaxSizePx) {
    throw new Error(`Variant ${v.key} exceeds maxSizePx=${specMaxSizePx}: got ${v.width}x${v.height}`);
  }

  // Basic alpha preservation check (only meaningful if input had alpha)
  // Note: JPG inputs won't have alpha; PNG/WebP might.
  if (inputHadAlpha) {
    const meta = await sharp(v.buffer).metadata();
    const outHasAlpha = !!meta.hasAlpha;
    if (!outHasAlpha) {
      throw new Error(`Variant ${v.key} lost alpha channel (input had alpha).`);
    }
  }
}

async function writeVariants(
  variants: VariantResult[],
  profile: TransformProfile,
  relPathNoExt: string,
  processedDir: string,
  dryRun: boolean
): Promise<void> {
  // Folder: processed/<relative path without extension>/
  const outFolder = path.join(processedDir, relPathNoExt);
  if (!dryRun) await ensureDir(outFolder);

  for (const v of variants) {
    const ext = v.format === "webp" ? "webp" : "png";
    const outName = `${v.key}.${ext}`;
    const outPath = path.join(outFolder, outName);

    if (!dryRun) {
      await fs.promises.writeFile(outPath, v.buffer);
    }
  }

  // Optionally: also emit a tiny receipt file to help Stage B mapping/debug
  // (This is not a manifest; it's operational breadcrumbs.)
  if (!dryRun) {
    const receipt = {
      profile: `${profile.name}-v${profile.version}`,
      variants: variants.map(v => ({
        key: v.key, format: v.format, width: v.width, height: v.height, bytes: v.byteSize
      }))
    };
    await fs.promises.writeFile(path.join(outFolder, "_receipt.json"), JSON.stringify(receipt, null, 2));
  }
}

async function run() {
  const args = parseArgs(process.argv);
  const profile = stickersV1;

  let ok = 0;
  let failed = 0;

  if (!fs.existsSync(args.stagedDir)) {
    throw new Error(`Staged directory does not exist: ${args.stagedDir}`);
  }

  await fs.promises.mkdir(args.processedDir, { recursive: true });

  console.log(`Staged:    ${args.stagedDir}`);
  console.log(`Processed: ${args.processedDir}`);
  console.log(`Profile:   ${profile.name}-v${profile.version}`);
  console.log(`Mode:      ${args.dryRun ? "dry-run" : "write"}`);

  for await (const filePath of walkFiles(args.stagedDir)) {
    if (!isImageFile(filePath)) continue;

    const rel = path.relative(args.stagedDir, filePath);
    const relNoExt = rel.replace(path.extname(rel), "");
    const relNoExtSafe = relNoExt.split(path.sep).join(path.sep); // preserve subdirs

    try {
      const inputMeta = await sharp(filePath).metadata();
      const inputHadAlpha = !!inputMeta.hasAlpha;

      // For now, sourceHash is not computed in this stage by design.
      // Use a placeholder. Stage B will compute and build identity.
      const variants = await transformAsset({
        inputPath: filePath,
        sourceHash: "unmanifested",
        profile
      });

      // Validate outputs against profile constraints
      for (const spec of profile.variants) {
        const v = variants.find(x => x.key === spec.key);
        if (!v) throw new Error(`Missing expected variant: ${spec.key}`);

        await validateVariant(v, spec.maxSizePx, inputHadAlpha);
      }

      await writeVariants(variants, profile, relNoExtSafe, args.processedDir, args.dryRun);

      ok++;
      console.log(`OK   ${rel}`);
    } catch (err) {
      failed++;
      console.error(`FAIL ${rel}`);
      console.error(err instanceof Error ? err.message : String(err));
      if (args.failFast) process.exit(2);
    }
  }

  console.log(`Done. OK=${ok} FAILED=${failed}`);
  process.exit(failed > 0 ? 2 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(2);
});
