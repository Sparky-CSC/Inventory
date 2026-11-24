import React, { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startCameraScanner } from '@/lib/scanner';

/**
 * Reads one code after another from the camera, for counting many items in a
 * row. `onCode(text)` is called for each code; the same code is ignored for a
 * moment so it is not counted twice while still in view. `lastResult` is
 * shown under the picture ({ ok, text }).
 */
export default function ContinuousScanner({ onCode, onClose, lastResult }) {
  const videoRef = useRef(null);
  const [error, setError] = useState('');
  const recent = useRef(new Map());

  useEffect(() => {
    let stop = null;
    let cancelled = false;
    let restartTimer = null;

    const begin = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot use the camera here. Type or use a handheld scanner instead.');
        return;
      }
      stop = await startCameraScanner(
        videoRef.current,
        (result) => {
          if (cancelled) return;
          const now = Date.now();
          const seenAt = recent.current.get(result.text) || 0;
          if (now - seenAt > 4000) {
            recent.current.set(result.text, now);
            if (navigator.vibrate) navigator.vibrate(60);
            onCode(result.text);
          }
          // The scanner stops after each code; start it again shortly.
          restartTimer = setTimeout(() => !cancelled && begin(), 700);
        },
        () => !cancelled && setError('The camera could not be opened. Allow camera access, or type the code instead.')
      );
      if (cancelled && stop) stop();
    };
    begin();

    return () => {
      cancelled = true;
      clearTimeout(restartTimer);
      if (stop) stop();
    };
    // onCode changes every render; the camera must not restart because of it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-xl border border-base-300 bg-black overflow-hidden">
      <div className="relative">
        <video ref={videoRef} className="w-full max-h-72 object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-8 border-2 border-white/70 rounded-lg" aria-hidden="true" />
        <Button size="sm" variant="secondary" className="absolute top-2 right-2" onClick={onClose}>
          <X className="w-4 h-4 mr-1" /> Stop camera
        </Button>
      </div>
      <div className="bg-base-100 px-3 py-2 text-sm min-h-[2.5rem] flex items-center gap-2">
        <Camera className="w-4 h-4 text-base-content/60" />
        {error ? (
          <span className="text-error">{error}</span>
        ) : lastResult ? (
          <span className={lastResult.ok ? 'text-success' : 'text-warning'}>{lastResult.text}</span>
        ) : (
          <span className="text-base-content/60">Point the camera at a label…</span>
        )}
      </div>
    </div>
  );
}
