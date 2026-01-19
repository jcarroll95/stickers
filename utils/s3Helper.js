import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Generates a presigned URL for uploading a thumbnail to DigitalOcean Spaces
 * @param {string} stickerboardId - The ID of the stickerboard
 * @returns {Promise<{uploadUrl: string, publicUrl: string, key: string, version: number, contentType: string}>}
 */
export async function generateThumbnailUploadUrl(stickerboardId) {
    const s3 = new S3Client({
        region: "us-east-1",
        endpoint: process.env.DO_SPACES_ENDPOINT,
        forcePathStyle: false,
        credentials: {
            accessKeyId: process.env.DO_SPACES_KEY,
            secretAccessKey: process.env.DO_SPACES_SECRET,
        },
        // Disable request checksums for DigitalOcean Spaces compatibility
        requestChecksumCalculation: "WHEN_REQUIRED",
    });

    // Define versioned key
    const version = Date.now();
    const key = `thumbnails/${stickerboardId}/${version}.webp`;
    const bucket = process.env.DO_SPACES_BUCKET;
    const contentType = "image/webp";

    // Create presigned PUT command
    // Note: DO NOT include ContentType here - it must be sent as a header instead
    const cmd = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        CacheControl: "public, max-age=31536000, immutable",
        ChecksumAlgorithm: undefined, // Disable checksums for DO Spaces
    });

    const uploadUrl = await getSignedUrl(s3, cmd, {
        expiresIn: 60,
        unhoistableHeaders: new Set(['x-amz-checksum-crc32']),
        // Don't sign the Content-Type header - let it be sent by the client
        signableHeaders: new Set(['host']),
    });
    const publicUrl = `${process.env.MEDIA_CDN_ORIGIN}/${key}`;

    return { uploadUrl, publicUrl, key, version, contentType };
}
