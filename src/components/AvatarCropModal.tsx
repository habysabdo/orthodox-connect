import { useCallback, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { Check, ZoomIn } from 'lucide-react';
import { Modal } from './ui';

interface AvatarCropModalProps {
  imageSrc: string | null;
  fileName: string;
  onClose: () => void;
  onConfirm: (file: File) => Promise<void>;
}

export function AvatarCropModal({ imageSrc, fileName, onClose, onConfirm }: AvatarCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const completeCrop = useCallback((_area: Area, pixels: Area) => setCropPixels(pixels), []);

  const confirm = async () => {
    if (!imageSrc || !cropPixels) return;
    setSaving(true);
    setError('');
    try {
      let blob: Blob;
      try {
        blob = await exportCroppedAvatar(imageSrc, cropPixels);
      } catch (reason) {
        console.error('Failed to export cropped avatar canvas', reason);
        throw reason;
      }
      const safeName = fileName.replace(/\.[^.]+$/, '') || 'avatar';
      await onConfirm(new File([blob], `${safeName}-cropped.jpg`, { type: 'image/jpeg' }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to crop this photo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={Boolean(imageSrc)} onClose={saving ? () => undefined : onClose} size="md" className="overflow-hidden">
      <div className="border-b border-ink-700 px-5 py-4">
        <h2 className="font-serif text-xl font-semibold text-ink-100">Position your profile photo</h2>
        <p className="mt-1 text-sm text-ink-400">Drag to align your face, then zoom until the circle feels right.</p>
      </div>

      <div className="relative h-[min(58vh,430px)] bg-ink-950">
        {imageSrc && (
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={completeCrop}
            objectFit="contain"
          />
        )}
      </div>

      <div className="space-y-4 border-t border-ink-700 bg-ink-850 p-5">
        <label className="flex items-center gap-3 text-sm text-ink-300">
          <ZoomIn size={17} className="text-gold-300" />
          <span className="sr-only">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-gold-400"
          />
        </label>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="ghost-btn py-2 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={saving || !cropPixels} className="gold-btn py-2 disabled:opacity-50">
            <Check size={15} /> {saving ? 'Saving…' : 'Save photo'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

async function exportCroppedAvatar(imageSrc: string, crop: Area): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const outputSize = 640;
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare the cropped photo');

  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Your browser could not export the cropped photo')),
      'image/jpeg',
      0.9,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('This image could not be opened'));
    image.src = src;
  });
}
