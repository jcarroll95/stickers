export type VariantKey = "thumb" | "small" | "medium" | "full";

export type OutputFormat = "webp" | "png";

export interface TransformVariantSpec {
  key: VariantKey;
  maxSizePx: number;         // max of width/height
  format: OutputFormat;
}

export interface TransformProfile {
  name: string;              // e.g. "stickers"
  version: number;           // bump when you change settings/sizes
  variants: TransformVariantSpec[];
  webpQuality: number;       // used when format=webp
  pngCompressionLevel: number;
  forbidEnlarge: boolean;
  stripMetadata: boolean;
}

export interface TransformInput {
  inputPath: string;
  sourceHash: string;        // your idempotency anchor from raw bytes
  profile: TransformProfile;
}

export interface VariantResult {
  key: VariantKey;
  format: OutputFormat;
  width: number;
  height: number;
  byteSize: number;
  buffer: Buffer;
}
