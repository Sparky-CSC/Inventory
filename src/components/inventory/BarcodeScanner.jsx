import React, { useState } from 'react';
import { decodeCodeFromImage, lookupProduct, readLabelText } from '@/lib/scanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Search, Loader, QrCode } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function BarcodeScanner({ onDataExtracted, onClose }) {
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    setError('');
    setScanResult(null);

    try {
      // 1. Look for a barcode or QR code in the photo.
      const code = await decodeCodeFromImage(file);

      // 2. Read any printed text (serial / model numbers) from the label.
      let label = { serial_number: '', model_number: '', text_content: '' };
      try {
        label = await readLabelText(file);
      } catch (ocrError) {
        console.warn('Label text could not be read:', ocrError);
      }

      const output = {
        barcode: code && !code.isQr ? code.text : '',
        qr_code: code && code.isQr ? code.text : '',
        serial_number: label.serial_number,
        model_number: label.model_number,
        text_content: label.text_content,
      };

      if (output.barcode || output.qr_code || output.serial_number || output.model_number) {
        setScanResult(output);

        // If we found a barcode or QR code, try to get product information
        const codeToLookup = output.qr_code || output.barcode;
        if (codeToLookup) {
          await lookupProductInfo(codeToLookup);
        }
      } else {
        setError('No barcode, QR code, or serial number found in the image. Try a clearer photo.');
      }
    } catch (err) {
      console.error('Error scanning image:', err);
      setError(err?.message || 'Failed to scan image. Please try again.');
    } finally {
      setIsScanning(false);
      e.target.value = ''; // Reset file input
    }
  };

  const handleManualLookup = async () => {
    if (!manualCode.trim()) return;

    setIsProcessing(true);
    setError('');
    setScanResult({
      barcode: manualCode.trim().startsWith('http') ? '' : manualCode.trim(),
      qr_code: manualCode.trim().startsWith('http') ? manualCode.trim() : ''
    });

    try {
      await lookupProductInfo(manualCode.trim());
    } catch (err) {
      setError('Failed to lookup product information.');
    } finally {
      setIsProcessing(false);
    }
  };

  const lookupProductInfo = async (code) => {
    setIsProcessing(true);
    try {
      // Look the code up in free public product databases.
      const productInfo = await lookupProduct(code);

      if (productInfo.found_info) {
        setScanResult(prev => ({ ...prev, productInfo }));
      } else {
        setScanResult(prev => ({
          ...prev,
          productInfo: {
            found_info: false,
            name: '',
            description: 'No product information found for this code.'
          }
        }));
      }
    } catch (err) {
      console.error('Error looking up product info:', err);
      setScanResult(prev => ({
        ...prev,
        productInfo: {
          found_info: false,
          name: '',
          description: 'Unable to lookup product information.'
        }
      }));
    }
    setIsProcessing(false);
  };

  const handleUseData = () => {
    if (scanResult) {
      const info = scanResult.productInfo && scanResult.productInfo.found_info ? scanResult.productInfo : null;
      const extractedData = {
        model_number: scanResult.model_number || info?.model_number || '',
        serial_number: scanResult.serial_number || '',
        // Include the scanned code data for QR code field
        scanned_code: scanResult.qr_code || scanResult.barcode || '',
        ...(info ? {
          name: info.name || '',
          description: info.description || '',
          category: info.category || '',
          subcategory: info.subcategory || '',
          material: info.material || '',
          dimensions: info.dimensions || '',
          time_period: info.time_period || '',
          style: info.style || ''
        } : {})
      };

      onDataExtracted(extractedData);
      onClose();
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Scan Barcode, QR Code, or Serial Number</h3>
        <p className="text-base-content/70 text-sm">
          Take a photo of a barcode, QR code, or product label to automatically fill item details.
        </p>
      </div>

      {/* Camera/Upload Section */}
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <div className="space-y-4">
            <Label htmlFor="barcode-image" className="cursor-pointer">
              <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 text-center hover:border-primary/50 transition-colors bg-primary/5">
                <Camera className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-primary font-medium">Take Photo or Upload Image</p>
                <p className="text-sm text-base-content/60">Focus on barcode, QR code, or product label</p>
              </div>
            </Label>
            <input
              id="barcode-image"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageUpload}
              className="hidden"
              disabled={isScanning}
            />
          </div>
        </CardContent>
      </Card>

      {/* Manual Entry Section */}
      <Card className="border-secondary/20">
        <CardContent className="p-4">
          <div className="space-y-3">
            <Label htmlFor="manual-code">Or Enter Code Manually</Label>
            <div className="flex gap-2">
              <Input
                id="manual-code"
                placeholder="Enter barcode, UPC, QR code data, or model number..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleManualLookup();
                  }
                }}
                disabled={isProcessing}
                className="bg-base-100"
              />
              <Button
                onClick={handleManualLookup}
                disabled={isProcessing || !manualCode.trim()}
                variant="outline"
                aria-label="Look up code"
              >
                {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-base-content/60">
              You can enter URLs, barcode numbers, or any text that should be stored as the QR code data
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {(isScanning || isProcessing) && (
        <div className="text-center py-4">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-base-content/70">
            {isScanning && !isProcessing ? 'Scanning image...' : 'Looking up product information...'}
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results Display */}
      {scanResult && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4">
            <h4 className="font-semibold text-success mb-3 flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              Scan Results
            </h4>
            <div className="space-y-2 text-sm">
              {scanResult.qr_code && (
                <div className="p-2 bg-base-100 rounded border">
                  <span className="font-medium">QR Code Data:</span>
                  <code className="ml-2 text-xs break-all">{scanResult.qr_code}</code>
                </div>
              )}
              {scanResult.barcode && (
                <div className="p-2 bg-base-100 rounded border">
                  <span className="font-medium">Barcode:</span>
                  <code className="ml-2">{scanResult.barcode}</code>
                </div>
              )}
              {scanResult.serial_number && (
                <div>
                  <span className="font-medium">Serial Number:</span> {scanResult.serial_number}
                </div>
              )}
              {scanResult.model_number && (
                <div>
                  <span className="font-medium">Model Number:</span> {scanResult.model_number}
                </div>
              )}

              {scanResult.productInfo && (
                <div className="mt-3 pt-3 border-t border-success/20">
                  <h5 className="font-medium text-success mb-2">Product Information</h5>
                  {scanResult.productInfo.found_info ? (
                    <div className="space-y-1">
                      {scanResult.productInfo.name && (
                        <div><span className="font-medium">Name:</span> {scanResult.productInfo.name}</div>
                      )}
                      {scanResult.productInfo.description && (
                        <div><span className="font-medium">Description:</span> {scanResult.productInfo.description}</div>
                      )}
                      {scanResult.productInfo.category && (
                        <div><span className="font-medium">Category:</span> {scanResult.productInfo.category}</div>
                      )}
                      {scanResult.productInfo.material && (
                        <div><span className="font-medium">Material:</span> {scanResult.productInfo.material}</div>
                      )}
                      {scanResult.productInfo.source && (
                        <div className="text-xs text-base-content/60">Source: {scanResult.productInfo.source}</div>
                      )}
                    </div>
                  ) : (
                    <p className="text-base-content/60">{scanResult.productInfo.description}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={handleUseData} className="bg-success hover:bg-success/90 text-success-content">
                Use This Data
              </Button>
              <Button variant="outline" onClick={() => setScanResult(null)}>
                Scan Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
