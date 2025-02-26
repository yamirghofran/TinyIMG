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
make
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