import React, { useEffect, useRef, useState, useCallback } from 'react';
import { loadWasmModule } from '../wasm/wasmLoader';

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
}

export function CanvasWorkspace({ 
  imageData, 
  transformMatrix,
  onTransformedImageUpdate
}: CanvasWorkspaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wasmModule, setWasmModule] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load WebAssembly module
  useEffect(() => {
    const loadWasm = async () => {
      try {
        setIsLoading(true);
        // Use the wasmLoader utility to load the module
        const module = await loadWasmModule();
        
        // Debug: Log the module structure
        console.log('WebAssembly module structure:', Object.keys(module));
        if (module.asm) console.log('asm methods:', Object.keys(module.asm));
        
        // Debug: Check if the specific functions we need are available
        console.log('Direct functions available:',
          'createIdentityMatrix:', !!module._createIdentityMatrix,
          'canvasDataToMatrix:', !!module._canvasDataToMatrix,
          'applyTransformation:', !!module._applyTransformation,
          'matrixToCanvasData:', !!module._matrixToCanvasData,
          'freeImageMatrix:', !!module._freeImageMatrix
        );
        
        setWasmModule(module);
        console.log('WebAssembly module loaded successfully');
      } catch (error) {
        console.error('Failed to load WebAssembly module:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadWasm();
  }, []);

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
    
    const applyTransformation = async () => {
      setIsProcessing(true);
      setIsLoading(true);
      
      try {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        
        // Convert JS matrix to C-compatible format
        const flatMatrix = transformMatrix.flat();
        
        // Create a TransformMatrix in WebAssembly memory
        const transformMatrixPtr = wasmModule._createIdentityMatrix 
          ? wasmModule._createIdentityMatrix() 
          : wasmModule.ccall('createIdentityMatrix', 'number', [], []);
        
        // Set the matrix values
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const value = transformMatrix[i][j];
            // Access the matrix in WebAssembly memory
            const offset = transformMatrixPtr + (i * 3 + j) * 4; // 4 bytes per float
            wasmModule.HEAPF32[offset / 4] = value; // HEAPF32 is a Float32Array view of the memory
          }
        }
        
        // Convert canvas image data to WebAssembly format
        const imageDataArray = new Uint8ClampedArray(imageData.data);
        
        // Allocate memory in the WebAssembly heap
        const numBytes = imageDataArray.length;
        const ptr = wasmModule._malloc ? wasmModule._malloc(numBytes) : 
                   (wasmModule.asm ? wasmModule.asm.malloc(numBytes) : 
                   wasmModule.ccall('malloc', 'number', ['number'], [numBytes]));
        
        // Copy the image data to WebAssembly memory
        const heap = wasmModule.HEAPU8;
        heap.set(imageDataArray, ptr);
        
        // Create an ImageMatrix in WebAssembly
        const imageMatrixPtr = wasmModule._canvasDataToMatrix 
          ? wasmModule._canvasDataToMatrix(ptr, imageData.width, imageData.height, 4)
          : wasmModule.ccall(
              'canvasDataToMatrix',
              'number',
              ['number', 'number', 'number', 'number'],
              [ptr, imageData.width, imageData.height, 4]
            );
        
        // Apply the transformation
        const resultMatrixPtr = wasmModule._applyTransformation
          ? wasmModule._applyTransformation(imageMatrixPtr, transformMatrixPtr)
          : wasmModule.ccall(
              'applyTransformation',
              'number',
              ['number', 'number'],
              [imageMatrixPtr, transformMatrixPtr]
            );
        
        // Convert the result back to canvas image data
        const resultDataPtr = wasmModule._matrixToCanvasData
          ? wasmModule._matrixToCanvasData(resultMatrixPtr)
          : wasmModule.ccall(
              'matrixToCanvasData',
              'number',
              ['number'],
              [resultMatrixPtr]
            );
        
        // Create a new ImageData from the result
        const resultArray = new Uint8ClampedArray(
          wasmModule.HEAPU8.buffer,
          resultDataPtr,
          imageData.width * imageData.height * 4
        );
        
        const transformedImageData = new ImageData(
          resultArray,
          imageData.width,
          imageData.height
        );
        
        // Draw the transformed image
        ctx.putImageData(transformedImageData, 0, 0);
        
        // Notify parent component of the transformed image
        onTransformedImageUpdate(transformedImageData);
        
        // Free WebAssembly memory
        if (wasmModule._freeImageMatrix) {
          wasmModule._freeImageMatrix(imageMatrixPtr);
          wasmModule._freeImageMatrix(resultMatrixPtr);
        } else {
          wasmModule.ccall('freeImageMatrix', null, ['number'], [imageMatrixPtr]);
          wasmModule.ccall('freeImageMatrix', null, ['number'], [resultMatrixPtr]);
        }
        
        // Free the allocated memory
        if (wasmModule._free) {
          wasmModule._free(ptr);
          wasmModule._free(resultDataPtr);
        } else if (wasmModule.asm && wasmModule.asm.free) {
          wasmModule.asm.free(ptr);
          wasmModule.asm.free(resultDataPtr);
        } else {
          wasmModule.ccall('free', null, ['number'], [ptr]);
          wasmModule.ccall('free', null, ['number'], [resultDataPtr]);
        }
        
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
    
    applyTransformation();
    
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