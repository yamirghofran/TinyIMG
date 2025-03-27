#!/bin/bash

# Compile Go code (main.go) in the current directory to WebAssembly
GOOS=js GOARCH=wasm go build -o ../frontend/public/main.wasm main.go

# Find the wasm_exec.js file
WASM_EXEC_PATH=$(go env GOROOT)/misc/wasm/wasm_exec.js
if [ ! -f "$WASM_EXEC_PATH" ]; then
  # Try alternative locations
  WASM_EXEC_PATH=$(go env GOROOT)/share/go/misc/wasm/wasm_exec.js
  if [ ! -f "$WASM_EXEC_PATH" ]; then
    # One more attempt
    WASM_EXEC_PATH=$(find $(go env GOROOT) -name "wasm_exec.js" | head -n 1)
  fi
fi

# Copy the WebAssembly support file to the public directory
if [ -f "$WASM_EXEC_PATH" ]; then
  cp "$WASM_EXEC_PATH" ../frontend/public/wasm_exec.js
  echo "Copied wasm_exec.js from $WASM_EXEC_PATH to ../frontend/public/"
else
  echo "Error: Could not find wasm_exec.js"
  exit 1
fi

echo "Build completed successfully!"
