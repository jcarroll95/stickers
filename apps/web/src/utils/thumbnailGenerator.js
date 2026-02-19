/**
 * Generates a WebP thumbnail from a Konva Stage reference
 * @param {Object} stageRef - React ref to the Konva Stage
 * @param {number} maxDimension - Maximum width or height for the thumbnail
 * @param {number} maxBytes - Maximum filesize for the thumbnail in bytes (default: 99KB)
 * @returns {Promise<{blob: Blob, width: number, height: number, bytes: number, contentType: string}>}
 */
export async function generateThumbnailFromStage(stageRef, maxDimension = 600, maxBytes = 99 * 1024) {
  if (!stageRef?.current) {
    throw new Error('Invalid stage reference');
  }

  const stage = stageRef.current;

  // Force a redraw and wait a tiny bit to ensure all assets are rendered in the current frame
  stage.batchDraw();
  await new Promise(resolve => requestAnimationFrame(resolve));

  // Get the current stage dimensions
  const stageWidth = stage.width();
  const stageHeight = stage.height();

  // Try different quality and dimension settings to fit within maxBytes
  let currentMaxDimension = maxDimension;
  let quality = 0.85;
  let attempts = 0;
  const maxAttempts = 5;

  let blob, thumbnailWidth, thumbnailHeight, scale;

  while (attempts < maxAttempts) {
    // Calculate scale to fit within currentMaxDimension while maintaining aspect ratio
    scale = Math.min(currentMaxDimension / stageWidth, currentMaxDimension / stageHeight);
    thumbnailWidth = Math.round(stageWidth * scale);
    thumbnailHeight = Math.round(stageHeight * scale);

    // Convert stage to canvas with proper dimensions
    const canvas = stage.toCanvas({
      pixelRatio: scale,
    });

    // Convert canvas to WebP blob
    blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) {
            resolve(b);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        },
        'image/webp',
        quality // Quality setting (0-1)
      );
    });

    // If size is within limits or we've reached max attempts, break
    if (blob.size <= maxBytes || attempts === maxAttempts - 1) {
      break;
    }

    // Otherwise, reduce quality first, then dimensions
    if (attempts === 0) {
      quality = 0.7;
    } else if (attempts === 1) {
      quality = 0.5;
    } else if (attempts === 2) {
      currentMaxDimension = 400;
      quality = 0.7;
    } else if (attempts === 3) {
      currentMaxDimension = 300;
      quality = 0.5;
    }

    attempts++;
    console.log(`Thumbnail too large (${Math.round(blob.size / 1024)}KB), retrying with quality ${quality} and dimension ${currentMaxDimension}...`);
  }

  return {
    blob,
    width: thumbnailWidth,
    height: thumbnailHeight,
    bytes: blob.size,
    contentType: 'image/webp',
  };
}
