
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ASSETS_DIR = path.join(__dirname, 'public/assets');
const WIDTHS = [400, 800, 1200];
const FORMATS = ['webp', 'png'];
const QUALITY = 80;

// Get all files recursively from directory
function getAllFiles(dir) {
    let files = [];
    const items = fs.readdirSync(dir);

    items.forEach(item => {
        const itemPath = path.join(dir, item);
        if (fs.statSync(itemPath).isDirectory()) {
            files = files.concat(getAllFiles(itemPath)); // Recursively get files from subdirectories
        } else {
            files.push(itemPath);
        }
    });

    return files;
}

// Files to process (PNG images only, excluding already optimized variants)
const shouldProcessFile = (filename) => {
    return filename.endsWith('.png') &&
        !filename.includes('-400w') &&
        !filename.includes('-800w') &&
        !filename.includes('-1200w');
};

// Get base name without extension
const getBaseName = (filename) => {
    return filename.replace('.png', '');
};

// Process a single image
async function processImage(inputPath, baseName) {
    console.log(`Processing: ${baseName}.png`);

    const metadata = await sharp(inputPath).metadata();
    const originalWidth = metadata.width;

    console.log(`  Original size: ${originalWidth}x${metadata.height}`);

    for (const width of WIDTHS) {
        // Skip if the target width is larger than the original
        if (width > originalWidth) {
            console.log(`  Skipping ${width}w (larger than original ${originalWidth}px)`);
            continue;
        }

        for (const format of FORMATS) {
            const outputFilename = `${baseName}-${width}w.${format}`;
            const outputPath = path.join(ASSETS_DIR, outputFilename);

            try {
                await sharp(inputPath)
                    .resize(width, null, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    [format]({ quality: QUALITY })
                    .toFile(outputPath);

                const stats = fs.statSync(outputPath);
                const sizeMB = (stats.size / 1024).toFixed(1);
                console.log(`Generated ${outputFilename} (${sizeMB}KB)`);
            } catch (error) {
                console.error(`Failed to generate ${outputFilename}:`, error.message);
            }
        }
    }

    console.log('');
}

// Main function
async function optimizeImages() {
    console.log('Image Optimization Script\n');
    console.log(`Source directory: ${ASSETS_DIR}`);
    console.log(`Generating variants: ${WIDTHS.map(w => w + 'w').join(', ')}`);
    console.log(`Formats: ${FORMATS.join(', ')}`);
    console.log(`Quality: ${QUALITY}\n`);

    if (!fs.existsSync(ASSETS_DIR)) {
        console.error(`Error: Assets directory not found at ${ASSETS_DIR}`);
        process.exit(1);
    }

    // Get all files recursively
    const allFiles = getAllFiles(ASSETS_DIR);
    const imagesToProcess = allFiles.filter(shouldProcessFile);

    if (imagesToProcess.length === 0) {
        console.log('No images found to process.');
        return;
    }

    console.log(`Found ${imagesToProcess.length} images to process:\n`);

    let processed = 0;
    let errors = 0;

    for (const inputPath of imagesToProcess) {
        const filename = path.basename(inputPath);
        const baseName = getBaseName(filename);

        try {
            await processImage(inputPath, baseName);
            processed++;
        } catch (error) {
            console.error(`Failed to process ${filename}:`, error.message);
            errors++;
        }
    }

    console.log('─'.repeat(50));
    console.log(`✨ Complete! Processed ${processed} images`);
    if (errors > 0) {
        console.log(`⚠️  ${errors} errors occurred`);
    }

    // Calculate space savings
    const originalFiles = imagesToProcess;
    const generatedFiles = fs.readdirSync(ASSETS_DIR)
        .filter(f => f.includes('-400w') || f.includes('-800w') || f.includes('-1200w'))
        .map(f => path.join(ASSETS_DIR, f));

    if (originalFiles.length > 0 && generatedFiles.length > 0) {
        const originalSize = originalFiles.reduce((sum, f) => sum + fs.statSync(f).size, 0);
        const generatedSize = generatedFiles.reduce((sum, f) => sum + fs.statSync(f).size, 0);
        const savings = ((1 - generatedSize / originalSize / imagesToProcess.length) * 100).toFixed(1);

        console.log(`\nOriginal files: ${(originalSize / 1024).toFixed(1)}KB`);
        console.log(`Generated files (avg per image): ${(generatedSize / imagesToProcess.length / 1024).toFixed(1)}KB`);
        console.log(`Average savings per image: ~${savings}%`);
    }
}

// Run the script
optimizeImages().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});