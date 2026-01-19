import { generateThumbnailFromStage } from './thumbnailGenerator';
import apiClient from '../services/apiClient';

/**
 * Uploads a thumbnail for a stickerboard
 * Server handles rate limiting (per user per board, 60s window)
 * @param {string} boardId - The stickerboard ID
 * @param {Object} stageRef - React ref to the Konva Stage
 * @returns {Promise<void>}
 */
export async function uploadThumbnail(boardId, stageRef) {

  try {
    // Step 1: Generate thumbnail from stage
    const { blob, width, height } = await generateThumbnailFromStage(stageRef);

    // Step 2: Convert blob to base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Step 3: Send to backend (backend handles S3 upload, DB update, cleanup, and rate limiting)
    await apiClient.post(`/stickerboards/${boardId}/thumbnail`, {
      imageData: base64,
      width,
      height,
    });

    console.log('Thumbnail uploaded successfully');
  } catch (error) {
    // If rate limited (429), silently skip - this is expected behavior
    if (error.response?.status === 429) {
      console.log('Thumbnail upload rate limited by server, skipping');
      return;
    }

    console.error('Thumbnail upload failed:', error);
    throw error;
  }
}
