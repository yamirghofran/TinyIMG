import React, { useState, useEffect } from 'react';
import { compressSVD } from '../wasm/wasmLoader';
import '../styles/loader.css';

interface SVDCompressionControlsProps {
  imageData: ImageData | null;
  wasmModule: any;
  onCompressedImageChange: (compressedImageData: ImageData) => void;
}

interface CompressionResult {
  success: boolean;
  svdFailed?: boolean;
  warning?: string | null;
  error?: string;
  imageData: ImageData | null;
}

const SVDCompressionControls: React.FC<SVDCompressionControlsProps> = ({
  imageData,
  wasmModule,
  onCompressedImageChange,
}) => {
  const [compressionRatio, setCompressionRatio] = useState<number>(0.2);
  const [compressionStatus, setCompressionStatus] = useState<string>('');
  const [compressionWarning, setCompressionWarning] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [progressStage, setProgressStage] = useState<number>(0);
  
  // Progress stages for the animation
  const progressStages = [
    'Initializing compression...',
    'Allocating memory...',
    'Creating image matrix...',
    'Computing SVD decomposition...',
    'Reconstructing image with reduced rank...',
    'Converting to image data...',
    'Finalizing compression...'
  ];
  
  // Update progress stage periodically during compression
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isCompressing) {
      interval = setInterval(() => {
        setProgressStage(prev => (prev + 1) % progressStages.length);
      }, 800);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCompressing, progressStages.length]);

  const handleCompressionRatioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCompressionRatio(parseFloat(e.target.value));
    // Clear previous warnings when changing ratio
    setCompressionWarning(null);
  };

  const handleApplyCompression = () => {
    if (!imageData || !wasmModule) {
      setCompressionStatus('Error: Cannot start compression');
      return;
    }
    
    setIsCompressing(true);
    setCompressionStatus('Starting compression...');
    setCompressionWarning(null);
    setProgressStage(0);
    
    // Use setTimeout to prevent UI blocking
    setTimeout(() => {
      try {
        // Use the compressSVD function from wasmLoader
        const result = compressSVD(
          wasmModule,
          imageData,
          compressionRatio
        ) as CompressionResult;
        
        if (result.success && result.imageData) {
          onCompressedImageChange(result.imageData);
          
          if (result.svdFailed) {
            setCompressionStatus('Compression completed with issues');
            setCompressionWarning(result.warning || 'SVD computation failed. The original image was returned.');
          } else {
            setCompressionStatus('Compression complete!');
            setCompressionWarning(result.warning || null);
          }
        } else {
          setCompressionStatus(`Error: ${result.error || 'Compression failed'}`);
        }
      } catch (error) {
        console.error('Error applying SVD compression:', error);
        setCompressionStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsCompressing(false);
      }
    }, 100);
  };

  return (
    <div className="svd-compression-controls">
      <h3>SVD Compression</h3>
      <div className="control-group">
        <label htmlFor="compressionRatio">
          Compression Ratio: {compressionRatio.toFixed(2)}
        </label>
        <input
          type="range"
          id="compressionRatio"
          min="0.01"
          max="1"
          step="0.01"
          value={compressionRatio}
          onChange={handleCompressionRatioChange}
          disabled={isCompressing}
        />
      </div>
      <button 
        onClick={handleApplyCompression}
        disabled={!imageData || !wasmModule || isCompressing}
        className="apply-button"
      >
        {isCompressing ? (
          <span className="button-with-loader">
            <span className="loader-text">Compressing...</span>
            <span className="loader"></span>
          </span>
        ) : (
          compressionStatus ? `${compressionStatus}` : 'Apply SVD Compression'
        )}
      </button>
      {compressionStatus && !isCompressing && (
        <div className={`compression-status ${compressionWarning ? 'with-warning' : ''}`}>
          Status: {compressionStatus}
        </div>
      )}
      {compressionWarning && !isCompressing && (
        <div className="compression-warning">
          <span className="warning-icon">⚠️</span> {compressionWarning}
        </div>
      )}
      {isCompressing && (
        <div className="compression-progress">
          <p>{progressStages[progressStage]}</p>
          <div className="progress-bar-container">
            <div className="progress-bar-indeterminate"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SVDCompressionControls;