import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Trash2, AlertTriangle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uploadFile } from '@/api/files';

/**
 * Take or choose photos, give each a caption, and mark the ones that show
 * damage. Photos are resized before upload.
 *
 * `stage` ("check_in" | "return" | "other") is saved on each new photo so
 * check-in and return pictures can be compared later.
 */
export default function PhotoCapture({
  photos = [],
  onChange,
  stage = 'other',
  legacyStage = 'other', // how to treat older photos saved without a stage
  allowPrimary = true,
  suggestions = [],
}) {
  const cameraRef = useRef(null);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState('');

  const stagePhotos = photos.map((photo, index) => ({ photo, index })).filter(({ photo }) => (photo.stage || legacyStage) === stage);

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError('');
    setUploading(files.length);
    const added = [];
    for (const file of files) {
      try {
        const { file_url } = await uploadFile({ file });
        added.push({
          url: file_url,
          caption: '',
          stage,
          shows_damage: false,
          is_primary: false,
          upload_date: new Date().toISOString().split('T')[0],
        });
      } catch (err) {
        console.error('Photo upload failed:', err);
        setError(err?.message || 'A photo could not be saved. Please try again.');
      }
      setUploading((n) => n - 1);
    }
    if (added.length) {
      const next = [...photos, ...added];
      if (allowPrimary && !next.some((p) => p.is_primary)) next[photos.length] = { ...next[photos.length], is_primary: true };
      onChange(next);
    }
  };

  const update = (index, patch) => onChange(photos.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  const remove = (index) => {
    const next = photos.filter((_, i) => i !== index);
    if (allowPrimary && next.length && !next.some((p) => p.is_primary)) next[0] = { ...next[0], is_primary: true };
    onChange(next);
  };
  const makePrimary = (index) => onChange(photos.map((p, i) => ({ ...p, is_primary: i === index })));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => cameraRef.current?.click()} disabled={uploading > 0}>
          <Camera className="w-4 h-4 mr-2" /> Take photo
        </Button>
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
          <ImagePlus className="w-4 h-4 mr-2" /> Choose photos
        </Button>
        {uploading > 0 && (
          <span className="flex items-center text-sm text-base-content/70">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving {uploading} photo{uploading === 1 ? '' : 's'}…
          </span>
        )}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {suggestions.length > 0 && (
        <p className="text-xs text-base-content/70">
          Suggested shots: {suggestions.join(' · ')}
        </p>
      )}
      {error && <p className="text-sm text-error">{error}</p>}

      {stagePhotos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {stagePhotos.map(({ photo, index }) => (
            <div
              key={`${photo.url}-${index}`}
              className={`rounded-lg border overflow-hidden bg-base-100 ${photo.shows_damage ? 'border-error' : 'border-base-300'}`}
            >
              <div className="relative aspect-square bg-base-200">
                <img src={photo.url} alt={photo.caption || 'Photo'} className="w-full h-full object-cover" />
                {photo.is_primary && allowPrimary && (
                  <span className="absolute top-1 left-1 text-[10px] font-semibold bg-primary text-primary-content rounded px-1.5 py-0.5">
                    Main photo
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1.5"
                  aria-label="Remove photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-2 space-y-1.5">
                <Input
                  value={photo.caption || ''}
                  onChange={(e) => update(index, { caption: e.target.value })}
                  placeholder="Caption (e.g. back, label)"
                  className="h-8 text-xs"
                />
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => update(index, { shows_damage: !photo.shows_damage })}
                    className={`text-[11px] flex items-center gap-1 rounded px-1.5 py-0.5 border ${
                      photo.shows_damage ? 'bg-error/10 text-error border-error/40' : 'border-base-300 text-base-content/70'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" /> {photo.shows_damage ? 'Shows damage' : 'Mark damage'}
                  </button>
                  {allowPrimary && !photo.is_primary && (
                    <button
                      type="button"
                      onClick={() => makePrimary(index)}
                      className="text-[11px] flex items-center gap-1 text-base-content/70 hover:text-primary"
                    >
                      <Star className="w-3 h-3" /> Main
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
