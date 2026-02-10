const mongoose = require('mongoose');
const dotenv = require('dotenv');
const StickerDefinition = require('../models/StickerDefinition');

// Load env vars
dotenv.config({ path: 'config/config.env' });

/**
 * Migration Script: V2 -> V3
 *
 * Objective:
 * Identify StickerDefinition entries that have a top-level 'imageUrl' field in BSON
 * and migrate them into the new 'media.variants' structure.
 */

const migrate = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/stickers');
        console.log(`MongoDB Connected: ${conn.connection.host}`);

        // 1. Find all stickers that have the imageUrl field in the database
        // We use .lean() or a raw query to ensure we see the field even if it's missing from the Schema
        // However, since we want to SAVE them via Mongoose, we'll fetch them as documents.
        // If 'imageUrl' is not in the schema, Mongoose might not include it in the doc unless we use .lean()
        // or the user has it as 'legacyImageUrl' with map: 'imageUrl'.

        // Let's use a raw query to find the IDs first to be safe
        const rawEntries = await StickerDefinition.collection.find({
            imageUrl: { $exists: true, $ne: null }
        }).toArray();

        console.log(`Found ${rawEntries.length} stickers needing migration.`);

        let updatedCount = 0;

        for (const entry of rawEntries) {
            // Check if it already has variants (don't overwrite if already migrated)
            if (entry.media && entry.media.variants && entry.media.variants.length > 0) {
                console.log(`Skipping ${entry.name} - already has media variants.`);
                continue;
            }

            const legacyUrl = entry.imageUrl;

            // Prepare the new media structure
            const updateData = {
                media: {
                    primaryKey: 'standard',
                    variants: [
                        {
                            key: 'standard',
                            url: legacyUrl,
                            format: 'png', // Default for legacy stickers
                            width: 512,    // Default fallback width
                            height: 512    // Default fallback height
                        }
                    ]
                }
            };

            // Also add a thumbnail variant if possible
            updateData.media.variants.push({
                key: 'thumb',
                url: legacyUrl,
                format: 'png',
                width: 128,
                height: 128
            });

            // Perform the update
            // We use $set to add the new structure and we can optionally $unset the old field
            // but the user might want to keep it for safety during the transition.
            await StickerDefinition.updateOne(
                { _id: entry._id },
                {
                    $set: updateData,
                    // Uncomment the line below if you want to remove the old field from BSON immediately
                    // $unset: { imageUrl: "" }
                }
            );

            console.log(`Migrated: ${entry.name} (${legacyUrl})`);
            updatedCount++;
        }

        console.log(`\nMigration complete!`);
        console.log(`Total stickers processed: ${rawEntries.length}`);
        console.log(`Total stickers updated: ${updatedCount}`);

        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

migrate();
