import React, { useEffect, useRef, useState, useCallback } from 'react';

interface DownloadOptionsProps {
  transformedImageData: ImageData;
  compressionLevel: number;
  outputFormat: string;
}

export function DownloadOptions({
  transformedImageData,
  compressionLevel,
  outputFormat
}: DownloadOptionsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  
  // Generate download URL function
  const generateDownloadUrl = useCallback(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    
    // Get data URL with compression
    const quality = compressionLevel / 100;
    const dataUrl = canvas.toDataURL(outputFormat, quality);
    
    // Estimate file size from data URL
    const base64 = dataUrl.split(',')[1];
    const estimatedSize = Math.ceil((base64.length * 3) / 4); // Base64 to binary size estimation
    
    setFileSize(estimatedSize);
    setDownloadUrl(dataUrl);
  }, [compressionLevel, outputFormat]);
  
  // Update canvas with transformed image data
  useEffect(() => {
    if (!canvasRef.current || !transformedImageData) return;
    
    const canvas = canvasRef.current;
    canvas.width = transformedImageData.width;
    canvas.height = transformedImageData.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.putImageData(transformedImageData, 0, 0);
    
    // Generate download URL with current compression
    generateDownloadUrl();
  }, [transformedImageData, generateDownloadUrl]);
  
  // Generate download URL when compression or format changes
  useEffect(() => {
    generateDownloadUrl();
  }, [compressionLevel, outputFormat, generateDownloadUrl]);
  
  const handleDownload = () => {
    if (!downloadUrl) return;
    
    // Create a download link
    const link = document.createElement('a');
    
    // Set file extension based on format
    let extension = 'jpg';
    if (outputFormat === 'image/png') {
      extension = 'png';
    } else if (outputFormat === 'image/webp') {
      extension = 'webp';
    }
    
    link.download = `tinyimg_processed.${extension}`;
    link.href = downloadUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  };
  
  return (
    <div className="download-options-compact">
      {/* Hidden canvas for generating download */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* Download button with file size */}
      <button 
        className="download-button-small"
        onClick={handleDownload}
      >
        Download ({formatFileSize(fileSize)})
      </button>
    </div>
  );
} 