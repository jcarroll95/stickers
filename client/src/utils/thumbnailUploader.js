import { generateThumbnailFromStage } from './thumbnailGenerator';
import apiClient from '../services/apiClient';

const RATE_LIMIT_MS = 60000; // 60 seconds

/**
 * Gets the rate limit key for localStorage
 * @param {string} boardId - The stickerboard ID
 * @returns {string}
 */
function getRateLimitKey(boardId) {
  return `thumbnail_upload_${boardId}`;
}

/**
 * Checks if thumbnail upload is rate limited
 * @param {string} boardId - The stickerboard ID
 * @returns {boolean} - True if within rate limit window
 */
function isRateLimited(boardId) {
  const key = getRateLimitKey(boardId);
  const lastUpload = localStorage.getItem(key);

  if (!lastUpload) {
    return false;
  }

  const timeSinceLastUpload = Date.now() - parseInt(lastUpload, 10);
  return timeSinceLastUpload < RATE_LIMIT_MS;
}

/**
 * Updates the rate limit timestamp
 * @param {string} boardId - The stickerboard ID
 */
function updateRateLimitTimestamp(boardId) {
  const key = getRateLimitKey(boardId);
  localStorage.setItem(key, Date.now().toString());
}

/**
 * Uploads a thumbnail for a stickerboard
 * @param {string} boardId - The stickerboard ID
 * @param {Object} stageRef - React ref to the Konva Stage
 * @param {Object} options - Upload options
 * @param {boolean} options.force - If true, bypass rate limiting
 * @returns {Promise<void>}
 */
export async function uploadThumbnail(boardId, stageRef, options = {}) {
  const { force = false } = options;

  // Check rate limit unless forced
  if (!force && isRateLimited(boardId)) {
    console.log('Thumbnail upload rate limited, skipping');
    return;
  }

  try {
    // Step 1: Generate thumbnail from stage
    const { blob, width, height, bytes, contentType } = await generateThumbnailFromStage(stageRef);

    // Step 2: Request presigned URL from server
    const response = await apiClient.post(`/stickerboards/${boardId}/thumbnail`);
    const { uploadUrl, publicUrl, version } = response.data;

    // Step 3: Upload blob directly to S3
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Type': contentType,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`S3 upload failed: ${uploadResponse.statusText}`);
    }

    // Step 4: Confirm upload by updating database with thumbnail metadata
    await apiClient.put(`/stickerboards/${boardId}`, {
      thumbnail: {
        version,
        width,
        height,
        contentType,
        bytes,
        url: publicUrl,
      },
    });

    // Step 5: Update rate limit timestamp
    updateRateLimitTimestamp(boardId);

    console.log('Thumbnail uploaded successfully');
  } catch (error) {
    console.error('Thumbnail upload failed:', error);
    throw error;
  }
}
