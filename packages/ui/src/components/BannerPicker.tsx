/**
 * BannerPicker.tsx — Wide banner chooser with a fixed-ratio crop step
 *
 * The sibling of AvatarPicker for images that are wide rather than square:
 * event banners, cover images, anything that sits across the top of a card.
 * Shows the current banner (or an empty frame) with Upload / Remove actions.
 * Picking a file opens a crop dialog — drag to reposition, slide to zoom — and
 * on confirm produces a JPEG at exactly `aspect`.
 *
 * Like AvatarPicker it does NOT upload. The cropped Blob goes to `onChange` and
 * the parent decides when to persist it, so abandoning a form leaves no orphan
 * in storage. That matters most in a CREATE flow, where there is no row to hang
 * the object off yet — the parent uploads once the row exists.
 *
 * The preview frame is drawn at the same `aspect` as the crop, so what the user
 * frames is what they will see. Do not let the two drift apart.
 *
 * USAGE:
 *   const [pending, setPending] = useState<Blob | null | undefined>(undefined);
 *
 *   <BannerPicker
 *     label="Event banner"
 *     currentUrl={bannerUrl}
 *     aspect={3}
 *     onChange={setPending}
 *   />
 *
 *   // undefined → untouched, Blob → upload it, null → clear the stored path
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import Button from './Button';
import Modal from './Modal';
import Gallery from '../icons/Gallery';

// ── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
/** Guard on the *input* file. The output is always a downscaled JPEG. */
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
/**
 * Output width. The widest a banner is ever rendered is the 896px content
 * column, so 1800px covers it at 2× for retina with a little room spare.
 * Height follows from `aspect`, which is what keeps the file honest — a 3:1
 * crop lands at 1800×600 and roughly 200 KB.
 */
const OUTPUT_WIDTH = 1800;
const JPEG_QUALITY = 0.85;

// ── Crop helper ──────────────────────────────────────────────────────────────

/**
 * Draws `pixelCrop` from `imageSrc` into a fixed-width canvas at `aspect`.
 *
 * Downscales as well as crops — the canvas is a fixed size rather than the crop
 * rect's, so a 4000px phone photo lands as a ~200 KB banner rather than a
 * multi-megabyte one.
 */
function getCroppedBanner(imageSrc: string, pixelCrop: Area, aspect: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const width = OUTPUT_WIDTH;
      const height = Math.round(OUTPUT_WIDTH / aspect);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
      ctx.drawImage(
        img,
        pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
        0, 0, width, height,
      );
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('Could not process that image.'))),
        'image/jpeg',
        JPEG_QUALITY,
      );
    };
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = imageSrc;
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface BannerPickerProps {
  /** Field label above the frame. */
  label?: string;
  /** Public URL of the already-saved banner, if any. */
  currentUrl?: string | null;
  /**
   * Width ÷ height of both the crop and the preview frame. Defaults to 3, which
   * is what a BattlePack hero renders at.
   */
  aspect?: number;
  /** Shown under the frame when empty — say what the image is for. */
  hint?: string;
  /**
   * Fires when the selection changes:
   *   Blob → a new cropped banner awaiting upload
   *   null → the user removed the banner
   */
  onChange: (blob: Blob | null) => void;
  /** Greys out the controls (e.g. while the parent form is saving). */
  disabled?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BannerPicker({
  label = 'Banner',
  currentUrl,
  aspect = 3,
  hint,
  onChange,
  disabled = false,
}: BannerPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object URL of the file being cropped — null when the crop dialog is closed.
  const [cropSrc,     setCropSrc]     = useState<string | null>(null);
  // Object URL of the confirmed crop, shown in place of currentUrl.
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  // True once the user has explicitly removed the banner.
  const [removed,     setRemoved]     = useState(false);

  const [crop,        setCrop]        = useState({ x: 0, y: 0 });
  const [zoom,        setZoom]        = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Object URLs are leaked memory until revoked; tie them to component life.
  useEffect(() => () => {
    if (cropSrc)    URL.revokeObjectURL(cropSrc);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [cropSrc, previewUrl]);

  const shownUrl = previewUrl ?? (removed ? null : currentUrl) ?? null;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset immediately so re-picking the same file still fires onChange.
    e.target.value = '';
    if (!file) return;

    setError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please choose a JPEG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('That image is over 15 MB. Please choose a smaller one.');
      return;
    }

    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setCropSrc(URL.createObjectURL(file));
  }

  const onCropComplete = useCallback((_: Area, px: Area) => setCroppedArea(px), []);

  function closeCropper() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function handleConfirmCrop() {
    if (!cropSrc || !croppedArea) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await getCroppedBanner(cropSrc, croppedArea, aspect);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setRemoved(false);
      onChange(blob);
      closeCropper();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process that image.');
    } finally {
      setBusy(false);
    }
  }

  function handleRemove() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRemoved(true);
    setError(null);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="font-body text-sm font-medium text-gray-300">{label}</label>

      {/* The frame carries the aspect ratio, so an empty picker already shows
          the shape the image has to be — rather than springing it on someone
          once the cropper opens. */}
      <div
        className="relative w-full rounded-lg overflow-hidden bg-gray-950 border border-gray-700"
        style={{ aspectRatio: String(aspect) }}
      >
        {shownUrl ? (
          <img src={shownUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-600">
            <Gallery className="w-6 h-6" />
            <span className="font-body text-xs">No banner yet</span>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={handleFile}
      />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="xs"
          variant="outline"
          color="secondary"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          {shownUrl ? 'Change' : 'Upload'}
        </Button>
        {shownUrl && (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            color="secondary"
            disabled={disabled}
            onClick={handleRemove}
          >
            Remove
          </Button>
        )}
      </div>

      {hint && !error && <p className="font-body text-xs text-gray-500">{hint}</p>}
      {error && <p className="font-body text-sm text-red-400">{error}</p>}

      {/* ── Crop dialog ──────────────────────────────────────────────────── */}
      <Modal open={!!cropSrc} onClose={busy ? () => {} : closeCropper} className="max-w-xl">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-white text-[19.8px] leading-7 tracking-[-0.5px]">
              Crop your banner
            </h2>
            <p className="font-body text-base text-gray-300 leading-6">
              Drag to reposition, and zoom to fit.
            </p>
          </div>

          {/* Sized by the ratio rather than a fixed height, so a wide banner
              gets a wide stage instead of being squeezed into a square one. */}
          <div
            className="relative w-full bg-gray-950 rounded-lg overflow-hidden"
            style={{ aspectRatio: String(aspect) }}
          >
            {cropSrc && (
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                cropShape="rect"
                showGrid={false}
                objectFit="contain"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>

          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            aria-label="Zoom"
            onChange={e => setZoom(Number(e.target.value))}
            className="w-full accent-primary-600 cursor-pointer"
          />

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              color="secondary"
              className="flex-1"
              onClick={closeCropper}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleConfirmCrop}
              disabled={busy || !croppedArea}
            >
              {busy ? 'Working…' : 'Use banner'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
