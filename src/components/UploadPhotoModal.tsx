/**
 * UploadPhotoModal.tsx — Three-step unit photo upload flow (game-aware)
 *
 * STEP 1 (pick): Choose a photo via camera (mobile) or file upload.
 * STEP 2 (crop): Crop for the card portrait. Uploads portrait on "Next".
 *   - Halo Flashpoint: includes portrait frame checkbox
 *   - Blood Bowl: no frame option
 * STEP 3 (avatar): Crop a 1:1 square avatar from the same image. Uploads on "Done".
 *
 * USAGE:
 *   <UploadPhotoModal
 *     open={isOpen}
 *     onClose={() => setIsOpen(false)}
 *     game="halo-flashpoint"
 *     cardDbId={activeCard.dbId}
 *     unitName={activeCard.unitName}
 *     onImageUploaded={(portraitUrl, portraitStyle) => ...}
 *     onAvatarUploaded={avatarUrl => ...}
 *   />
 */

import { useState, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import Modal from './Modal';
import VR from './VR';
import Button from './Button';
import UnitListEntry from './UnitListEntry';
import HaloFlashpointCard from './HaloFlashpointCard';
import BloodBowlCard from './BloodBowlCard';
import StarcraftCard from './StarcraftCard';
import Camera from '../icons/Camera';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';
import ArrowLeft from '../icons/ArrowLeft';
import ArrowRight from '../icons/ArrowRight';
import Magnifer from '../icons/Magnifer';
import UploadMinimalistic from '../icons/UploadMinimalistic';
import { supabase } from '../lib/supabase';

// ── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/gif'];
const MAX_FILE_SIZE  = 30 * 1024 * 1024; // 30 MB
const JPEG_QUALITY   = 0.8;
const CROP_ASPECT_AVATAR = 1; // square

// ── Per-game config ──────────────────────────────────────────────────────────

type GameSlug = 'halo-flashpoint' | 'blood-bowl' | 'starcraft';

interface GameConfig {
  /** Default crop aspect ratio (no frame) */
  cropAspect: number;
  /** Crop aspect ratio when portrait frame is active (null = no frame support) */
  cropAspectFramed: number | null;
  /** Whether the portrait frame checkbox is shown */
  hasFrame: boolean;
  /** Card native width */
  cardW: number;
  /** Card native height */
  cardH: number;
  /** How many card-px of width to show in the preview */
  previewVisibleW: number;
  /** Default recommendation text */
  recommendation: string;
}

const GAME_CONFIG: Record<GameSlug, GameConfig> = {
  'halo-flashpoint': {
    cropAspect:       543 / 608,
    cropAspectFramed: 450 / 607,
    hasFrame:         true,
    cardW:            1270,
    cardH:            890,
    previewVisibleW:  600,
    recommendation:   'For Halo: Flashpoint, we recommend a photo with a white background.',
  },
  'blood-bowl': {
    cropAspect:       593 / 614,
    cropAspectFramed: null,
    hasFrame:         false,
    cardW:            750,
    cardH:            1100,
    previewVisibleW:  750,
    recommendation:   'For Blood Bowl, we recommend a player portrait with a clean background.',
  },
  // StarCraft: the portrait's final placement on the card is still TBD, so the
  // crop aspect here is a provisional 4:5 headshot ratio. When the final chrome
  // design is locked, update cropAspect (and cardW/cardH/previewVisibleW if the
  // portrait appears at a different scale).  The upload plumbing itself
  // (storage bucket, card_images rows, avatar flow) is identical to the other
  // games.
  'starcraft': {
    cropAspect:       4 / 5,
    cropAspectFramed: null,
    hasFrame:         false,
    cardW:            1270,
    cardH:            890,
    previewVisibleW:  600,
    recommendation:   'For StarCraft, we recommend a unit portrait with a clean background.',
  },
};

// Preview container dimensions
const PREVIEW_W      = 271;
const PREVIEW_CLIP_H = 307;

// ── Mobile detection ─────────────────────────────────────────────────────────

const isMobileDevice = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  ('ontouchstart' in window && navigator.maxTouchPoints > 0);

// ── Crop helpers ─────────────────────────────────────────────────────────────

const getCroppedBlob = (
  imageSrc: string,
  pixelCrop: Area,
  quality = JPEG_QUALITY,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas  = document.createElement('canvas');
      canvas.width  = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
      ctx.drawImage(
        img,
        pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
        0, 0, pixelCrop.width, pixelCrop.height,
      );
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('Blob creation failed'))),
        'image/jpeg',
        quality,
      );
    };
    img.onerror = reject;
    img.src = imageSrc;
  });

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 'pick' | 'crop' | 'avatar';

export interface UploadPhotoModalProps {
  open: boolean;
  onClose: () => void;
  /** Which game this modal is for */
  game: GameSlug;
  cardDbId: string | null;
  unitName?: string;
  unitType?: string;
  onImageUploaded: (publicUrl: string, portraitStyle: string | null) => void;
  onAvatarUploaded?: (avatarUrl: string) => void;
  /** Override the default recommendation text */
  recommendation?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

const UploadPhotoModal = ({
  open,
  onClose,
  game,
  cardDbId,
  unitName,
  unitType,
  onImageUploaded,
  onAvatarUploaded,
  recommendation,
}: UploadPhotoModalProps) => {
  const cfg = GAME_CONFIG[game];
  const recText = recommendation ?? cfg.recommendation;

  // ── Step state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('pick');

  // ── Pick step state ─────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc]         = useState<string | null>(null);
  const [isDragging, setIsDragging]     = useState(false);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ── Crop step state (portrait) ──────────────────────────────────────────
  const [crop, setCrop]       = useState({ x: 0, y: 0 });
  const [zoom, setZoom]       = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);

  // ── Portrait frame state (Halo only) ────────────────────────────────────
  const [showFrame, setShowFrame] = useState(cfg.hasFrame);

  // ── Avatar step state ───────────────────────────────────────────────────
  const [avatarCrop, setAvatarCrop]       = useState({ x: 0, y: 0 });
  const [avatarZoom, setAvatarZoom]       = useState(1);
  const [avatarCroppedArea, setAvatarCroppedArea] = useState<Area | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // ── Upload state ────────────────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const showCamera = isMobileDevice();

  // ── Derived values ──────────────────────────────────────────────────────
  const cropAspect = (cfg.hasFrame && showFrame && cfg.cropAspectFramed)
    ? cfg.cropAspectFramed
    : cfg.cropAspect;

  const previewScale = PREVIEW_W / cfg.previewVisibleW;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) return;
    if (file.size > MAX_FILE_SIZE) return;
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setSelectedFile(file);
    setImageSrc(URL.createObjectURL(file));
  }, [imageSrc]);

  const resetAll = useCallback(() => {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    if (croppedPreview) URL.revokeObjectURL(croppedPreview);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setSelectedFile(null);
    setImageSrc(null);
    setStep('pick');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setCroppedPreview(null);
    setShowFrame(cfg.hasFrame);
    setAvatarCrop({ x: 0, y: 0 });
    setAvatarZoom(1);
    setAvatarCroppedArea(null);
    setAvatarPreview(null);
    setUploading(false);
    setUploadError(null);
  }, [imageSrc, croppedPreview, avatarPreview, cfg.hasFrame]);

  const handleClose = useCallback(() => {
    resetAll();
    onClose();
  }, [resetAll, onClose]);

  const handleBack = useCallback(() => {
    if (step === 'crop') {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
      if (croppedPreview) URL.revokeObjectURL(croppedPreview);
      setImageSrc(null);
      setSelectedFile(null);
      setCroppedPreview(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setUploadError(null);
      setStep('pick');
    } else if (step === 'avatar') {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
      setAvatarCrop({ x: 0, y: 0 });
      setAvatarZoom(1);
      setAvatarCroppedArea(null);
      setUploadError(null);
      setStep('crop');
    }
  }, [step, imageSrc, croppedPreview, avatarPreview]);

  // ── File input change ────────────────────────────────────────────────────

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // ── Portrait crop complete ──────────────────────────────────────────────

  const onCropComplete = useCallback(
    async (_pct: Area, px: Area) => {
      setCroppedArea(px);
      if (!imageSrc) return;
      try {
        if (croppedPreview) URL.revokeObjectURL(croppedPreview);
        const blob = await getCroppedBlob(imageSrc, px);
        setCroppedPreview(URL.createObjectURL(blob));
      } catch { /* preview won't update */ }
    },
    [imageSrc, croppedPreview],
  );

  // ── Avatar crop complete ────────────────────────────────────────────────

  const onAvatarCropComplete = useCallback(
    async (_pct: Area, px: Area) => {
      setAvatarCroppedArea(px);
      if (!imageSrc) return;
      try {
        if (avatarPreview) URL.revokeObjectURL(avatarPreview);
        const blob = await getCroppedBlob(imageSrc, px);
        setAvatarPreview(URL.createObjectURL(blob));
      } catch { /* preview won't update */ }
    },
    [imageSrc, avatarPreview],
  );

  // ── Upload portrait (step 2 → step 3) ──────────────────────────────────

  const handleAddImage = useCallback(async () => {
    if (!imageSrc || !croppedArea || !cardDbId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const blob = await getCroppedBlob(imageSrc, croppedArea, JPEG_QUALITY);
      const fileName = `${crypto.randomUUID()}.jpg`;
      const filePath = `${user.id}/${cardDbId}/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('card-images')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('card-images')
        .getPublicUrl(filePath);

      const { error: dbErr } = await supabase
        .from('card_images')
        .insert({ card_id: cardDbId, file_path: filePath, image_type: 'portrait' });
      if (dbErr) throw dbErr;

      // Portrait style (only Halo has frame support)
      const portraitStyle = (cfg.hasFrame && showFrame) ? 'portraitFramed' : null;
      const { error: styleErr } = await supabase
        .from('cards')
        .update({ portrait_style: portraitStyle })
        .eq('id', cardDbId);
      if (styleErr) throw styleErr;

      onImageUploaded(publicUrl, portraitStyle);
      setStep('avatar');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [imageSrc, croppedArea, cardDbId, showFrame, cfg.hasFrame, onImageUploaded]);

  // ── Upload avatar (step 3 → close) ─────────────────────────────────────

  const handleDone = useCallback(async () => {
    if (!imageSrc || !avatarCroppedArea || !cardDbId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const blob = await getCroppedBlob(imageSrc, avatarCroppedArea, JPEG_QUALITY);
      const fileName = `avatar-${crypto.randomUUID()}.jpg`;
      const filePath = `${user.id}/${cardDbId}/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('card-images')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('card-images')
        .getPublicUrl(filePath);

      const { error: dbErr } = await supabase
        .from('card_images')
        .insert({ card_id: cardDbId, file_path: filePath, image_type: 'avatar' });
      if (dbErr) throw dbErr;

      onAvatarUploaded?.(publicUrl);
      resetAll();
      onClose();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [imageSrc, avatarCroppedArea, cardDbId, onAvatarUploaded, resetAll, onClose]);

  // ── Card preview renderer (game-aware) ─────────────────────────────────

  const renderCardPreview = () => {
    const portraitSrc = croppedPreview ?? imageSrc ?? undefined;

    if (game === 'halo-flashpoint') {
      return (
        <HaloFlashpointCard
          portrait={portraitSrc}
          portraitStyle={showFrame ? 'portraitFramed' : null}
        />
      );
    }

    if (game === 'starcraft') {
      // Placeholder preview — StarcraftCard doesn't render portraits yet, so
      // we show the cropped image as a lightly-framed image on top of the
      // (currently transparent) card layout. When portrait placement is
      // designed, replace this with a `portrait`-prop pass-through to
      // StarcraftCard.
      return (
        <div style={{ position: 'relative', width: 1270, height: 890 }}>
          <StarcraftCard />
          {portraitSrc && (
            <img
              src={portraitSrc}
              alt=""
              style={{
                position:   'absolute',
                top:        '50%',
                left:       '50%',
                transform:  'translate(-50%, -50%)',
                maxWidth:   '40%',
                maxHeight:  '70%',
                objectFit:  'contain',
                borderRadius: 8,
                boxShadow:  '0 4px 18px rgba(0,0,0,0.25)',
              }}
            />
          )}
        </div>
      );
    }

    return <BloodBowlCard portrait={portraitSrc} />;
  };

  // ── Render: Step 1 — Pick ──────────────────────────────────────────────

  const renderPickStep = () => (
    <>
      <p className="font-body text-sm text-gray-300">{recText}</p>

      <div className="flex gap-3 items-stretch">
        {showCamera && (
          <>
            <div className="flex-1 flex flex-col items-center justify-center gap-2.5">
              <Camera className="w-6 h-6 text-gray-400" />
              <input
                ref={cameraInputRef} type="file" accept="image/*"
                capture="environment" className="hidden" onChange={onFileChange}
              />
              <Button
                leftIcon={<CheckCircle className="w-4 h-4" />}
                size="sm" className="w-full"
                onClick={() => cameraInputRef.current?.click()}
              >
                Take a photo
              </Button>
            </div>
            <VR style="or" />
          </>
        )}

        <div className="flex-1 space-y-2.5">
          <div
            role="button" tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            className={[
              'flex flex-col items-center justify-center gap-4',
              'h-56 rounded-xl border border-dashed cursor-pointer',
              'bg-gray-700 transition-colors',
              isDragging ? 'border-blue-500 bg-gray-600' : 'border-gray-600 hover:border-gray-500',
            ].join(' ')}
          >
            {imageSrc ? (
              <img src={imageSrc} alt="Selected preview" className="max-h-40 max-w-full object-contain rounded" />
            ) : (
              <>
                <UploadMinimalistic className="w-6 h-6 text-gray-400" />
                <p className="font-body text-sm text-gray-50 text-center">Click to upload or drag and drop</p>
                <p className="font-body text-xs font-medium text-gray-50 text-center">Max. File Size: 30MB</p>
              </>
            )}
            <Button leftIcon={<Magnifer className="w-4 h-4" />} size="xs"
              onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              Browse Files
            </Button>
          </div>
          <input ref={fileInputRef} type="file" accept=".svg,.png,.jpg,.jpeg,.gif" className="hidden" onChange={onFileChange} />
          <p className="font-body text-xs text-gray-300">SVG, PNG, JPG or GIF (MAX. 800x400px).</p>
        </div>
      </div>

      <div className="border-t border-gray-700" />

      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" color="danger" size="sm" leftIcon={<CloseCircle className="w-4 h-4" />} onClick={handleClose}>
          Cancel
        </Button>
        <Button leftIcon={<CheckCircle className="w-4 h-4" />} size="sm" disabled={!selectedFile} onClick={() => setStep('crop')}>
          Next
        </Button>
      </div>
    </>
  );

  // ── Render: Step 2 — Crop (portrait) ───────────────────────────────────

  const renderCropStep = () => (
    <>
      <p className="font-body text-sm text-gray-300">
        Drag to reposition and scroll to zoom. The preview shows how your image will look on the card.
      </p>

      <div className="flex flex-wrap gap-3 items-start">
        {/* Card preview */}
        <div className="flex-1 min-w-[300px] flex flex-col gap-2.5 items-center">
          <div
            className="rounded-md overflow-hidden bg-gray-600 mx-auto"
            style={{ width: PREVIEW_W, height: PREVIEW_CLIP_H }}
          >
            <div
              style={{
                width: cfg.cardW, height: cfg.cardH,
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
              }}
            >
              {renderCardPreview()}
            </div>
          </div>
          <p className="font-body text-xs text-gray-300 text-center">Preview of your image</p>
        </div>

        <VR className="self-stretch hidden sm:flex" />

        {/* Cropper */}
        <div className="flex-1 min-w-[300px]">
          <div className="relative rounded-lg overflow-hidden bg-gray-900" style={{ height: PREVIEW_CLIP_H }}>
            {imageSrc && (
              <Cropper
                image={imageSrc} crop={crop} zoom={zoom}
                aspect={cropAspect}
                onCropChange={setCrop} onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                classes={{ containerClassName: 'rounded-lg' }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Portrait frame checkbox (Halo only) */}
      {cfg.hasFrame && (
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox" checked={showFrame}
            onChange={e => setShowFrame(e.target.checked)}
            className="size-4 rounded-sm border border-gray-500 bg-transparent
                       checked:bg-blue-500 checked:border-blue-500
                       accent-blue-500 cursor-pointer"
          />
          <span className="font-body text-sm text-gray-300">
            Show portrait frame (recommended for non-transparent images)
          </span>
        </label>
      )}

      {uploadError && <p className="font-body text-sm text-red-400">{uploadError}</p>}

      <div className="border-t border-gray-700" />

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />} onClick={handleBack} disabled={uploading}>
          Back
        </Button>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" color="danger" size="sm" leftIcon={<CloseCircle className="w-4 h-4" />} onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button rightIcon={<ArrowRight className="w-4 h-4" />} size="sm"
            disabled={!croppedArea || !cardDbId} loading={uploading} onClick={handleAddImage}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );

  // ── Render: Step 3 — Avatar crop ───────────────────────────────────────

  const renderAvatarStep = () => (
    <>
      <div className="flex flex-wrap gap-3 items-center">
        {/* UnitListEntry preview */}
        <div className="flex-1 min-w-[300px] flex flex-col items-center justify-center">
          <UnitListEntry
            status="complete"
            unitName={unitName || 'Unit Name'}
            unitType={unitType}
            avatarSrc={avatarPreview ?? imageSrc ?? undefined}
            className="w-full max-w-sm"
          />
        </div>

        <VR className="self-stretch hidden sm:flex" />

        {/* 1:1 cropper */}
        <div className="flex-1 min-w-[300px]">
          <div className="relative rounded-lg overflow-hidden bg-gray-900" style={{ height: PREVIEW_CLIP_H }}>
            {imageSrc && (
              <Cropper
                image={imageSrc} crop={avatarCrop} zoom={avatarZoom}
                maxZoom={6} aspect={CROP_ASPECT_AVATAR}
                onCropChange={setAvatarCrop} onZoomChange={setAvatarZoom}
                onCropComplete={onAvatarCropComplete}
                classes={{ containerClassName: 'rounded-lg' }}
              />
            )}
          </div>
        </div>
      </div>

      {uploadError && <p className="font-body text-sm text-red-400">{uploadError}</p>}

      <div className="border-t border-gray-700" />

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />} onClick={handleBack} disabled={uploading}>
          Back
        </Button>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" color="danger" size="sm" leftIcon={<CloseCircle className="w-4 h-4" />} onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button leftIcon={<CheckCircle className="w-4 h-4" />} size="sm"
            disabled={!avatarCroppedArea || !cardDbId} loading={uploading} onClick={handleDone}
          >
            Done
          </Button>
        </div>
      </div>
    </>
  );

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={handleClose} className={step === 'pick' ? 'max-w-2xl' : 'max-w-[80%]'}>
      <div className="p-5 space-y-3">
        <h3 className="font-heading text-xl text-white tracking-tight">
          Upload Unit Photo
        </h3>
        {step === 'pick' && renderPickStep()}
        {step === 'crop' && renderCropStep()}
        {step === 'avatar' && renderAvatarStep()}
      </div>
    </Modal>
  );
};

export default UploadPhotoModal;
