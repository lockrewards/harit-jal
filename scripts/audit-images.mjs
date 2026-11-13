import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const PUBLIC_DIR = path.resolve('public');
const SRC_DIR = path.resolve('src');
const INDEX_HTML = path.resolve('index.html');

// 1. Collect all images in public directory
function getFiles(dir) {
  const subdirs = fs.readdirSync(dir);
  const files = subdirs.map(subdir => {
    const res = path.resolve(dir, subdir);
    return fs.statSync(res).isDirectory() ? getFiles(res) : res;
  });
  return files.reduce((a, f) => a.concat(f), []);
}

const allPublicFiles = getFiles(PUBLIC_DIR);
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp', '.avif']);
const imageFiles = allPublicFiles.filter(f => imageExtensions.has(path.extname(f).toLowerCase()));

// 2. Scan codebase for usage
function getAllCodeFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllCodeFiles(fullPath));
    } else if (/\.(tsx|ts|jsx|js|html|css|json)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const codeFiles = [INDEX_HTML, ...getAllCodeFiles(SRC_DIR), ...getAllCodeFiles(path.resolve('public'))].filter(f => fs.existsSync(f));
const codeContents = codeFiles.map(f => ({
  file: path.relative(process.cwd(), f),
  content: fs.readFileSync(f, 'utf-8')
}));

async function audit() {
  const results = [];
  const hashMap = new Map();

  for (const imgPath of imageFiles) {
    const relToPublic = '/' + path.relative(PUBLIC_DIR, imgPath).replace(/\\/g, '/');
    const ext = path.extname(imgPath).toLowerCase();
    const stat = fs.statSync(imgPath);
    const buffer = fs.readFileSync(imgPath);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    let meta = { width: null, height: null, format: ext.replace('.', ''), hasAlpha: false };
    if (ext !== '.svg') {
      try {
        const sMeta = await sharp(buffer).metadata();
        meta.width = sMeta.width;
        meta.height = sMeta.height;
        meta.format = sMeta.format;
        meta.hasAlpha = sMeta.hasAlpha || false;
      } catch (err) {
        meta.error = err.message;
      }
    } else {
      meta.format = 'svg';
    }

    // Check usage in code
    const filename = path.basename(imgPath);
    const matchedFiles = [];
    for (const { file, content } of codeContents) {
      if (content.includes(relToPublic) || content.includes(filename) || content.includes(relToPublic.slice(1))) {
        matchedFiles.push(file);
      }
    }

    if (!hashMap.has(hash)) {
      hashMap.set(hash, []);
    }
    hashMap.get(hash).push(relToPublic);

    results.push({
      relPath: relToPublic,
      ext,
      sizeBytes: stat.size,
      sizeKB: (stat.size / 1024).toFixed(1),
      sizeMB: (stat.size / (1024 * 1024)).toFixed(2),
      width: meta.width,
      height: meta.height,
      hasAlpha: meta.hasAlpha,
      hash,
      usageCount: matchedFiles.length,
      usedIn: matchedFiles.slice(0, 3)
    });
  }

  // Find duplicates
  const duplicates = [];
  for (const [hash, paths] of hashMap.entries()) {
    if (paths.length > 1) {
      duplicates.push(paths);
    }
  }

  // Summary by extension
  const byExt = {};
  let totalBytes = 0;
  for (const r of results) {
    totalBytes += r.sizeBytes;
    byExt[r.ext] = (byExt[r.ext] || 0) + 1;
  }

  const output = {
    totalImages: results.length,
    totalSizeBytes: totalBytes,
    totalSizeMB: (totalBytes / (1024 * 1024)).toFixed(2),
    countsByExtension: byExt,
    duplicates,
    images: results.sort((a, b) => b.sizeBytes - a.sizeBytes)
  };

  console.log(JSON.stringify(output, null, 2));
}

audit().catch(console.error);

