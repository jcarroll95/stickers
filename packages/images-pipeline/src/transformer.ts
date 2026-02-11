import sharp from "sharp";
import {
  TransformInput,
  VariantResult,
  TransformVariantSpec
} from "./types";

function resizeInside(
  img: sharp.Sharp,
  spec: TransformVariantSpec,
  forbidEnlarge: boolean
): sharp.Sharp {
  return img.resize(spec.maxSizePx, spec.maxSizePx, {
    fit: "inside",
    withoutEnlargement: forbidEnlarge
  });
}

export async function transformAsset(
  input: TransformInput
): Promise<VariantResult[]> {
  const { inputPath, profile } = input;

  // Read once and clone for each variant
  let base = sharp(inputPath, { failOn: "error" });

  // Normalize colorspace
  base = base.toColorspace("srgb");

  const results: VariantResult[] = [];

  for (const spec of profile.variants) {
    let pipeline = base.clone();
    pipeline = resizeInside(pipeline, spec, profile.forbidEnlarge);

    if (spec.format === "webp") {
      pipeline = pipeline.webp({
        quality: profile.webpQuality,
        effort: 4
      });
    } else {
      pipeline = pipeline.png({
        compressionLevel: profile.pngCompressionLevel
      });
    }

    const { data, info } = await pipeline.toBuffer({
      resolveWithObject: true
    });

    if (!info.width || !info.height) {
      throw new Error(`Failed to read output dimensions for variant ${spec.key}`);
    }

    // never exceed maxSizePx
    if (
      info.width > spec.maxSizePx ||
      info.height > spec.maxSizePx
    ) {
      throw new Error(
        `Variant ${spec.key} exceeds maxSizePx=${spec.maxSizePx}: ${info.width}x${info.height}`
      );
    }

    results.push({
      key: spec.key,
      format: spec.format,
      width: info.width,
      height: info.height,
      byteSize: data.byteLength,
      buffer: data
    });
  }

  return results;
}
