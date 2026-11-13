import fs from 'node:fs';
import path from 'node:path';

const jsonPath = path.resolve('public/images-manifest.json');
const tsPath = path.resolve('src/data/imageManifest.ts');

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

const tsCode = `// HARIT JAL™ Image Optimization Manifest (Auto-Generated)
// Maps original image paths to their AVIF, WebP and responsive resolution srcsets

export interface ImageManifestEntry {
  original: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  hasAlpha: boolean;
  originalSizeBytes: number;
  avif: {
    src: string;
    srcset: string;
    sizeBytes: number;
  };
  webp: {
    src: string;
    srcset: string;
    sizeBytes: number;
  };
}

export const IMAGE_MANIFEST: Record<string, ImageManifestEntry> = ${JSON.stringify(data, null, 2)};

export function getImageVariants(src: string): ImageManifestEntry | null {
  if (!src) return null;
  const normalized = src.startsWith('/') ? src : '/' + src;
  return IMAGE_MANIFEST[normalized] || null;
}
`;

fs.writeFileSync(tsPath, tsCode, 'utf-8');
console.log('src/data/imageManifest.ts written successfully!');

