/**
 * Migration Script: User Stickers to StickerInventory
 *
 * Migrates legacy User.cheersStickers array to new StickerInventory system
 * Maps legacy numeric sticker IDs (0-9) to StickerDefinition documents
 *
 * Usage: node scripts/migrateUserStickersToInventory.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../config/config.env') });

const User = require('../models/User');
const StickerDefinition = require('../models/StickerDefinition');
const StickerInventory = require('../models/StickerInventory');

// Connect to DB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

/**
 * Map legacy sticker IDs (0-9) to StickerDefinition IDs
 * This assumes your StickerDefinition documents have a metadata.legacyId field
 * Adjust this logic based on your actual seed-data structure
 */
async function buildLegacyIdMap() {
  const stickers = await StickerDefinition.find({
    'metadata.legacyId': { $exists: true, $ne: null }
  });

  const map = {};
  stickers.forEach(sticker => {
    const legacyId = sticker.metadata.legacyId;
    if (typeof legacyId === 'number' && legacyId >= 0 && legacyId <= 9) {
      map[legacyId] = sticker._id;
    }
  });

  console.log('Legacy ID mapping:', map);
  return map;
}

/**
 * Migrate a single user's stickers
 */
async function migrateUser(user, legacyMap) {
  if (!user.cheersStickers || user.cheersStickers.length === 0) {
    return { skipped: true, reason: 'no stickers' };
  }

  // Count occurrences of each sticker ID
  const counts = {};
  user.cheersStickers.forEach(stickerId => {
    counts[stickerId] = (counts[stickerId] || 0) + 1;
  });

  const operations = [];

  for (const [legacyId, quantity] of Object.entries(counts)) {
    const legacyIdNum = parseInt(legacyId, 10);
    const stickerDefId = legacyMap[legacyIdNum];

    if (!stickerDefId) {
      console.warn(`No StickerDefinition found for legacy ID ${legacyId}`);
      continue;
    }

    // Create or update inventory entry
    operations.push({
      updateOne: {
        filter: { userId: user._id, stickerId: stickerDefId },
        update: {
          $set: {
            userId: user._id,
            stickerId: stickerDefId,
            quantity: quantity,
            updatedAt: Date.now()
          },
          $setOnInsert: {
            createdAt: Date.now()
          }
        },
        upsert: true
      }
    });
  }

  if (operations.length > 0) {
    await StickerInventory.bulkWrite(operations);
  }

  // Mark user as migrated (add flag to user document)
  await User.findByIdAndUpdate(user._id, {
    $set: { stickersMigrated: true, stickersMigratedAt: Date.now() }
  });

  return {
    migrated: true,
    inventoryEntries: operations.length,
    totalStickers: user.cheersStickers.length
  };
}

/**
 * Main migration function
 */
async function migrate() {
  try {
    console.log('  Starting User Stickers → StickerInventory migration\n');

    // Build legacy ID mapping
    const legacyMap = await buildLegacyIdMap();

    if (Object.keys(legacyMap).length === 0) {
      console.error('   No StickerDefinition documents found with metadata.legacyId');
      console.error('   Please ensure StickerDefinition documents are seeded first');
      process.exit(1);
    }

    // Get all users who haven't been migrated yet
    const users = await User.find({
      $or: [
        { stickersMigrated: { $ne: true } },
        { stickersMigrated: { $exists: false } }
      ]
    });

    console.log(`📊 Found ${users.length} users to migrate\n`);

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of users) {
      try {
        console.log(`Migrating user ${user._id} (${user.email})...`);
        const result = await migrateUser(user, legacyMap);

        if (result.skipped) {
          console.log(`    Skipped: ${result.reason}`);
          skipped++;
        } else {
          console.log(`   Migrated ${result.totalStickers} stickers into ${result.inventoryEntries} inventory entries`);
          migrated++;
        }
      } catch (err) {
        console.error(`   Failed to migrate user ${user._id}:`, err.message);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(' Migration Summary:');
    console.log(` Migrated: ${migrated}`);
    console.log(`️ Skipped:  ${skipped}`);
    console.log(` Failed:   ${failed}`);
    console.log('='.repeat(60) + '\n');

    if (failed > 0) {
      console.log('Some migrations failed. Review errors above.');
      process.exit(1);
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

// Handle interruption
process.on('SIGINT', () => {
  console.log('\nMigration interrupted');
  mongoose.connection.close(() => {
    process.exit(130);
  });
});

// Run migration
migrate();
