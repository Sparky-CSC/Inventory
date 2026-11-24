
import { qrCodeDataUrl } from '@/lib/qr';
import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import { useAppSettings } from '../components/shared/AppSettingsContext';
import { Container } from '@/entities/Container';

// QR codes are drawn in the browser (see src/lib/qr.js).
const generateQRCodeUrl = (data) => qrCodeDataUrl(data);

export default function PrintHangTags() {
  const navigate = useNavigate();
  const location = useLocation();
  const { appSettings } = useAppSettings();

  // State for items and containers
  const [items, setItems] = React.useState([]);
  const [containers, setContainers] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Load containers to map container IDs to names
  useEffect(() => {
    const passedItems = location.state?.items || [];
    setItems(passedItems);

    const loadContainers = async () => {
      try {
        const containersData = await Container.list();
        setContainers(containersData);
      } catch (error) {
        console.error("Failed to load containers for hang tags:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadContainers();
  }, [location.state]);

  const containerMap = useMemo(() => {
    return new Map(containers.map(c => [c.id, c.name]));
  }, [containers]);

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    navigate(-1); // Go back to the previous page
  };

  if (isLoading) {
    return (
      <div className="p-8 bg-base-100 min-h-screen">
        <div className="text-center">
          <div className="text-xl font-bold text-base-content">Loading tag data...</div>
        </div>
      </div>
    );
  }
  
  if (items.length === 0) {
    return (
      <div className="p-8 bg-base-100 min-h-screen">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-base-content mb-4">No items selected for printing.</h1>
          <p className="text-base-content/70 mb-6">Please select items from the inventory to print their hang tags.</p>
          <Button 
            onClick={handleBack} 
            className="bg-primary hover:bg-primary-focus text-primary-content border-2 border-primary"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Inventory
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="print-container bg-gray-100 min-h-screen">
      <style>{`
        @media screen {
          body { 
            background-color: var(--color-base-100, #FFFFFF) !important; 
            color: var(--color-base-content, #1F2937) !important;
          }
        }
        @media print {
          body { 
            background-color: white !important; 
            color: black !important;
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          .no-print { display: none !important; }
          .print-container { 
            padding: 0.125in 0 !important; 
            background-color: white !important;
          }
          .hang-tag-grid { 
            grid-template-columns: repeat(2, 1fr) !important; 
            gap: 0.125in !important; 
            max-width: 8.5in !important;
            margin: 0 auto !important;
          }
          .hang-tag { 
            width: 3in !important;
            height: 1.5in !important;
            border: 2px solid #333 !important; 
            page-break-inside: avoid !important;
            box-shadow: none !important;
            background-color: white !important;
            color: black !important;
            display: flex !important;
            flex-direction: row !important;
            padding: 0.05in !important;
            margin: 0 !important;
          }
          .hang-tag h2, .hang-tag p, .hang-tag div {
            color: black !important;
          }
          .tag-left {
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            padding-right: 0.05in !important;
          }
          .tag-right {
            flex: 0 0 0.8in !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
          }
          .tag-title {
            font-size: 11px !important;
            font-weight: bold !important;
            line-height: 1.1 !important;
            margin: 0 !important;
            max-height: 0.6in !important;
            overflow: hidden !important;
          }
          .tag-info {
            font-size: 8px !important;
            line-height: 1.2 !important; /* Changed from 1.1 to 1.2 */
            margin: 0 !important;
          }
          .tag-qr {
            width: 0.8in !important;
            height: 0.8in !important;
            margin: 0 !important; /* Changed from 0.05in 0 to 0 */
          }
          /* .tag-uid styles removed as UID is now part of tag-info */
          .tag-logo {
            height: 0.15in !important;
            max-width: 100% !important;
            object-fit: contain !important;
            margin-bottom: 0.02in !important;
          }
        }
      `}</style>
      
      <div className="no-print sticky top-0 bg-white shadow-md p-4 mb-8 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div>
            <h1 className="text-2xl font-bold">Hang Tag Preview (1.5\" × 3.0\")</h1>
            <p className="text-gray-500">Printing {items.length} tag(s). Recommended paper: Cardstock or Tag Stock.</p>
            </div>
            <div className="flex gap-2">
            <Button variant="outline" onClick={handleBack} className="mr-2">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={handlePrint} 
              className="bg-primary hover:bg-primary-focus text-primary-content border-2 border-primary"
              style={{ 
                backgroundColor: 'var(--color-primary)', 
                color: 'var(--color-primary-content)',
                borderColor: 'var(--color-primary)'
              }}
            >
                <Printer className="w-4 h-4 mr-2" /> Print Tags
            </Button>
            </div>
        </div>
      </div>
      
      <div className="hang-tag-grid grid grid-cols-1 md:grid-cols-2 gap-6 p-4 max-w-7xl mx-auto">
        {items.map(item => {
          const itemLocation = item.location || (item.container_id ? containerMap.get(item.container_id) : 'Storage');
          return (
            <div key={item.id} className="hang-tag bg-white p-3 rounded-lg shadow-lg border-2 border-dashed border-gray-400 break-inside-avoid flex flex-row" style={{width: '3in', height: '1.5in'}}>
              {/* Left side - Text information */}
              <div className="tag-left flex-1 flex flex-col justify-between pr-2">
                {/* Header with logo */}
                <div className="flex items-center gap-1"> {/* Removed mb-1 */}
                  {appSettings?.logoUrl && (
                    <img src={appSettings.logoUrl} alt="Logo" className="tag-logo h-3 object-contain" />
                  )}
                  <p className="text-xs font-medium">Culver-Stockton College Theatre Department</p>
                </div>

                {/* Item name */}
                <h2 className="tag-title text-sm font-bold leading-tight" style={{maxHeight: '0.6in', overflow: 'hidden'}}> {/* Removed mb-1 */}
                  {item.name}
                </h2>
                
                {/* Info Block */}
                <div>
                  <p className="tag-info text-xs">
                    <span className="font-medium">Location:</span> {itemLocation}
                  </p>
                  <p className="tag-info text-xs">
                    <span className="font-medium">UID:</span> {item.uid || 'N/A'}
                  </p>
                  {(item.categories?.length > 0 || item.category) && (
                    <p className="tag-info text-xs">
                      <span className="font-medium">Type:</span> {(item.categories || [item.category]).join(', ')}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Right side - QR Code */}
              <div className="tag-right flex flex-col items-center justify-center text-center" style={{flex: '0 0 0.8in'}}>
                <img 
                  src={generateQRCodeUrl(item.qr_code)} 
                  alt={`QR Code for ${item.name}`} 
                  className="tag-qr" 
                  style={{width: '0.8in', height: '0.8in'}} 
                />
                {/* UID moved to tag-left */}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
