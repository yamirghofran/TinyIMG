#!/bin/bash

# Exit on error
set -e

echo "TinyImg WebAssembly Build Script"
echo "================================"

# Check if Emscripten is installed
if ! command -v emcc &> /dev/null; then
    echo "Emscripten not found. Installing..."
    
    # Clone the Emscripten repository
    git clone https://github.com/emscripten-core/emsdk.git
    
    # Enter the directory
    cd emsdk
    
    # Download and install the latest SDK tools
    ./emsdk install latest
    
    # Make the "latest" SDK "active" for the current user
    ./emsdk activate latest
    
    # Activate path variables
    source ./emsdk_env.sh
    
    cd ..
    
    echo "Emscripten installed successfully."
else
    echo "Emscripten is already installed."
fi

# Create the output directories
mkdir -p c_src/build
mkdir -p public/wasm

# Build the WebAssembly module
echo "Building WebAssembly module..."
cd c_src
# Update the exported functions list to include _compressSVD
EXPORTED_FUNCTIONS="['_malloc','_free','_canvasDataToMatrix','_matrixToCanvasData','_createIdentityMatrix','_createRotationMatrix','_createScalingMatrix','_createFlipMatrix','_createWarpMatrix','_multiplyMatrices','_freeTransformMatrix','_applyTransformation','_freeImageMatrix','_compressSVD']"

# Compile the C code to object file
emcc -O3 -s WASM=1 -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 -s EXPORT_NAME="ImageProcessor" -s EXPORTED_FUNCTIONS=$EXPORTED_FUNCTIONS -I./include -c src/image_processor.c -o src/image_processor.o

# Link the object file to create the WebAssembly module
emcc -O3 -s WASM=1 -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 -s EXPORT_NAME="ImageProcessor" -s EXPORTED_FUNCTIONS=$EXPORTED_FUNCTIONS -I./include src/image_processor.o -o build/image_processor.js

# Copy the WebAssembly files to the public directory
cp build/image_processor.js ../public/wasm/
cp build/image_processor.wasm ../public/wasm/
cd ..

echo "Build completed successfully!"
echo "The WebAssembly module is available in public/wasm/"

# Verify the files exist
if [ -f "public/wasm/image_processor.js" ] && [ -f "public/wasm/image_processor.wasm" ]; then
    echo "✅ WebAssembly files successfully generated"
else
    echo "❌ Error: WebAssembly files not found in public/wasm/"
    exit 1
fi 