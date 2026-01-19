/**
 * Generates a WebP thumbnail from a Konva Stage reference
 * @param {Object} stageRef - React ref to the Konva Stage
 * @param {number} maxDimension - Maximum width or height for the thumbnail
 * @returns {Promise<{blob: Blob, width: number, height: number, bytes: number, contentType: string}>}
 */
export async function generateThumbnailFromStage(stageRef, maxDimension = 600) {
  if (!stageRef?.current) {
    throw new Error('Invalid stage reference');
  }

  const stage = stageRef.current;

  // Get the current stage dimensions
  const stageWidth = stage.width();
  const stageHeight = stage.height();

  // Calculate scale to fit within maxDimension while maintaining aspect ratio
  const scale = Math.min(maxDimension / stageWidth, maxDimension / stageHeight);
  const thumbnailWidth = Math.round(stageWidth * scale);
  const thumbnailHeight = Math.round(stageHeight * scale);

  // Convert stage to canvas with proper dimensions
  const canvas = stage.toCanvas({
    pixelRatio: scale,
  });

  // Convert canvas to WebP blob
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      'image/webp',
      0.85 // Quality setting (0-1)
    );
  });

  return {
    blob,
    width: thumbnailWidth,
    height: thumbnailHeight,
    bytes: blob.size,
    contentType: 'image/webp',
  };
}
