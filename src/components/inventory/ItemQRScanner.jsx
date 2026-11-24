import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, Scan, X, Check } from 'lucide-react';
import { startCameraScanner } from '@/lib/scanner';

export default function ItemQRScanner({ isOpen, onClose, onQRCodeAssigned, currentQRCode = '' }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const stopRef = useRef(null);

  const stopCamera = () => {
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }
  };

  // Start reading codes from the camera while "scanning" is on.
  useEffect(() => {
    if (!isOpen || !isScanning) return undefined;
    let cancelled = false;

    const begin = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot use the camera here. Please use manual input instead.');
        setIsScanning(false);
        return;
      }
      try {
        const stop = await startCameraScanner(
          videoRef.current,
          (result) => {
            if (cancelled) return;
            setScannedData(result.text);
            setIsScanning(false);
          },
          () => {
            if (cancelled) return;
            setError('Camera access denied. Please use manual input instead.');
            setIsScanning(false);
          }
        );
        if (cancelled) stop();
        else stopRef.current = stop;
      } catch (err) {
        if (cancelled) return;
        setError('Camera access denied. Please use manual input instead.');
        setIsScanning(false);
      }
    };
    begin();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, isScanning]);

  const handleAssignQRCode = () => {
    const qrData = scannedData || manualInput;
    if (!qrData.trim()) {
      setError('Please scan a QR code or enter data manually.');
      return;
    }
    onQRCodeAssigned(qrData.trim());
    handleClose();
  };

  const handleClose = () => {
    setIsScanning(false);
    setScannedData('');
    setManualInput('');
    setError('');
    stopCamera();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign QR Code / Barcode</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {currentQRCode && (
            <Alert>
              <AlertDescription>
                Current QR Code: <code className="text-xs bg-base-200 p-1 rounded break-all">{currentQRCode}</code>
              </AlertDescription>
            </Alert>
          )}

          {/* Camera Scanning */}
          <div className="space-y-3">
            <Label>Scan QR Code / Barcode</Label>
            {isScanning ? (
              <div className="space-y-3">
                <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 border-white border-dashed rounded-lg flex items-center justify-center">
                      <Scan className="w-12 h-12 text-white opacity-80" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsScanning(false)} className="flex-1">
                    <X className="w-4 h-4 mr-2" />
                    Stop Scanning
                  </Button>
                </div>
                <p className="text-sm text-base-content/70 text-center">
                  Position the QR code or barcode within the frame
                </p>
              </div>
            ) : (
              <Button onClick={() => { setError(''); setScannedData(''); setIsScanning(true); }} variant="outline" className="w-full">
                <Camera className="w-4 h-4 mr-2" />
                Start Camera
              </Button>
            )}
          </div>

          {/* Manual Input */}
          <div className="space-y-2">
            <Label htmlFor="manual-input">Or Enter Manually</Label>
            <Input
              id="manual-input"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Enter QR code data, barcode, or URL..."
              className="bg-base-100"
            />
          </div>

          {/* Scanned Result */}
          {scannedData && (
            <div className="space-y-2">
              <Label>Scanned Data</Label>
              <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
                <code className="text-sm break-all">{scannedData}</code>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignQRCode}
              disabled={!scannedData && !manualInput.trim()}
            >
              <Check className="w-4 h-4 mr-2" />
              Assign QR Code
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
