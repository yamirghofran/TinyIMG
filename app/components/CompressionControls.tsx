import React, { useState, useEffect } from 'react';
import { compressSVD } from '../wasm/wasmLoader';

interface CompressionControlsProps {
  imageData: ImageData | null;
  wasmModule: any;
  onCompressedImageUpdate: (data: ImageData) => void;
}

export function CompressionControls({
  imageData,
  wasmModule,
  onCompressedImageUpdate
}: CompressionControlsProps) {
  const [compressionRatio, setCompressionRatio] = useState<number>(50);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const [isLargeImage, setIsLargeImage] = useState<boolean>(false);
  
  // Calculate original image size and check if it's a large image
  useEffect(() => {
    if (imageData) {
      // Estimate original size (RGBA data)
      const size = imageData.width * imageData.height * 4;
      setOriginalSize(size);
      
      // Check if it's a large image (more than 1 million pixels)
      setIsLargeImage(imageData.width * imageData.height > 1000000);
    }
  }, [imageData]);
  
  // Apply SVD compression
  const handleCompression = () => {
    if (!imageData || !wasmModule) return;
    
    setIsCompressing(true);
    
    // Use setTimeout to allow UI to update before starting compression
    setTimeout(() => {
      try {
        // Apply SVD compression
        const compressedData = compressSVD(wasmModule, imageData, compressionRatio);
        
        // Estimate compressed size
        const compSize = compressedData.width * compressedData.height * 4 * (compressionRatio / 100);
        setCompressedSize(Math.round(compSize));
        
        // Update the compressed image
        onCompressedImageUpdate(compressedData);
      } catch (error) {
        console.error('Error during SVD compression:', error);
        alert('Compression failed. Try a lower compression quality or a smaller image.');
      } finally {
        setIsCompressing(false);
      }
    }, 50);
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
  
  if (!imageData || !wasmModule) {
    return null;
  }
  
  return (
    <div className="compression-controls">
      <h3>SVD Compression</h3>
      
      {isLargeImage && (
        <div className="warning-message">
          <p>Large image detected. Using simplified compression for better performance.</p>
        </div>
      )}
      
      <div className="compression-slider">
        <label htmlFor="compression-ratio">Compression Quality: {compressionRatio}%</label>
        <input
          id="compression-ratio"
          type="range"
          min="1"
          max="100"
          value={compressionRatio}
          onChange={(e) => setCompressionRatio(parseInt(e.target.value))}
        />
      </div>
      
      <button 
        className="compress-button"
        onClick={handleCompression}
        disabled={isCompressing}
      >
        {isCompressing ? 'Compressing...' : 'Apply SVD Compression'}
      </button>
      
      {isCompressing && (
        <div className="compression-loading">
          <div className="loading-spinner"></div>
          <p>Processing image... This may take a moment.</p>
        </div>
      )}
      
      {compressedSize > 0 && !isCompressing && (
        <div className="compression-stats">
          <p>Original: {formatFileSize(originalSize)}</p>
          <p>Compressed: {formatFileSize(compressedSize)}</p>
          <p>Reduction: {Math.round((1 - compressedSize / originalSize) * 100)}%</p>
        </div>
      )}
    </div>
  );
} 