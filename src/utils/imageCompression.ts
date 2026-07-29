// Photos picked on a phone routinely weigh 4–8MB for an image the feed renders
// at well under 1000px wide. Re-encoding the selection in a canvas before it
// leaves the browser cuts the upload to a fraction of that, which makes posting
// a photo feel instant on a mobile connection and keeps Supabase Storage from
// holding megapixels nobody ever sees.
//
// Compression is always best-effort: any format the browser cannot decode (HEIC
// on some devices), any animated source (GIF), and any result that is not
// actually smaller falls straight back to the original file.

export interface ImageCompressionOptions {
  /** longest edge of the output, in CSS pixels */
  maxDimension?: number;
  /** JPEG/WebP quality between 0 and 1 */
  quality?: number;
  /** selections at or below this size are already small enough to send as-is */
  skipBelowBytes?: number;
}

const DEFAULTS: Required<ImageCompressionOptions> = {
  maxDimension: 1600,
  quality: 0.82,
  skipBelowBytes: 256 * 1024,
};

/** Formats that must be sent untouched — animation or vector data would be lost. */
const PASS_THROUGH_TYPES = ['image/gif', 'image/svg+xml', 'image/apng'];

function isPassThrough(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (PASS_THROUGH_TYPES.includes(type)) return true;
  return /\.(gif|svg|apng)$/i.test(file.name ?? '');
}

function canCompress(): boolean {
  return typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined';
}

/** Decode the selection into something drawable, preferring the codec-backed path. */
async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      // `from-image` applies the EXIF rotation a phone camera records, so a
      // portrait photo is not re-encoded sideways.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // fall through to the <img> path
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('The image could not be decoded.'));
      element.src = objectUrl;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function outputName(name: string, extension: string): string {
  const base = (name || 'photo').replace(/\.[^.]+$/, '');
  return `${base}.${extension}`;
}

/** Extension matching what the canvas actually produced. */
function extensionFor(type: string): string {
  if (type === 'image/webp') return 'webp';
  if (type === 'image/png') return 'png';
  return 'jpg';
}

/**
 * Return a smaller version of the picked photo, or the original file whenever
 * shrinking it is impossible or pointless.
 */
export async function compressImageFile(file: File, options: ImageCompressionOptions = {}): Promise<File> {
  const { maxDimension, quality, skipBelowBytes } = { ...DEFAULTS, ...options };
  if (!canCompress() || isPassThrough(file) || file.size <= skipBelowBytes) return file;

  let decoded: Awaited<ReturnType<typeof decode>> | null = null;
  try {
    decoded = await decode(file);
    const { source, width, height } = decoded;
    if (!width || !height) return file;

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(source, 0, 0, targetWidth, targetHeight);

    // A photo with transparency has to stay PNG-free of a flattened background,
    // so keep WebP for those and use JPEG everywhere else (widest support).
    const keepsAlpha = (file.type || '').toLowerCase() === 'image/png';
    const outputType = keepsAlpha ? 'image/webp' : 'image/jpeg';
    const blob = await toBlob(canvas, outputType, quality);
    if (!blob || blob.size === 0) return file;
    // A canvas re-encode can come out larger than an already-optimised source.
    if (blob.size >= file.size) return file;

    // A browser that cannot encode the requested format answers with a PNG, so
    // the name and content type follow the blob rather than the request.
    const encodedType = (blob.type || outputType).toLowerCase();
    return new File([blob], outputName(file.name, extensionFor(encodedType)), {
      type: encodedType,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn('Image compression skipped; uploading the original file', error);
    return file;
  } finally {
    decoded?.release();
  }
}
