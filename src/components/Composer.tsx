import { useEffect, useRef, useState } from 'react';
import { Briefcase, CheckCircle2, Film, HandHeart, ImagePlus, Loader2, Radio, Send, X } from 'lucide-react';
import { Avatar } from './ui';
import { GifPicker } from './GifPicker';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import {
  canPreviewVideoFile,
  isPostVideoFile,
  validatePostVideoSource,
} from '@/utils/media';
import { isImageFile, uploadPostImage, validateImage } from '@/utils/imageUpload';
import { uploadFeedVideo, videoUploadErrorMessage } from '@/utils/videoUpload';

const PRAYER_REQUEST_IMAGE = '/images/prayer-request-background.jpg';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${Number((bytes / 1024 / 1024).toFixed(1))} MB`;
}

/** The progress strip shown over an attachment while it is on its way. */
function UploadProgress({ label, percentage, complete }: { label: string; percentage: number; complete: boolean }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 bg-black/80 px-3 py-2.5 backdrop-blur-sm" aria-live="polite">
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/85">
        <span className="flex min-w-0 items-center gap-1.5">
          {complete ? (
            <CheckCircle2 size={13} className="shrink-0 text-emerald-300" />
          ) : (
            <Loader2 size={13} className="shrink-0 animate-spin" />
          )}
          <span className="truncate">{label}</span>
        </span>
        <span>{complete ? '100%' : `${percentage}%`}</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-white/20"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-[width] ${complete ? 'bg-emerald-400' : 'bg-gold-400'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function Composer() {
  const { users, currentUserId, createPost, createPromoPost } = useStore();
  const { setGoLiveOpen } = useUI();
  const me = users.find((u) => u.id === currentUserId);
  const [text, setText] = useState('');
  const [promoTitle, setPromoTitle] = useState('');
  const [isPromo, setIsPromo] = useState(false);
  const [submissionNotice, setSubmissionNotice] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [imagePreview, setImagePreview] = useState<{ preview: string; name: string } | undefined>();
  const [isPrayerRequest, setIsPrayerRequest] = useState(false);
  const [video, setVideo] = useState<{ preview?: string; name: string; size: number } | undefined>();
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [focused, setFocused] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeUploadRef = useRef<AbortController | null>(null);
  const pendingVideoFileRef = useRef<File | null>(null);
  const uploadRequestRef = useRef(0);

  useEffect(() => {
    return () => {
      if (video?.preview) URL.revokeObjectURL(video.preview);
    };
  }, [video]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview.preview);
    };
  }, [imagePreview]);

  useEffect(() => () => activeUploadRef.current?.abort(), []);

  useEffect(() => {
    if (!submissionNotice) return;
    const timeout = window.setTimeout(() => setSubmissionNotice(''), 6000);
    return () => window.clearTimeout(timeout);
  }, [submissionNotice]);

  if (!me) return null;

  const isUploading = isImageUploading || isVideoUploading;
  const hasPostContent = text.trim().length > 0 || !!image || !!videoUrl || !!video;
  const canPublish = hasPostContent && (!isPromo || promoTitle.trim().length > 0);

  /** Stop any upload in flight and reset everything tracking it. */
  const cancelUpload = () => {
    uploadRequestRef.current += 1;
    activeUploadRef.current?.abort();
    activeUploadRef.current = null;
    setIsImageUploading(false);
    setIsVideoUploading(false);
    setUploadProgress(0);
    setUploadError('');
    if (fileRef.current) fileRef.current.value = '';
    return uploadRequestRef.current;
  };

  const clearVideo = () => {
    cancelUpload();
    pendingVideoFileRef.current = null;
    setVideo(undefined);
    setVideoUrl(undefined);
  };

  const clearImage = () => {
    cancelUpload();
    setImage(undefined);
    setImagePreview(undefined);
    setIsPrayerRequest(false);
  };

  const publish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canPublish || isPublishing || isUploading) return;
    setUploadError('');
    setIsPublishing(true);

    try {
      let publishedVideoUrl = videoUrl;
      if (!publishedVideoUrl && pendingVideoFileRef.current) {
        publishedVideoUrl = await startVideoUpload(pendingVideoFileRef.current);
      }

      const post = isPromo
        ? await createPromoPost({
            title: promoTitle.trim(),
            text: text.trim(),
            image,
            video: publishedVideoUrl,
            videoStatus: publishedVideoUrl ? 'ready' : undefined,
          })
        : createPost({
            text: text.trim() || (isPrayerRequest ? 'Prayer Request' : ''),
            image,
            video: publishedVideoUrl,
            videoStatus: publishedVideoUrl ? 'ready' : undefined,
          });
      if (!post) throw new Error('Could not publish the post. Please sign in again and retry.');

      if (isPromo) setSubmissionNotice('Your post has been submitted for admin approval.');

      setText('');
      setPromoTitle('');
      setIsPromo(false);
      setImage(undefined);
      setImagePreview(undefined);
      setIsPrayerRequest(false);
      setVideo(undefined);
      setVideoUrl(undefined);
      pendingVideoFileRef.current = null;
      setUploadProgress(0);
      setFocused(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (error) {
      console.error('Post publish failed', error);
      setUploadError(error instanceof Error && error.message
        ? error.message
        : 'Could not publish the post. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  const startVideoUpload = async (file: File): Promise<string> => {
    const requestId = cancelUpload();
    const isCurrent = () => uploadRequestRef.current === requestId;
    const controller = new AbortController();
    activeUploadRef.current = controller;
    pendingVideoFileRef.current = file;
    setVideoUrl(undefined);
    setUploadProgress(0);
    setIsVideoUploading(true);

    try {
      const uploadedUrl = await uploadFeedVideo(
        file,
        (progress) => {
          if (isCurrent()) setUploadProgress(progress);
        },
        controller.signal,
        // Names the video in the Bunny Stream library — the caption as it stands
        // when the file is picked. Left blank, the server names it after the
        // uploader instead.
        text,
      );
      if (!isCurrent()) throw new DOMException('Video upload cancelled.', 'AbortError');
      pendingVideoFileRef.current = null;
      setVideoUrl(uploadedUrl);
      setUploadProgress(100);
      return uploadedUrl;
    } catch (error) {
      if (!isCurrent() || controller.signal.aborted) throw error;
      console.error('Video upload failed', error);
      setUploadError(videoUploadErrorMessage(error));
      throw error;
    } finally {
      if (isCurrent()) {
        activeUploadRef.current = null;
        setIsVideoUploading(false);
      }
    }
  };

  /** Photos upload when selected. Videos stay untouched until Publish sends the
   * original file directly to Bunny Stream for cloud transcoding. */
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (isPostVideoFile(file)) {
      const validationError = validatePostVideoSource(file);
      if (validationError) {
        setUploadError(validationError);
        return;
      }
      cancelUpload();
      setImage(undefined);
      setImagePreview(undefined);
      setIsPrayerRequest(false);
      const previewSupported = canPreviewVideoFile(file);
      setVideo({
        preview: previewSupported ? URL.createObjectURL(file) : undefined,
        name: file.name || 'Selected video',
        size: file.size,
      });
      pendingVideoFileRef.current = file;
      setVideoUrl(undefined);
      setUploadProgress(0);
      setUploadError('');
      return;
    }

    if (!isImageFile(file)) {
      setUploadError('Unsupported media format. Please select an image or an MP4, MOV, or WebM video.');
      return;
    }

    const validationError = validateImage(file, 'post');
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    pendingVideoFileRef.current = null;
    const requestId = cancelUpload();
    const isCurrent = () => uploadRequestRef.current === requestId;
    const controller = new AbortController();
    activeUploadRef.current = controller;
    setVideo(undefined);
    setVideoUrl(undefined);
    setIsPrayerRequest(false);
    setImage(undefined);
    setImagePreview({ preview: URL.createObjectURL(file), name: file.name || 'Selected photo' });
    setIsImageUploading(true);

    try {
      const uploadedUrl = await uploadPostImage(
        file,
        (progress) => {
          if (isCurrent()) setUploadProgress(progress);
        },
        controller.signal,
      );
      if (!isCurrent()) return;
      setImage(uploadedUrl);
      setUploadProgress(100);
    } catch (error) {
      if (!isCurrent() || controller.signal.aborted) return;
      console.error('Photo upload failed', error);
      setImagePreview(undefined);
      setUploadError(error instanceof Error && error.message
        ? error.message
        : 'The photo could not be uploaded. Please check your connection and try again.');
    } finally {
      if (isCurrent()) {
        activeUploadRef.current = null;
        setIsImageUploading(false);
      }
    }
  };

  return (
    <form className="card p-4" onSubmit={publish}>
      {submissionNotice && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-200" role="status" aria-live="polite">
          <CheckCircle2 size={18} className="shrink-0" />
          {submissionNotice}
        </div>
      )}
      <div className="flex gap-3">
        <Avatar src={me.photo} name={me.name} size={44} ring="gold" />
        <div className="flex-1">
          {isPromo && (
            <div className="mb-3 rounded-xl border border-gold-400/25 bg-gold-400/[0.06] p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-gold-300">
                <Briefcase size={15} /> Community Showcase / Business Promo
              </div>
              <input
                value={promoTitle}
                onChange={(event) => setPromoTitle(event.target.value)}
                maxLength={160}
                placeholder="Promo title"
                className="input"
                required
              />
              <p className="mt-2 text-xs leading-5 text-ink-400">Promo posts appear publicly only after an administrator approves them.</p>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={isPromo ? 'Describe your business, service, event, or community offering...' : isPrayerRequest ? 'Share your prayer request...' : "What's on your mind, in Christ?"}
            rows={focused ? 3 : 1}
            className="w-full resize-none rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-3 text-sm text-ink-100 placeholder-ink-400 outline-none transition-all focus:border-gold-400/50 focus:ring-2 focus:ring-gold-400/15"
          />

          {(imagePreview || image) && (
            <div className="relative mt-3 overflow-hidden rounded-xl border border-ink-700">
              <img
                src={imagePreview?.preview ?? image}
                alt={isPrayerRequest ? 'Prayer request background' : 'Post attachment'}
                className="max-h-72 w-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={clearImage}
                className="absolute right-2 top-2 z-20 rounded-full bg-black/60 p-1.5 text-white backdrop-blur hover:bg-black/80"
                aria-label={isPrayerRequest ? 'Remove prayer request background' : 'Remove image'}
              >
                <X size={16} />
              </button>
              {imagePreview && (
                <UploadProgress
                  label={isImageUploading ? `Uploading ${imagePreview.name}` : 'Photo upload complete'}
                  percentage={uploadProgress}
                  complete={!isImageUploading && !!image}
                />
              )}
            </div>
          )}

          {video && (
            <div className="relative mt-3 overflow-hidden rounded-xl border border-ink-700 bg-ink-950">
              {video.preview ? (
                <>
                  <video
                    src={video.preview}
                    controls
                    playsInline
                    preload="metadata"
                    onError={() => {
                      setVideo((current) => current ? { ...current, preview: undefined } : current);
                    }}
                    className="aspect-video h-full w-full bg-black object-contain"
                  />
                  <div className="border-t border-ink-800 bg-ink-900/95 px-3 py-2 pr-12">
                    <p className="truncate text-xs font-medium text-ink-200">{video.name}</p>
                    <p className="mt-0.5 text-[11px] text-ink-400">{formatFileSize(video.size)} · Ready to upload</p>
                  </div>
                </>
              ) : (
                <div className="flex min-h-36 items-center gap-4 bg-gradient-to-br from-ink-900 to-emerald-950/60 px-5 py-6 pr-14">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-gold-400/25 bg-gold-400/10 text-gold-300 shadow-lg shadow-black/20">
                    <Film size={28} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-100">{video.name}</p>
                    <p className="mt-1 text-xs text-ink-400">{formatFileSize(video.size)} · Ready to upload</p>
                    <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
                      Preview unavailable on this device. Bunny Stream converts it after publishing.
                    </p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={clearVideo}
                className="absolute right-2 top-2 z-20 rounded-full bg-black/70 p-1.5 text-white backdrop-blur hover:bg-black/90"
                aria-label="Remove video"
              >
                <X size={16} />
              </button>
              {(isVideoUploading || videoUrl) && (
                <UploadProgress
                  label={isVideoUploading
                    ? `Uploading ${video.name}`
                    : 'Video upload complete'}
                  percentage={uploadProgress}
                  complete={!isVideoUploading && !!videoUrl}
                />
              )}
            </div>
          )}

          {uploadError && (
            <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <span>{uploadError}</span>
              {video && pendingVideoFileRef.current && !isUploading && (
                <button
                  type="button"
                  onClick={() => {
                    const file = pendingVideoFileRef.current;
                    if (file) void startVideoUpload(file).catch(() => undefined);
                  }}
                  className="rounded-lg border border-red-300/30 px-2.5 py-1 font-semibold text-red-200 transition-colors hover:bg-red-400/10"
                >
                  Retry upload
                </button>
              )}
            </div>
          )}

          {(focused || isPromo || text || image || imagePreview || video) && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-700 pt-3 animate-fade-in">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-emerald-300"
                >
                  <ImagePlus size={16} /> Media
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                  onChange={onFile}
                  disabled={isPublishing}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => setGifPickerOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-gold-300"
                  aria-haspopup="dialog"
                >
                  <span className="rounded border border-current px-1 py-0.5 text-[9px] font-black leading-none">GIF</span>
                  GIF
                </button>
                <span className="hidden items-center gap-1 text-[11px] text-ink-500 sm:flex">
                  <Film size={13} /> Videos upload directly to Bunny Stream
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsPromo((current) => !current);
                    setIsPrayerRequest(false);
                    setFocused(true);
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isPromo
                      ? 'bg-gold-400/10 text-gold-300 ring-1 ring-inset ring-gold-400/20'
                      : 'text-ink-300 hover:bg-ink-800 hover:text-gold-300'
                  }`}
                  aria-pressed={isPromo}
                >
                  <Briefcase size={16} /> Business Promo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearVideo();
                    setImagePreview(undefined);
                    setImage(PRAYER_REQUEST_IMAGE);
                    setIsPrayerRequest(true);
                    setIsPromo(false);
                    setPromoTitle('');
                    setFocused(true);
                    requestAnimationFrame(() => textareaRef.current?.focus());
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isPrayerRequest
                      ? 'bg-gold-400/10 text-gold-300 ring-1 ring-inset ring-gold-400/20'
                      : 'text-ink-300 hover:bg-ink-800 hover:text-gold-300'
                  }`}
                  aria-pressed={isPrayerRequest}
                >
                  <HandHeart size={16} /> Prayer Request
                </button>
                <button
                  type="button"
                  onClick={() => setGoLiveOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-red-300"
                >
                  <Radio size={16} /> Go Live
                </button>
              </div>
              <button type="submit" disabled={!canPublish || isPublishing || isUploading} className="gold-btn ml-auto py-2 text-sm">
                {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {isUploading ? 'Uploading…' : isPublishing ? 'Submitting…' : isPromo ? 'Submit for approval' : 'Publish'}
              </button>
            </div>
          )}
        </div>
      </div>
      {gifPickerOpen && (
        <GifPicker
          onClose={() => setGifPickerOpen(false)}
          onSelect={(gif) => {
            clearVideo();
            setImagePreview(undefined);
            setImage(gif.url);
            setIsPrayerRequest(false);
            setFocused(true);
            setGifPickerOpen(false);
          }}
        />
      )}
    </form>
  );
}
