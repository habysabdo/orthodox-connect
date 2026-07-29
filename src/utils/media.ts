export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024;
export const MAX_VIDEO_SIZE_LABEL = '500MB';

export type VideoUploadStage = 'compressing' | 'uploading';
export type VideoUploadProgress = (percentage: number, stage?: VideoUploadStage) => void;

/** The title a video carries when there is no caption or name to draw one from. */
export const DEFAULT_VIDEO_TITLE = 'OrthodoxConnect Reel';
/** Long captions are trimmed so the Bunny Stream dashboard stays readable. */
const MAX_VIDEO_TITLE_LENGTH = 120;

/**
 * A single-line title for a video, taken from the first candidate that holds any
 * text — normally the post caption, then the broadcast title or author's name.
 * Captions are free-form, so newlines and runs of whitespace collapse and
 * anything overly long is cut short.
 */
export function videoTitleFrom(...candidates: (string | null | undefined)[]): string {
  for (const candidate of candidates) {
    const cleaned = (candidate ?? '').replace(/\s+/g, ' ').trim();
    if (cleaned) return cleaned.slice(0, MAX_VIDEO_TITLE_LENGTH).trim();
  }
  return DEFAULT_VIDEO_TITLE;
}

// Maps a file extension to the MIME type we serve/store the upload with. Used to
// recover a usable content type when the browser hands us a file with a blank
// `type` — common for videos recorded or picked on mobile (iOS Safari, some
// Android pickers) where the OS omits the MIME type entirely.
const EXTENSION_MIME_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};
const MIME_TYPE_NORMALIZATION: Record<string, string> = {
  'video/mp4': 'video/mp4',
  'video/webm': 'video/webm',
  'video/quicktime': 'video/quicktime',
};

// The file's extension, or '' when the name carries none. `split('.').pop()` on a
// dotless name returns the whole name, so require a real dot first.
function fileExtension(file: File): string {
  const name = file.name ?? '';
  if (!name.includes('.')) return '';
  return name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
}

// True when the selection should be treated as a video. We accept it if EITHER
// the browser reported a `video/*` MIME type OR the filename carries a known
// video extension (.mp4, .mov, or .webm). This deliberately does not
// reject a file just because its reported MIME type is non-video — desktop and
// mobile pickers routinely hand us `application/octet-stream` or a blank type
// for perfectly valid recordings, and we don't want to block those.
export function isPostVideoFile(file: File): boolean {
  if (file.type && Object.prototype.hasOwnProperty.call(MIME_TYPE_NORMALIZATION, file.type.toLowerCase())) return true;
  return Object.prototype.hasOwnProperty.call(EXTENSION_MIME_TYPES, fileExtension(file));
}

// Resolve the concrete MIME type the upload should be stored and served with.
// Mirrors the intended `contentType: file.type || 'video/mp4'` but also infers
// from the extension so blank-typed mobile recordings get a real video/* type
// instead of falling back to a possibly-wrong default.
export function resolveVideoContentType(file: File): string {
  const normalizedMimeType = MIME_TYPE_NORMALIZATION[file.type.toLowerCase()];
  if (normalizedMimeType) return normalizedMimeType;
  return EXTENSION_MIME_TYPES[fileExtension(file)] ?? 'video/mp4';
}

/**
 * Check the browser's declared HTML5 playback support before assigning a local
 * object URL to a video element. Codec-qualified MIME types are kept intact so
 * HEVC/H.265 selections can correctly fall back to a non-decoding file card.
 */
export function canPreviewVideoFile(file: File): boolean {
  if (typeof document === 'undefined') return false;
  const video = document.createElement('video');
  const reportedType = file.type.trim().toLowerCase();
  const playbackType = reportedType || resolveVideoContentType(file);
  return video.canPlayType(playbackType) !== '';
}

function validateVideoTypeAndContents(file: File): string | null {
  if (!isPostVideoFile(file)) {
    return 'Unsupported video format. Please select an MP4, MOV, or WebM video.';
  }

  if (file.size === 0) {
    return 'This video file is empty. Please select a different video.';
  }

  return null;
}

export function validatePostVideoSource(file: File): string | null {
  return validatePostVideo(file);
}

export function validatePostVideo(file: File): string | null {
  const baseError = validateVideoTypeAndContents(file);
  if (baseError) return baseError;

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return `Video file is too large (Max ${MAX_VIDEO_SIZE_LABEL})`;
  }

  return null;
}
