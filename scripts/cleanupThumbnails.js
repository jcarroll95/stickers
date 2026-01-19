/**
 * Cleanup script for old thumbnail versions
 *
 * Usage:
 *   node scripts/cleanupThumbnails.js [keepCount]
 *
 * Examples:
 *   node scripts/cleanupThumbnails.js       # Keep 3 versions per board (default)
 *   node scripts/cleanupThumbnails.js 5     # Keep 5 versions per board
 */

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../config/config.env') });

const connectDB = require('../config/db');
const Stickerboard = require('../models/Stickerboard');

async function cleanupAllThumbnails(keepCount = 3) {
    try {
        console.log('Starting thumbnail cleanup...');
        console.log(`Keeping ${keepCount} most recent versions per board\n`);

        // Connect to database
        await connectDB();

        // Get all stickerboards that have thumbnails
        const boards = await Stickerboard.find({
            'thumbnail.url': { $exists: true, $ne: null }
        }).select('_id name thumbnail');

        console.log(`Found ${boards.length} boards with thumbnails\n`);

        if (boards.length === 0) {
            console.log('No boards with thumbnails found. Exiting.');
            process.exit(0);
        }

        // Dynamically import ES module
        const { cleanupOldThumbnails } = await import('../utils/s3Helper.js');

        let totalDeleted = 0;

        // Process each board
        for (const board of boards) {
            try {
                const deleted = await cleanupOldThumbnails(board._id.toString(), keepCount);

                if (deleted > 0) {
                    console.log(`✓ ${board.name || board._id}: Deleted ${deleted} old thumbnail(s)`);
                    totalDeleted += deleted;
                } else {
                    console.log(`- ${board.name || board._id}: No cleanup needed`);
                }
            } catch (err) {
                console.error(`✗ ${board.name || board._id}: Error - ${err.message}`);
            }
        }

        console.log(`\n✓ Cleanup complete! Deleted ${totalDeleted} old thumbnail(s) across ${boards.length} board(s)`);
        process.exit(0);

    } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    }
}

// Get keepCount from command line argument, default to 3
const keepCount = parseInt(process.argv[2]) || 3;

if (keepCount < 1) {
    console.error('Error: keepCount must be at least 1');
    process.exit(1);
}

cleanupAllThumbnails(keepCount);
