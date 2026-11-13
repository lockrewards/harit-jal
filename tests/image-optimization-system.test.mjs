// ====================================================================
// HARIT JAL™ (हरित जल) — IMAGE OPTIMIZATION TEST SUITE
// Verifies AVIF, WebP, responsive srcsets, transparency, fallbacks,
// and storage/bandwidth savings metrics
// ====================================================================

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PUBLIC_DIR = path.resolve('public');

test('TEST 1: Original Images Preserved (Zero Deletions)', () => {
  const manifestPath = path.join(PUBLIC_DIR, 'images-manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'images-manifest.json must exist');
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const keys = Object.keys(manifest);
  assert.ok(keys.length >= 88, `Must have at least 88 audited images (found ${keys.length})`);

  // Verify that every single original file exists on disk
  for (const relPath of keys) {
    const fullPath = path.join(PUBLIC_DIR, relPath.replace(/^\//, ''));
    assert.ok(fs.existsSync(fullPath), `Original image must NOT be deleted: ${relPath}`);
  }
});

test('TEST 2: Dual Modern Format Delivery (AVIF + WebP Generated)', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'images-manifest.json'), 'utf-8'));
  
  let checkedCount = 0;
  for (const [relPath, entry] of Object.entries(manifest)) {
    const avifDiskPath = path.join(PUBLIC_DIR, entry.avif.src.replace(/^\//, ''));
    const webpDiskPath = path.join(PUBLIC_DIR, entry.webp.src.replace(/^\//, ''));
    
    assert.ok(fs.existsSync(avifDiskPath), `AVIF must exist for ${relPath}`);
    assert.ok(fs.existsSync(webpDiskPath), `WebP must exist for ${relPath}`);
    
    // Check non-zero size
    assert.ok(fs.statSync(avifDiskPath).size > 0, `AVIF file must not be empty: ${entry.avif.src}`);
    assert.ok(fs.statSync(webpDiskPath).size > 0, `WebP file must not be empty: ${entry.webp.src}`);
    checkedCount++;
  }
  
  assert.strictEqual(checkedCount, Object.keys(manifest).length);
});

test('TEST 3: Multi-Resolution Responsive Variants for Mobile, Tablet & Desktop', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'images-manifest.json'), 'utf-8'));
  
  // High-value display images (width > 600) must have 480w mobile variants
  const largeImages = Object.entries(manifest).filter(([_, entry]) => entry.width && entry.width > 600);
  assert.ok(largeImages.length > 20, 'Must have responsive variants for large images');

  for (const [relPath, entry] of largeImages) {
    assert.ok(entry.avif.srcset.includes('480w'), `AVIF srcset must contain 480w mobile resolution for ${relPath}`);
    assert.ok(entry.webp.srcset.includes('480w'), `WebP srcset must contain 480w mobile resolution for ${relPath}`);
    if (entry.width >= 768) {
      assert.ok(entry.avif.srcset.includes('768w'), `AVIF srcset must contain 768w tablet resolution for ${relPath}`);
      assert.ok(entry.webp.srcset.includes('768w'), `WebP srcset must contain 768w tablet resolution for ${relPath}`);
    }
  }
});

test('TEST 4: Alpha Transparency Preservation (No Black/White Fringes)', async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'images-manifest.json'), 'utf-8'));
  
  // Find transparent images like logo-mark or luxury-water-droplet-ripple
  const transparentEntries = Object.entries(manifest).filter(([_, e]) => e.hasAlpha);
  assert.ok(transparentEntries.length > 10, 'Must identify transparent images');

  // Test logo mark transparency
  const logoKey = Object.keys(manifest).find(k => k.includes('harit-jal-logo-mark.png'));
  assert.ok(logoKey, 'harit-jal-logo-mark.png must be in manifest');
  const logoEntry = manifest[logoKey];
  
  const avifPath = path.join(PUBLIC_DIR, logoEntry.avif.src.replace(/^\//, ''));
  const webpPath = path.join(PUBLIC_DIR, logoEntry.webp.src.replace(/^\//, ''));
  
  const avifMeta = await sharp(avifPath).metadata();
  const webpMeta = await sharp(webpPath).metadata();
  
  assert.strictEqual(avifMeta.hasAlpha, true, 'AVIF must preserve alpha transparency channel');
  assert.strictEqual(webpMeta.hasAlpha, true, 'WebP must preserve alpha transparency channel');
  assert.strictEqual(avifMeta.channels, 4, 'AVIF must retain 4 channels (RGBA)');
  assert.strictEqual(webpMeta.channels, 4, 'WebP must retain 4 channels (RGBA)');
});

test('TEST 5: Zero Broken Image References across Products and Codebase', () => {
  const productsCode = fs.readFileSync(path.resolve('src/data/products.ts'), 'utf-8');
  const matches = productsCode.match(/\/images\/[a-zA-Z0-9_\-\.\/]+/g) || [];
  
  for (const match of matches) {
    const fullPath = path.join(PUBLIC_DIR, match.replace(/^\//, ''));
    assert.ok(fs.existsSync(fullPath), `Product image referenced in products.ts must exist on disk: ${match}`);
  }
});

test('TEST 6: Storage Reduction & Bandwidth Savings Validation', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'images-manifest.json'), 'utf-8'));
  
  let totalOrig = 0;
  let totalAvif = 0;
  let totalWebp = 0;
  
  for (const entry of Object.values(manifest)) {
    totalOrig += entry.originalSizeBytes;
    totalAvif += entry.avif.sizeBytes;
    totalWebp += entry.webp.sizeBytes;
  }
  
  const avifSavingsPct = (100 - (totalAvif / totalOrig * 100));
  const webpSavingsPct = (100 - (totalWebp / totalOrig * 100));
  
  console.log(`Original: ${(totalOrig / (1024*1024)).toFixed(2)} MB`);
  console.log(`AVIF:     ${(totalAvif / (1024*1024)).toFixed(2)} MB (${avifSavingsPct.toFixed(1)}% savings)`);
  console.log(`WebP:     ${(totalWebp / (1024*1024)).toFixed(2)} MB (${webpSavingsPct.toFixed(1)}% savings)`);
  
  assert.ok(avifSavingsPct > 80, `AVIF must save > 80% bandwidth (achieved ${avifSavingsPct.toFixed(1)}%)`);
  assert.ok(webpSavingsPct > 80, `WebP must save > 80% bandwidth (achieved ${webpSavingsPct.toFixed(1)}%)`);
});
