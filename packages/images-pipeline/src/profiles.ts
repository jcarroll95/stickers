import { TransformProfile } from "./types";

export const stickersV1: TransformProfile = {
  name: "stickers",
  version: 1,
  variants: [
    { key: "thumb",  maxSizePx: 128,  format: "webp" },
    { key: "small",  maxSizePx: 256,  format: "webp" },
    { key: "medium", maxSizePx: 512,  format: "webp" },
    { key: "full",   maxSizePx: 1024, format: "png"  }
  ],
  webpQuality: 82,
  pngCompressionLevel: 9,
  forbidEnlarge: true,
  stripMetadata: true
};
