import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';

export default function PrintView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, containers } = location.state || { items: [], containers: [] };

  useEffect(() => {
    // Automatically trigger print dialog when component mounts
    // setTimeout(window.print, 1000); 
  }, []);

  const containerMap = useMemo(() => {
    return containers.reduce((acc, container) => {
      acc[container.id] = container.name;
      return acc;
    }, {});
  }, [containers]);

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    navigate(-1); // Go back to the previous page
  };

  return (
    <div className="print-container p-8 bg-white">
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background-color: white !important;
          }
          .print-container {
            padding: 0 !important;
          }
        }
      `}</style>
      <div className="no-print mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Print Preview</h1>
          <p className="text-gray-500">Showing {items.length} items.</p>
        </div>
        <div>
          <Button variant="outline" onClick={handleBack} className="mr-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        </div>
      </div>
      
      <table className="w-full text-sm text-left border-collapse">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="p-2">Name</th>
            <th className="p-2">Categories</th>
            <th className="p-2">Condition</th>
            <th className="p-2">Status</th>
            <th className="p-2">Location</th>
            <th className="p-2">Container</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-b">
              <td className="p-2 font-medium">{item.name}</td>
              <td className="p-2 capitalize">{(item.categories || [item.category]).join(', ')}</td>
              <td className="p-2 capitalize">{item.condition?.replace('_', ' ')}</td>
              <td className="p-2 capitalize">{item.status}</td>
              <td className="p-2">{item.location || 'N/A'}</td>
              <td className="p-2">{item.container_id ? containerMap[item.container_id] : 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}