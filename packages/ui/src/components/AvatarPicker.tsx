/**
 * AvatarPicker.tsx — Profile picture chooser with a square crop step
 *
 * Shows the current avatar (or initials) next to Upload / Remove actions. When
 * a file is picked it opens a crop dialog — drag to reposition, pinch or slide
 * to zoom — and on confirm produces a 512px square JPEG.
 *
 * It does NOT upload. The cropped Blob is handed to `onChange` and the parent
 * decides when to persist it, so abandoning the form leaves no orphaned object
 * in storage. `onChange(null)` means "remove the existing picture".
 *
 * USAGE:
 *   const [pending, setPending] = useState<Blob | null | undefined>(undefined);
 *
 *   <AvatarPicker
 *     currentUrl={avatarUrl}
 *     initials="CH"
 *     onChange={setPending}
 *   />
 *
 *   // undefined → untouched, Blob → upload it, null → clear avatar_path
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import Avatar from './Avatar';
import Button from './Button';
import Modal from './Modal';

// ── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
/** Guard on the *input* file. The output is always a small square JPEG. */
const MAX_FILE_SIZE  = 15 * 1024 * 1024; // 15 MB
/** Output edge length. 512px stays crisp on a retina 2xl avatar with room to spare. */
const OUTPUT_SIZE    = 512;
const JPEG_QUALITY   = 0.85;

// ── Crop helper ──────────────────────────────────────────────────────────────

/**
 * Draws `pixelCrop` from `imageSrc` into a fixed OUTPUT_SIZE square canvas.
 *
 * Unlike the crop helper in BattleCards' UploadPhotoModal this also *downscales*
 * — the canvas is a fixed size rather than the crop rect's, so a 4000px phone
 * photo lands as a ~60 KB avatar instead of a multi-megabyte one.
 */
function getCroppedSquare(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas  = document.createElement('canvas');
      canvas.width  = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
      ctx.drawImage(
        img,
        pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
        0, 0, OUTPUT_SIZE, OUTPUT_SIZE,
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

export interface AvatarPickerProps {
  /** Public URL of the already-saved avatar, if any. */
  currentUrl?: string | null;
  /** Initials shown when there is no picture. */
  initials?: string;
  /**
   * Fires when the selection changes:
   *   Blob → a new cropped picture awaiting upload
   *   null → the user removed their picture
   */
  onChange: (blob: Blob | null) => void;
  /** Greys out the controls (e.g. while the parent form is saving). */
  disabled?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AvatarPicker({
  currentUrl,
  initials,
  onChange,
  disabled = false,
}: AvatarPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object URL of the file being cropped — null when the crop dialog is closed.
  const [cropSrc,     setCropSrc]     = useState<string | null>(null);
  // Object URL of the confirmed crop, shown in place of currentUrl.
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  // True once the user has explicitly removed their picture.
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

  const shownUrl = previewUrl ?? (removed ? null : currentUrl) ?? undefined;

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
      const blob = await getCroppedSquare(cropSrc, croppedArea);
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
      <label className="font-body text-sm font-medium text-gray-300">
        Profile picture
      </label>

      <div className="flex items-center gap-4">
        {/* Square to match how the picture is actually shown — and to match the
            square cropper, so the preview is what the user just framed. */}
        <Avatar src={shownUrl} initials={initials} size="2xl" shape="rounded" alt="Your profile picture" />

        <div className="flex flex-col gap-2 items-start">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            className="hidden"
            onChange={handleFile}
          />
          <div className="flex gap-2">
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
          <p className="font-body text-xs text-gray-500">JPEG, PNG or WebP.</p>
        </div>
      </div>

      {error && <p className="font-body text-sm text-red-400">{error}</p>}

      {/* ── Crop dialog ──────────────────────────────────────────────────── */}
      <Modal open={!!cropSrc} onClose={busy ? () => {} : closeCropper} className="max-w-md">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-white text-[19.8px] leading-7 tracking-[-0.5px]">
              Crop your picture
            </h2>
            <p className="font-body text-base text-gray-300 leading-6">
              Drag to reposition, and zoom to fit.
            </p>
          </div>

          <div className="relative w-full h-64 bg-gray-950 rounded-lg overflow-hidden">
            {cropSrc && (
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                // Square, because that's how avatars are displayed — a round
                // cropper would promise a circle the app never renders, and
                // anything near the corners would look unexpectedly included.
                cropShape="rect"
                showGrid={false}
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
              {busy ? 'Working…' : 'Use photo'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
