import React, { useEffect, useRef, useState, useCallback } from 'react';

interface DownloadOptionsProps {
  transformedImageData: ImageData;
  compressionLevel: number;
  setCompressionLevel: (level: number) => void;
  outputFormat: string;
  setOutputFormat: (format: string) => void;
}

export function DownloadOptions({
  transformedImageData,
  compressionLevel,
  setCompressionLevel,
  outputFormat,
  setOutputFormat
}: DownloadOptionsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [originalSize, setOriginalSize] = useState<number>(0);
  
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
    
    // Calculate original size (uncompressed)
    const originalSizeBytes = transformedImageData.width * transformedImageData.height * 4; // RGBA = 4 bytes per pixel
    setOriginalSize(originalSizeBytes);
    
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
  
  // Calculate compression ratio
  const compressionRatio = originalSize > 0 ? ((originalSize - fileSize) / originalSize * 100).toFixed(1) : '0';
  
  return (
    <div className="download-options">
      <h3>Download Options</h3>
      
      {/* Hidden canvas for generating download */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* Format selector */}
      <div className="format-selector">
        <label htmlFor="format-select">Output Format:</label>
        <select 
          id="format-select"
          value={outputFormat}
          onChange={(e) => setOutputFormat(e.target.value)}
        >
          <option value="image/jpeg">JPEG</option>
          <option value="image/png">PNG</option>
          <option value="image/webp">WebP</option>
        </select>
      </div>
      
      {/* Compression level slider */}
      <div className="control-group">
        <h4>Compression Level</h4>
        <div className="slider-container">
          <input 
            type="range" 
            min="1" 
            max="100" 
            value={compressionLevel} 
            onChange={(e) => setCompressionLevel(Number(e.target.value))}
          />
          <label>
            <span>Quality:</span>
            <input 
              type="number" 
              value={compressionLevel} 
              onChange={(e) => setCompressionLevel(Number(e.target.value))}
              min="1"
              max="100"
            />%
          </label>
        </div>
      </div>
      
      {/* File size info */}
      <div className="file-info">
        <p>Estimated Size: {formatFileSize(fileSize)}</p>
        <p>Compression: {compressionRatio}%</p>
      </div>
      
      {/* Download button */}
      <button 
        className="download-button"
        onClick={handleDownload}
      >
        Download Image
      </button>
    </div>
  );
} 