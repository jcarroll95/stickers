/*

    V1 approach to stickers:
           assets are processed and uploaded to media.stickerboards.app, pushed by CDN
           User stickers exist in StickerboardSchema.stickers[] by id number, which is hardcoded
            to correspond to an asset filename.
           Cheers stickers exist in UserSchema.cheers[] by id number, which is hardcoded to
            correspond to an asset filename.
    V2 approach to stickers:
           Individual sticker entries are defined in the collection StickerDefinition
            This includes a url to the asset file, versioning, if they are associated to a Pack, 
                and metadata such as artist and series.
           Sets of stickers are called Sticker Packs and are in the collection StickerPack
            Packs ref to individual StickerDefinition entries by id number
           Stickers and packs available to a user will be listed in the UserSchema 
           Stickers that have been applied to a board will be listed in the StickerboardSchema
 
    This script will migrate current stickers and assets from the V1 approach to the V2 approach.
    
 */


const mongoose = require('mongoose');
const dotenv = require('dotenv');
const StickerDefinition = require('../models/StickerDefinition');
const StickerPack = require('../models/StickerPack');
dotenv.config({ path: '../config/config.env' });

const ASSETS_BASE_URL = 'https://media.stickerboards.app/assets';

const V1_STICKERS = [
    { id: 0, name: 'Sticker 0' },
    { id: 1, name: 'Sticker 1' },
    { id: 2, name: 'Sticker 2' },
    { id: 3, name: 'Sticker 3' },
    { id: 4, name: 'Sticker 4' },
    { id: 5, name: 'Sticker 5' },
    { id: 6, name: 'Sticker 6' },
    { id: 7, name: 'Sticker 7' },
    { id: 8, name: 'Sticker 8' },
    { id: 9, name: 'Sticker 9' }
];

const V1_CHEERS = [
    { id: 0, name: 'Cheers 0' },
    { id: 1, name: 'Cheers 1' },
    { id: 2, name: 'Cheers 2' },
    { id: 3, name: 'Cheers 3' },
    { id: 4, name: 'Cheers 4' }
];

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log('Connected to database...');

        const stickerMap = {};
        const cheersMap = {};

        // Migrate regular stickers
        console.log('Migrating regular stickers...');
        for (const s of V1_STICKERS) {
            const imageUrl = `${ASSETS_BASE_URL}/sticker${s.id}.png`;
            let def = await StickerDefinition.findOne({ imageUrl });
            
            if (!def) {
                def = await StickerDefinition.create({
                    name: s.name,
                    imageUrl,
                    tags: ['legacy', 'regular'],
                    metadata: { series: 'Legacy V1' }
                });
                console.log(`Created StickerDefinition for ${s.name}`);
            }
            stickerMap[s.id] = def._id;
        }

        // Migrate cheers stickers
        console.log('Migrating cheers stickers...');
        for (const c of V1_CHEERS) {
            const imageUrl = `${ASSETS_BASE_URL}/c${c.id}.png`;
            let def = await StickerDefinition.findOne({ imageUrl });

            if (!def) {
                def = await StickerDefinition.create({
                    name: c.name,
                    imageUrl,
                    tags: ['legacy', 'cheers'],
                    metadata: { series: 'Legacy Cheers V1' }
                });
                console.log(`Created StickerDefinition for ${c.name}`);
            }
            cheersMap[c.id] = def._id;
        }

        // Create legacy packs
        console.log('Creating legacy packs...');
        
        const regularPackName = 'Legacy Starter Pack';
        let regularPack = await StickerPack.findOne({ name: regularPackName });
        if (!regularPack) {
            regularPack = await StickerPack.create({
                name: regularPackName,
                packType: 'Basic',
                stickers: Object.values(stickerMap)
            });
            console.log('Created Legacy Starter Pack');
        }

        const cheersPackName = 'Legacy Cheers Pack';
        let cheersPack = await StickerPack.findOne({ name: cheersPackName });
        if (!cheersPack) {
            cheersPack = await StickerPack.create({
                name: cheersPackName,
                packType: 'Basic',
                stickers: Object.values(cheersMap)
            });
            console.log('Created Legacy Cheers Pack');
        }

        console.log('Migration completed successfully');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

migrate();

