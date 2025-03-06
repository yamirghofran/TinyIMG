import React, { useEffect, useRef, useState, useCallback } from 'react';
import { applyTransformation } from '../wasm/wasmLoader';

// Import the WebAssembly module
declare global {
  interface Window {
    ImageProcessor: any;
  }
}

interface CanvasWorkspaceProps {
  imageData: ImageData;
  transformMatrix: number[][];
  onTransformedImageUpdate: (imageData: ImageData) => void;
  wasmModule: any;
}

export function CanvasWorkspace({ 
  imageData, 
  transformMatrix,
  onTransformedImageUpdate,
  wasmModule
}: CanvasWorkspaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Draw the original image when it changes
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions to match the image
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    
    // Draw the original image
    ctx.putImageData(imageData, 0, 0);
    
  }, [imageData]);

  // Apply transformations when the matrix changes
  useEffect(() => {
    if (!canvasRef.current || !wasmModule || !imageData || isProcessing) return;
    
    // Only apply transformation if it's not the identity matrix
    const isIdentity = transformMatrix.every((row, i) => 
      row.every((val, j) => val === (i === j ? 1 : 0))
    );
    
    if (isIdentity) {
      // If identity matrix, just use the original image
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(imageData, 0, 0);
        onTransformedImageUpdate(imageData);
      }
      return;
    }
    
    const processTransformation = async () => {
      setIsProcessing(true);
      setIsLoading(true);
      
      try {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        
        // Use the wasmLoader utility to apply the transformation
        const transformedImageData = applyTransformation(
          wasmModule,
          imageData,
          transformMatrix
        );
        
        // Draw the transformed image
        ctx.putImageData(transformedImageData, 0, 0);
        
        // Notify parent component of the transformed image
        onTransformedImageUpdate(transformedImageData);
        
      } catch (error) {
        console.error('Error applying transformation:', error);
        
        // Fallback: just display the original image
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(imageData, 0, 0);
        onTransformedImageUpdate(imageData);
      } finally {
        setIsLoading(false);
        setIsProcessing(false);
      }
    };
    
    processTransformation();
    
  }, [imageData, transformMatrix, wasmModule, onTransformedImageUpdate, isProcessing]);

  return (
    <div className="canvas-container">
      {isLoading && (
        <div className="loading-overlay">
          <p>Processing...</p>
        </div>
      )}
      <canvas ref={canvasRef} />
    </div>
  );
} 