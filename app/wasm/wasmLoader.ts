// This file handles loading the WebAssembly module

// Define the ImageProcessor module type
declare global {
  interface Window {
    ImageProcessor: any;
  }
}

// Function to load the WebAssembly module
export async function loadWasmModule(): Promise<any> {
  try {
    // Check if the module is already loaded
    if (window.ImageProcessor) {
      return window.ImageProcessor;
    }

    // Load the script manually
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/wasm/image_processor.js';
      script.async = true;
      script.onload = () => {
        // Once the script is loaded, the ImageProcessor function should be available
        if (typeof window.ImageProcessor !== 'undefined') {
          // Initialize the module
          window.ImageProcessor().then((module: any) => {
            console.log('WebAssembly module initialized');
            resolve(module);
          }).catch(reject);
        } else {
          reject(new Error('ImageProcessor not found after loading script'));
        }
      };
      script.onerror = () => {
        reject(new Error('Failed to load image_processor.js'));
      };
      document.body.appendChild(script);
    });
  } catch (error) {
    console.error('Failed to load WebAssembly module:', error);
    throw error;
  }
}

// Export transformation utility functions
export const createIdentityMatrix = (module: any) => {
  return module._createIdentityMatrix ? module._createIdentityMatrix() :
         module.ccall('createIdentityMatrix', 'number', [], []);
};

export const createRotationMatrix = (module: any, angle: number) => {
  return module._createRotationMatrix ? module._createRotationMatrix(angle) :
         module.ccall('createRotationMatrix', 'number', ['number'], [angle]);
};

export const createScalingMatrix = (module: any, sx: number, sy: number) => {
  return module._createScalingMatrix ? module._createScalingMatrix(sx, sy) :
         module.ccall('createScalingMatrix', 'number', ['number', 'number'], [sx, sy]);
};

export const createFlipMatrix = (module: any, horizontalFlip: boolean, verticalFlip: boolean) => {
  return module._createFlipMatrix ? 
         module._createFlipMatrix(horizontalFlip ? 1 : 0, verticalFlip ? 1 : 0) :
         module.ccall(
           'createFlipMatrix', 
           'number', 
           ['number', 'number'], 
           [horizontalFlip ? 1 : 0, verticalFlip ? 1 : 0]
         );
};

export const createWarpMatrix = (module: any, kx: number, ky: number) => {
  return module._createWarpMatrix ? module._createWarpMatrix(kx, ky) :
         module.ccall('createWarpMatrix', 'number', ['number', 'number'], [kx, ky]);
};

export const multiplyMatrices = (module: any, m1Ptr: number, m2Ptr: number) => {
  return module._multiplyMatrices ? module._multiplyMatrices(m1Ptr, m2Ptr) :
         module.ccall('multiplyMatrices', 'number', ['number', 'number'], [m1Ptr, m2Ptr]);
};

export const freeTransformMatrix = (module: any, matrixPtr: number) => {
  if (module._freeTransformMatrix) {
    module._freeTransformMatrix(matrixPtr);
  } else {
    module.ccall('freeTransformMatrix', null, ['number'], [matrixPtr]);
  }
};

export const applyTransformation = (
  module: any, 
  imageData: ImageData, 
  transformMatrix: number[][]
) => {
  // Create a flat array from the 2D matrix
  const flatMatrix = transformMatrix.flat();
  
  // Create a TransformMatrix in WebAssembly memory
  const transformMatrixPtr = createIdentityMatrix(module);
  
  // Set the matrix values
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const value = transformMatrix[i][j];
      // Access the matrix in WebAssembly memory
      const offset = transformMatrixPtr + (i * 3 + j) * 4; // 4 bytes per float
      module.HEAPF32[offset / 4] = value; // HEAPF32 is a Float32Array view of the memory
    }
  }
  
  // Convert canvas image data to WebAssembly format
  const imageDataArray = new Uint8ClampedArray(imageData.data);
  
  // Allocate memory in the WebAssembly heap
  const numBytes = imageDataArray.length;
  const ptr = module._malloc ? module._malloc(numBytes) : 
             (module.asm ? module.asm.malloc(numBytes) : 
             module.ccall('malloc', 'number', ['number'], [numBytes]));
  
  // Copy the image data to WebAssembly memory
  const heap = module.HEAPU8;
  heap.set(imageDataArray, ptr);
  
  // Create an ImageMatrix in WebAssembly
  const imageMatrixPtr = module._canvasDataToMatrix ? 
    module._canvasDataToMatrix(ptr, imageData.width, imageData.height, 4) :
    module.ccall(
      'canvasDataToMatrix',
      'number',
      ['number', 'number', 'number', 'number'],
      [ptr, imageData.width, imageData.height, 4] // Assuming RGBA
    );
  
  // Apply the transformation
  const resultMatrixPtr = module._applyTransformation ?
    module._applyTransformation(imageMatrixPtr, transformMatrixPtr) :
    module.ccall(
      'applyTransformation',
      'number',
      ['number', 'number'],
      [imageMatrixPtr, transformMatrixPtr]
    );
  
  // Convert the result back to canvas image data
  const resultDataPtr = module._matrixToCanvasData ?
    module._matrixToCanvasData(resultMatrixPtr) :
    module.ccall(
      'matrixToCanvasData',
      'number',
      ['number'],
      [resultMatrixPtr]
    );
  
  // Create a new ImageData from the result
  const resultArray = new Uint8ClampedArray(
    module.HEAPU8.buffer,
    resultDataPtr,
    imageData.width * imageData.height * 4
  );
  
  const transformedImageData = new ImageData(
    resultArray,
    imageData.width,
    imageData.height
  );
  
  // Free WebAssembly memory
  if (module._freeImageMatrix) {
    module._freeImageMatrix(imageMatrixPtr);
    module._freeImageMatrix(resultMatrixPtr);
  } else {
    module.ccall('freeImageMatrix', null, ['number'], [imageMatrixPtr]);
    module.ccall('freeImageMatrix', null, ['number'], [resultMatrixPtr]);
  }
  
  // Free the allocated memory
  if (module._free) {
    module._free(ptr);
    module._free(resultDataPtr);
  } else if (module.asm && module.asm.free) {
    module.asm.free(ptr);
    module.asm.free(resultDataPtr);
  } else {
    module.ccall('free', null, ['number'], [ptr]);
    module.ccall('free', null, ['number'], [resultDataPtr]);
  }
  
  return transformedImageData;
};

export const compressSVD = (
  module: any,
  imageData: ImageData,
  compressionRatio: number
) => {
  console.log('compressSVD called with ratio:', compressionRatio);
  
  // Convert canvas image data to WebAssembly format
  const imageDataArray = new Uint8ClampedArray(imageData.data);
  
  // Allocate memory in the WebAssembly heap
  const numBytes = imageDataArray.length;
  console.log('Allocating memory for image data:', numBytes, 'bytes');
  
  const ptr = module._malloc ? module._malloc(numBytes) : 
             (module.asm ? module.asm.malloc(numBytes) : 
             module.ccall('malloc', 'number', ['number'], [numBytes]));
  
  if (!ptr) {
    console.error('Failed to allocate memory for image data');
    return null;
  }
  console.log('Memory allocated at address:', ptr);
  
  // Copy the image data to WebAssembly memory
  const heap = module.HEAPU8;
  heap.set(imageDataArray, ptr);
  
  // Create an ImageMatrix in WebAssembly
  console.log('Creating ImageMatrix with dimensions:', imageData.width, 'x', imageData.height);
  const imageMatrixPtr = module._canvasDataToMatrix ? 
    module._canvasDataToMatrix(ptr, imageData.width, imageData.height, 4) :
    module.ccall(
      'canvasDataToMatrix',
      'number',
      ['number', 'number', 'number', 'number'],
      [ptr, imageData.width, imageData.height, 4] // Assuming RGBA
    );
  
  if (!imageMatrixPtr) {
    console.error('Failed to create ImageMatrix');
    module._free(ptr);
    return null;
  }
  console.log('ImageMatrix created at address:', imageMatrixPtr);
  
  // Apply SVD compression
  console.log('Calling _compressSVD with ratio:', compressionRatio);
  const compressedMatrixPtr = module._compressSVD ?
    module._compressSVD(imageMatrixPtr, compressionRatio) :
    module.ccall(
      'compressSVD',
      'number',
      ['number', 'number'],
      [imageMatrixPtr, compressionRatio]
    );
  
  if (!compressedMatrixPtr) {
    console.error('Failed to compress image with SVD');
    module._freeImageMatrix(imageMatrixPtr);
    module._free(ptr);
    return null;
  }
  console.log('Compressed ImageMatrix created at address:', compressedMatrixPtr);
  
  // Convert the result back to canvas image data
  console.log('Converting compressed matrix to canvas data');
  const resultDataPtr = module._matrixToCanvasData ?
    module._matrixToCanvasData(compressedMatrixPtr) :
    module.ccall(
      'matrixToCanvasData',
      'number',
      ['number'],
      [compressedMatrixPtr]
    );
  
  if (!resultDataPtr) {
    console.error('Failed to convert compressed matrix to canvas data');
    module._freeImageMatrix(imageMatrixPtr);
    module._freeImageMatrix(compressedMatrixPtr);
    module._free(ptr);
    return null;
  }
  console.log('Canvas data created at address:', resultDataPtr);
  
  // Create a new ImageData from the result
  try {
    const resultArray = new Uint8ClampedArray(
      module.HEAPU8.buffer,
      resultDataPtr,
      imageData.width * imageData.height * 4
    );
    
    const compressedImageData = new ImageData(
      resultArray,
      imageData.width,
      imageData.height
    );
    
    console.log('Successfully created compressed ImageData');
    
    // Free WebAssembly memory
    if (module._freeImageMatrix) {
      module._freeImageMatrix(imageMatrixPtr);
      module._freeImageMatrix(compressedMatrixPtr);
    } else {
      module.ccall('freeImageMatrix', null, ['number'], [imageMatrixPtr]);
      module.ccall('freeImageMatrix', null, ['number'], [compressedMatrixPtr]);
    }
    
    // Free the allocated memory
    if (module._free) {
      module._free(ptr);
      module._free(resultDataPtr);
    } else if (module.asm && module.asm.free) {
      module.asm.free(ptr);
      module.asm.free(resultDataPtr);
    } else {
      module.ccall('free', null, ['number'], [ptr]);
      module.ccall('free', null, ['number'], [resultDataPtr]);
    }
    
    return compressedImageData;
  } catch (error) {
    console.error('Error creating compressed ImageData:', error);
    
    // Free WebAssembly memory
    if (module._freeImageMatrix) {
      module._freeImageMatrix(imageMatrixPtr);
      module._freeImageMatrix(compressedMatrixPtr);
    } else {
      module.ccall('freeImageMatrix', null, ['number'], [imageMatrixPtr]);
      module.ccall('freeImageMatrix', null, ['number'], [compressedMatrixPtr]);
    }
    
    // Free the allocated memory
    if (module._free) {
      module._free(ptr);
      module._free(resultDataPtr);
    } else if (module.asm && module.asm.free) {
      module.asm.free(ptr);
      module.asm.free(resultDataPtr);
    } else {
      module.ccall('free', null, ['number'], [ptr]);
      module.ccall('free', null, ['number'], [resultDataPtr]);
    }
    
    return null;
  }
}; 