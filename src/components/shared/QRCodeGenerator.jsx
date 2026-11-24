import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { QrCode, Download, Copy, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl, parseInternalLink } from '@/utils';
import { qrCodeDataUrl, qrCodePngDataUrl, qrContent } from '@/lib/qr';
import { PAGE_NAMES } from '@/lib/pages';

// QR codes are drawn in the browser (see src/lib/qr.js).
const generateQRCodeUrl = (data) => qrCodeDataUrl(data);

// Decides where a scanned code should take you.
export const handleQRCodeScan = (qrData, navigate) => {
  try {
    // Clean the QR data
    const cleanData = String(qrData || '').trim();
    if (!cleanData) return;

    // A link into this app — or into the old Base44 copy of it, so labels
    // printed before the move keep working.
    const internalPath = parseInternalLink(cleanData, PAGE_NAMES);
    if (internalPath) {
      navigate(internalPath);
      return;
    }

    // Check if it's a location QR code
    if (cleanData.startsWith('LOC-') || (!cleanData.startsWith('http') && cleanData.toLowerCase().includes('location'))) {
      navigate(createPageUrl(`LocationViewer?qr=${encodeURIComponent(cleanData)}`));
      return;
    }

    // Check if it's a container QR code
    if (cleanData.startsWith('CONT-') || (!cleanData.startsWith('http') && cleanData.toLowerCase().includes('container'))) {
      navigate(createPageUrl(`Inventory?container=${encodeURIComponent(cleanData)}`));
      return;
    }

    // A borrowed item's temporary tag number
    if (/^LN-\d{2}-\d{3,}$/i.test(cleanData)) {
      navigate(createPageUrl(`BorrowedItems?search=${encodeURIComponent(cleanData)}`));
      return;
    }

    // Check if it's an item UID
    if (cleanData.startsWith('CST-')) {
      navigate(createPageUrl(`Search?query=${encodeURIComponent(cleanData)}`));
      return;
    }

    // Check if it's an external URL
    if (cleanData.startsWith('http')) {
      window.open(cleanData, '_blank', 'noopener');
      return;
    }

    // Default: search for the QR code data
    navigate(createPageUrl(`Search?query=${encodeURIComponent(cleanData)}`));

  } catch (error) {
    console.error('Error handling QR code scan:', error);
    // Fallback to search
    navigate(createPageUrl(`Search?query=${encodeURIComponent(qrData)}`));
  }
};

export default function QRCodeGenerator({ 
  data: rawData, 
  label = "QR Code", 
  size = 200, 
  className = "",
  showPreview = true 
}) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  
  if (!rawData) return null;
  // Links into the app always point at this site's current address.
  const data = qrContent(rawData);

  const qrCodeUrl = generateQRCodeUrl(data);
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(data);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const downloadQRCode = async () => {
    try {
      const link = document.createElement('a');
      link.href = await qrCodePngDataUrl(data, 600); // Higher resolution for download
      link.download = `qr-code-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download QR code:', err);
    }
  };

  const testQRCode = () => {
    handleQRCodeScan(data, navigate);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <QrCode className="w-4 h-4 mr-2" />
          {showPreview ? 'View QR Code' : label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* QR Code Display */}
          <div className="flex justify-center p-4 bg-white rounded-lg">
            <img 
              src={qrCodeUrl} 
              alt={`QR Code for ${label}`}
              className="max-w-full h-auto"
              style={{ width: size, height: size }}
            />
          </div>

          {/* QR Code Data */}
          <div className="space-y-2">
            <label className="text-sm font-medium">QR Code Data:</label>
            <div className="p-3 bg-base-200 rounded border">
              <code className="text-sm break-all">{data}</code>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={copyToClipboard} variant="outline" size="sm">
              <Copy className="w-4 h-4 mr-2" />
              Copy Data
            </Button>
            
            <Button onClick={downloadQRCode} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download PNG
            </Button>
            
            <Button onClick={testQRCode} variant="outline" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              Test Navigation
            </Button>
          </div>

          {/* Mobile Instructions */}
          <div className="text-xs text-base-content/70 bg-base-200/50 p-3 rounded">
            <strong>Mobile Scanning:</strong> Use your device's camera app or QR scanner to scan this code. 
            It will automatically navigate to the correct page in the app.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}