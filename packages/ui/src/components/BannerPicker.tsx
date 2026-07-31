/**
 * BannerPicker.tsx — Wide banner chooser that crops only when it has to
 *
 * The sibling of AvatarPicker for images that are wide rather than square:
 * event banners, cover images, anything that sits across the top of a card.
 *
 * THE BANNER KEEPS ITS OWN SHAPE. A banner is always full width, and its height
 * follows the artwork rather than a house ratio — so a 3:1 strip and a 16:9
 * poster both survive intact. `minAspect` is the only limit: it is the TALLEST
 * a banner may be (width ÷ height, so 3:2 is 1.5 and anything smaller is
 * taller). Only an image below it is cropped, down to exactly minAspect.
 *
 * That means most uploads never see the crop dialog at all. Forcing everyone
 * through a cropper to confirm a crop that was not needed is a step that only
 * ever removes something, and cutting the bottom off a poster someone made for
 * their event is the most likely thing it removes.
 *
 * Like AvatarPicker it does NOT upload. The Blob goes to `onChange` and the
 * parent decides when to persist it, so abandoning a form leaves no orphan in
 * storage. That matters most in a CREATE flow, where there is no row to hang
 * the object off yet — the parent uploads once the row exists.
 *
 * `onChange` reports the ratio alongside the Blob because the consumer has to
 * store it: the hero needs to know the height to reserve before the image
 * arrives, or the whole page jumps when it does.
 *
 * USAGE:
 *   const [pending, setPending] = useState<PendingBanner | null | undefined>(undefined);
 *
 *   <BannerPicker
 *     label="Event banner"
 *     currentUrl={bannerUrl}
 *     currentAspect={pack.banner_aspect}
 *     minAspect={3 / 2}
 *     onChange={setPending}
 *   />
 *
 *   // undefined → untouched, {blob, aspect} → upload it, null → clear it
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

// ── Image helpers ────────────────────────────────────────────────────────────

/** Load an object URL and hand back the decoded image. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}

/**
 * Draw a rectangle of `img` into a fixed-width canvas at `aspect`.
 *
 * `rect` is in the source image's own pixels. Downscaling is the point of the
 * fixed width — a 4000px phone photo lands as a ~200 KB banner rather than a
 * multi-megabyte one, whether or not anything was cropped off it.
 */
function drawToBlob(img: HTMLImageElement, rect: Area, aspect: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const width  = OUTPUT_WIDTH;
    const height = Math.round(OUTPUT_WIDTH / aspect);
    const canvas = document.createElement('canvas');
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
    ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height);
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Could not process that image.'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

/** A banner awaiting upload, and the shape the consumer has to store with it. */
export interface PendingBanner {
  blob: Blob;
  /** Width ÷ height of `blob`. */
  aspect: number;
}

export interface BannerPickerProps {
  /** Field label above the frame. */
  label?: string;
  /** Public URL of the already-saved banner, if any. */
  currentUrl?: string | null;
  /**
   * Width ÷ height of the saved banner, so the frame shows it at its real
   * shape. Falls back to `minAspect` when absent.
   */
  currentAspect?: number | null;
  /**
   * The TALLEST a banner may be, as width ÷ height — 3/2 by default, so a 3:2
   * image is the limit and anything taller is cropped down to it. Wider images
   * are left alone and keep their own ratio.
   */
  minAspect?: number;
  /** Shown under the frame when empty — say what the image is for. */
  hint?: string;
  /**
   * Fires when the selection changes:
   *   PendingBanner → a new banner awaiting upload, with its ratio
   *   null          → the user removed the banner
   */
  onChange: (value: PendingBanner | null) => void;
  /** Greys out the controls (e.g. while the parent form is saving). */
  disabled?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BannerPicker({
  label = 'Banner',
  currentUrl,
  currentAspect,
  minAspect = 3 / 2,
  hint,
  onChange,
  disabled = false,
}: BannerPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object URL of the file being cropped — null when the crop dialog is closed.
  const [cropSrc,     setCropSrc]     = useState<string | null>(null);
  // Object URL of the confirmed banner, shown in place of currentUrl.
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  // Ratio of whatever previewUrl is showing, so the frame follows it.
  const [previewRatio, setPreviewRatio] = useState<number | null>(null);
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

  const shownUrl   = previewUrl ?? (removed ? null : currentUrl) ?? null;
  // An empty frame has no artwork to take its shape from, so it shows the
  // tallest a banner may be — the most space the hero could end up giving it.
  const shownRatio = previewRatio ?? (removed ? null : currentAspect) ?? minAspect;

  /** Hand a finished banner to the parent and show it in the frame. */
  function commit(blob: Blob, ratio: number) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(blob));
    setPreviewRatio(ratio);
    setRemoved(false);
    onChange({ blob, aspect: ratio });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
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

    const src = URL.createObjectURL(file);
    setBusy(true);
    try {
      const img   = await loadImage(src);
      const ratio = img.naturalWidth / img.naturalHeight;

      // Wide enough to stand as it is: no crop step, because there is nothing
      // to decide. Still redrawn, to downscale it and normalise to JPEG.
      if (ratio >= minAspect) {
        const whole = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
        commit(await drawToBlob(img, whole, ratio), ratio);
        URL.revokeObjectURL(src);
        return;
      }

      // Taller than allowed — the only case where something must be cut, so it
      // is the only case that asks.
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedArea(null);
      setCropSrc(src);
    } catch (err) {
      URL.revokeObjectURL(src);
      setError(err instanceof Error ? err.message : 'Could not read that image.');
    } finally {
      setBusy(false);
    }
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
      const img = await loadImage(cropSrc);
      commit(await drawToBlob(img, croppedArea, minAspect), minAspect);
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
    setPreviewRatio(null);
    setRemoved(true);
    setError(null);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="font-body text-sm font-medium text-gray-300">{label}</label>

      {/* The frame takes the banner's OWN shape, so it is a true preview of the
          hero rather than a window onto it. Empty, it shows the tallest a
          banner may be. */}
      <div
        className="relative w-full rounded-lg overflow-hidden bg-gray-950 border border-gray-700"
        style={{ aspectRatio: String(shownRatio) }}
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
            {/* Says why it is being asked. This dialog only ever opens for an
                image too tall to use, and without the reason it reads as a
                step everyone has to clear. */}
            <p className="font-body text-base text-gray-300 leading-6">
              That image is taller than a banner can be. Choose the part to
              keep — drag to reposition, and zoom to fit.
            </p>
          </div>

          {/* Sized by the ratio rather than a fixed height, so a wide banner
              gets a wide stage instead of being squeezed into a square one. */}
          <div
            className="relative w-full bg-gray-950 rounded-lg overflow-hidden"
            style={{ aspectRatio: String(minAspect) }}
          >
            {cropSrc && (
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={minAspect}
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
