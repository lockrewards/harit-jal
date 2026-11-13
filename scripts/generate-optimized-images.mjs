import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PUBLIC_DIR = path.resolve('public');

// Recursively find all PNG, JPG, JPEG files in public
function getRasterImages(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getRasterImages(full));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      // Only process original png, jpg, jpeg (skip already generated -480w, etc.)
      if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        if (!/-(\d+)w\.(avif|webp|png|jpg)$/.test(entry.name)) {
          files.push(full);
        }
      }
    }
  }
  return files;
}

const images = getRasterImages(PUBLIC_DIR);
console.log(`Found ${images.length} original raster images to process in public/`);

async function processAll() {
  const manifest = {};
  let totalOriginalBytes = 0;
  let totalAvifBytes = 0;
  let totalWebpBytes = 0;
  let totalMobileAvifBytes = 0;
  let optimizedCount = 0;

  for (let i = 0; i < images.length; i++) {
    const imgPath = images[i];
    const relPath = '/' + path.relative(PUBLIC_DIR, imgPath).replace(/\\/g, '/');
    const ext = path.extname(imgPath);
    const dir = path.dirname(imgPath);
    const basename = path.basename(imgPath, ext);

    const stat = fs.statSync(imgPath);
    totalOriginalBytes += stat.size;

    try {
      const imageInstance = sharp(imgPath);
      const meta = await imageInstance.metadata();
      const hasAlpha = !!meta.hasAlpha;
      const width = meta.width;
      const height = meta.height;

      // AVIF Options
      const avifOptions = {
        quality: hasAlpha ? 85 : 80,
        effort: 6,
        chromaSubsampling: hasAlpha ? '4:4:4' : '4:2:0'
      };

      // WebP Options
      const webpOptions = {
        quality: hasAlpha ? 85 : 82,
        effort: 6,
        alphaQuality: hasAlpha ? 100 : 80
      };

      // 1. Full-size AVIF
      const fullAvifPath = path.join(dir, `${basename}.avif`);
      await sharp(imgPath)
        .avif(avifOptions)
        .toFile(fullAvifPath);
      const fullAvifStat = fs.statSync(fullAvifPath);
      totalAvifBytes += fullAvifStat.size;

      // 2. Full-size WebP
      const fullWebpPath = path.join(dir, `${basename}.webp`);
      await sharp(imgPath)
        .webp(webpOptions)
        .toFile(fullWebpPath);
      const fullWebpStat = fs.statSync(fullWebpPath);
      totalWebpBytes += fullWebpStat.size;

      const avifVariants = [];
      const webpVariants = [];

      // If image is larger than 600px, create responsive sizes
      if (width && width > 600) {
        const targetWidths = [480, 768];
        if (width > 1100) targetWidths.push(1024);

        for (const tw of targetWidths) {
          if (tw < width) {
            const avifResPath = path.join(dir, `${basename}-${tw}w.avif`);
            await sharp(imgPath)
              .resize({ width: tw, withoutEnlargement: true, fit: 'inside' })
              .avif(avifOptions)
              .toFile(avifResPath);
            const avifRel = '/' + path.relative(PUBLIC_DIR, avifResPath).replace(/\\/g, '/');
            avifVariants.push(`${avifRel} ${tw}w`);

            if (tw === 480) {
              totalMobileAvifBytes += fs.statSync(avifResPath).size;
            }

            const webpResPath = path.join(dir, `${basename}-${tw}w.webp`);
            await sharp(imgPath)
              .resize({ width: tw, withoutEnlargement: true, fit: 'inside' })
              .webp(webpOptions)
              .toFile(webpResPath);
            const webpRel = '/' + path.relative(PUBLIC_DIR, webpResPath).replace(/\\/g, '/');
            webpVariants.push(`${webpRel} ${tw}w`);
          }
        }
      }

      // Add full size to srcsets
      const fullAvifRel = '/' + path.relative(PUBLIC_DIR, fullAvifPath).replace(/\\/g, '/');
      const fullWebpRel = '/' + path.relative(PUBLIC_DIR, fullWebpPath).replace(/\\/g, '/');
      avifVariants.push(`${fullAvifRel} ${width}w`);
      webpVariants.push(`${fullWebpRel} ${width}w`);

      manifest[relPath] = {
        original: relPath,
        width,
        height,
        aspectRatio: width && height ? `${width}/${height}` : undefined,
        hasAlpha,
        originalSizeBytes: stat.size,
        avif: {
          src: fullAvifRel,
          srcset: avifVariants.join(', '),
          sizeBytes: fullAvifStat.size
        },
        webp: {
          src: fullWebpRel,
          srcset: webpVariants.join(', '),
          sizeBytes: fullWebpStat.size
        }
      };

      optimizedCount++;
      if ((i + 1) % 10 === 0 || i === images.length - 1) {
        console.log(`[${i + 1}/${images.length}] Processed ${relPath}`);
      }
    } catch (err) {
      console.error(`Failed to process ${relPath}:`, err.message);
    }
  }

  // Save manifest
  const manifestPath = path.join(PUBLIC_DIR, 'images-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`\nImage manifest written to ${manifestPath}`);

  // Summary Report
  const origMB = (totalOriginalBytes / (1024 * 1024)).toFixed(2);
  const avifMB = (totalAvifBytes / (1024 * 1024)).toFixed(2);
  const webpMB = (totalWebpBytes / (1024 * 1024)).toFixed(2);
  const avifSavingsPct = (100 - (totalAvifBytes / totalOriginalBytes * 100)).toFixed(1);
  const webpSavingsPct = (100 - (totalWebpBytes / totalOriginalBytes * 100)).toFixed(1);

  console.log('\n======================================================');
  console.log('HARIT JAL IMAGE OPTIMIZATION SUMMARY REPORT');
  console.log('======================================================');
  console.log(`Total raster images processed: ${optimizedCount} / ${images.length}`);
  console.log(`Original total size (PNG/JPG): ${origMB} MB (${totalOriginalBytes.toLocaleString()} bytes)`);
  console.log(`Full AVIF total size:          ${avifMB} MB (${totalAvifBytes.toLocaleString()} bytes) -> ${avifSavingsPct}% Bandwidth Saved!`);
  console.log(`Full WebP total size:          ${webpMB} MB (${totalWebpBytes.toLocaleString()} bytes) -> ${webpSavingsPct}% Bandwidth Saved!`);
  console.log('======================================================\n');
}

processAll().catch(console.error);

