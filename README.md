# TinyIMG

A high-performance image processing application that combines Go's computational power with WebAssembly for browser-based image manipulation. This project demonstrates advanced linear algebra techniques including Singular Value Decomposition (SVD) for image compression and parallel processing for real-time performance.

<img width="2028" height="1152" alt="CleanShot 2025-09-18 at 18 11 18@2x" src="https://github.com/user-attachments/assets/aadf1ece-1e1f-4d81-94f6-d038fa59f95b" />

## Key Features

- **Real-time Image Processing**: High-performance convolution filters (blur, sharpen, edge detection, emboss)
- **SVD-based Image Compression**: Advanced linear algebra for lossy image compression with configurable rank
- **Geometric Transformations**: Real-time rotation, scaling, shearing, and translation with matrix visualization
- **WebGL Rendering**: Hardware-accelerated image display with custom shaders
- **Parallel Processing**: Multi-core Go goroutines for optimized performance
- **Interactive UI**: Modern React interface with drag-and-drop functionality

## Technical Architecture

### Tech Stack

#### Frontend

- **React 19**: Modern React with hooks and TypeScript
- **TypeScript**: Full type safety for robust development
- **Vite**: Fast build tool and development server
- **TailwindCSS**: Utility-first CSS framework
- **ShadcnUI**: Accessible, customizable UI components
- **gl-matrix**: High-performance matrix operations for 3D graphics math
- **WebGL**: Hardware-accelerated 2D image rendering

#### Backend (WebAssembly)

- **Go 1.24**: Systems programming language for performance-critical code
- **Gonum**: Scientific computing library for linear algebra operations
- **WebAssembly**: Binary instruction format for running Go in browsers
- **Parallel Processing**: Goroutines for multi-core CPU utilization

### System Architecture

The application follows a hybrid architecture where computationally intensive operations are performed in WebAssembly-compiled Go code, while the user interface and WebGL rendering are handled by React.

1. **Image Upload**: Images are loaded into browser memory as pixel arrays
2. **WASM Processing**: Raw pixel data is passed to Go functions via WebAssembly
3. **Linear Algebra**: SVD decomposition and convolution operations in native Go
4. **WebGL Rendering**: Processed images displayed using custom WebGL shaders

## Linear Algebra & Mathematical Operations

### Singular Value Decomposition (SVD) Compression

The SVD compression algorithm is the cornerstone of TinyIMG's advanced image processing capabilities. SVD decomposes an image matrix into three separate matrices:

```
A = U * Σ * V^T
```

Where:

- **A**: Original image matrix (height × width × channels)
- **U**: Left singular vectors (height × height)
- **Σ**: Diagonal matrix of singular values (height × width)
- **V^T**: Right singular vectors transposed (width × width)

#### Mathematical Implementation

For an image with dimensions h × w, each color channel is treated as a separate matrix. The compression works by:

1. **Matrix Construction**: Convert pixel data to dense matrices for R, G, B, A channels
2. **SVD Factorization**: Compute U, Σ, V using Gonum's optimized LAPACK bindings
3. **Rank Reduction**: Keep only the top k singular values and corresponding vectors
4. **Reconstruction**: Rebuild the image using: `A' = U_k * Σ_k * V_k^T`

#### Compression Formula

```go
// For each color channel matrix M:
// 1. Factorize: M = U * Σ * V^T
// 2. Truncate: Keep first 'rank' singular values
// 3. Reconstruct: M' = U[:, :rank] * Σ[:rank, :rank] * V^T[:rank, :]
```

The compression ratio is approximately `rank / min(height, width)`, allowing users to trade image quality for file size.

### Convolution Filters

Image filtering uses convolution operations with predefined kernels:

#### Blur Filter (3×3 Box Filter)

```
1/9  1/9  1/9
1/9  1/9  1/9
1/9  1/9  1/9
```

**Mathematical Operation**: Each output pixel is the average of its 3×3 neighborhood

#### Sharpen Filter (Laplacian Enhancement)

```
 0  -1   0
-1   5  -1
 0  -1   0
```

**Mathematical Operation**: Enhances edges by subtracting the Laplacian from the original

#### Edge Detection (Sobel-like)

```
-1  -1  -1
-1   8  -1
-1  -1  -1
```

**Mathematical Operation**: Highlights regions of high spatial frequency

#### Emboss Filter

```
-2  -1   0
-1   1   1
 0   1   2
```

**Mathematical Operation**: Creates a 3D relief effect by emphasizing directional changes

### Geometric Transformations

All geometric transformations use 4×4 homogeneous transformation matrices:

#### Combined Transformation Matrix

```
[ Sx * cosθ   Sy * (-sinθ)  Shx  Tx ]
[ Sx * sinθ   Sy * cosθ     Shy  Ty ]
[ 0           0             1    0  ]
[ 0           0             0    1  ]
```

Where:

- **Rotation**: Applied around image center using rotation matrix
- **Scaling**: Independent X/Y scaling with optional linking
- **Shearing**: Affine transformation for perspective effects
- **Translation**: Pixel-space translation converted to clip space

### Parallel Processing Implementation

The Go backend utilizes goroutines for parallel processing:

```go
// Matrix filling parallelization
for i := 0; i < numGoroutines; i++ {
    go func(startY, endY int) {
        for y := startY; y < endY; y++ {
            for x := 0; x < width; x++ {
                // Process pixel chunk
            }
        }
    }(startY, endY)
}
```

This approach maximizes CPU utilization by dividing image processing tasks across available cores.

## Getting Started

### Prerequisites

- **Node.js** (v18 or higher) - for React frontend development
- **Go** (1.21 or higher) - for WebAssembly compilation
- **Modern web browser** with WebAssembly support (Chrome 57+, Firefox 52+, Safari 11+, Edge 16+)
- **Git** - for cloning the repository

### Installation & Setup

1. **Clone the repository**:

```bash
git clone https://github.com/yamirghofran/tinyimg.git
cd tinyimg
```

2. **Install frontend dependencies**:

```bash
cd frontend
npm install
```

3. **Build the WebAssembly module**:

```bash
cd ../backend
./build.sh
```

4. **Start the development server**:

```bash
cd ../frontend
npm run dev
```

The application will be available at `http://localhost:5173`

### Development Workflow

#### Frontend Development

- **Hot reload**: Changes to React components automatically refresh in browser
- **TypeScript**: Full type checking and IntelliSense support
- **ESLint**: Code quality and style enforcement

#### Backend Development

- **Go modules**: Dependency management with `go.mod`
- **WebAssembly compilation**: Cross-compilation to WASM binary
- **Gonum integration**: Linear algebra operations via LAPACK

#### Building for Production

```bash
# Frontend production build
cd frontend
npm run build

# WebAssembly production build
cd ../backend
GOOS=js GOARCH=wasm go build -o ../frontend/public/main.wasm main.go
```

### Browser Compatibility

- **Chrome/Edge**: Full WebAssembly support with SharedArrayBuffer
- **Firefox**: WebAssembly support (may require configuration for SharedArrayBuffer)
- **Safari**: WebAssembly support (iOS 11+ and macOS 10.13+)

## Project Structure

```
tinyimg/
├── frontend/                          # React frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                    # Reusable UI components
│   │   │   │   ├── button.tsx         # Button component
│   │   │   │   ├── card.tsx           # Card container component
│   │   │   │   ├── slider.tsx         # Range slider component
│   │   │   │   ├── switch.tsx         # Toggle switch component
│   │   │   │   ├── tabs.tsx           # Tab navigation component
│   │   │   │   └── label.tsx          # Form label component
│   │   │   ├── WebGLCanvas.tsx        # WebGL rendering component
│   │   │   └── ...                    # Additional UI components
│   │   ├── lib/
│   │   │   └── utils.ts               # Utility functions
│   │   ├── App.tsx                    # Main application component
│   │   ├── index.css                  # Global styles
│   │   ├── main.tsx                   # Application entry point
│   │   └── vite-env.d.ts              # Vite type definitions
│   ├── public/                        # Static assets
│   │   ├── main.wasm                  # Compiled WebAssembly binary
│   │   ├── wasm_exec.js               # Go WebAssembly runtime
│   │   ├── vite.svg                   # Vite logo
│   │   └── og.png                     # OpenGraph image
│   ├── package.json                   # Frontend dependencies
│   ├── vite.config.ts                 # Vite configuration
│   ├── tsconfig.json                  # TypeScript configuration
│   ├── tailwind.config.js             # TailwindCSS configuration
│   └── components.json                # ShadcnUI configuration
└── backend/                           # Go WebAssembly backend
    ├── main.go                        # Core image processing logic
    │                                  # - WASM function registration
    │                                  # - Image filtering (convolution)
    │                                  # - SVD compression algorithm
    │                                  # - Parallel processing implementation
    ├── go.mod                         # Go module definition
    ├── go.sum                         # Dependency checksums
    └── build.sh                       # WebAssembly build script
                                   # - Compiles Go to WASM
                                   # - Copies runtime to public/
                                    # - Handles build optimization
```

## Technical Implementation Details

### WebAssembly Integration

The Go backend is compiled to WebAssembly using specific build constraints:

```go
//go:build js && wasm
// +build js,wasm

package main
```

Key WASM functions exposed to JavaScript:

- `applyFilter(imageData, filterType)` - Convolution filter application
- `compressSVD(imageData, rank)` - SVD-based compression

### Memory Management

- **Shared Memory**: Pixel data transferred between JavaScript and Go via SharedArrayBuffer
- **Type Conversion**: JavaScript `Uint8ClampedArray` ↔ Go `[]uint8` byte slices
- **Memory Safety**: Bounds checking and panic recovery in all goroutines

### Performance Optimizations

#### Parallel Processing Strategy

```go
// Dynamic goroutine allocation based on image dimensions
chunkSize := 64
numGoroutines := (height + chunkSize - 1) / chunkSize
```

#### Matrix Operations

- **Blocked algorithms**: Optimized for cache locality
- **LAPACK bindings**: Hardware-accelerated linear algebra via Gonum
- **Memory pooling**: Reuse of matrix objects to reduce allocations

#### WebGL Rendering

- **Texture streaming**: Direct GPU upload of processed pixel data
- **Shader optimization**: Minimal fragment shaders for maximum performance
- **Buffer management**: Efficient vertex buffer reuse

### Error Handling

- **JavaScript ↔ Go**: Error objects passed as `{error: string}` from Go to JavaScript
- **Panic recovery**: Goroutine panics captured and logged without crashing
- **Resource cleanup**: Proper WebGL context and texture management

### Browser Security

- **CORS handling**: Automatic cross-origin image loading
- **Content Security Policy**: Compatible with modern browser security models
- **Memory limits**: WebAssembly memory constrained to prevent abuse

## License

MIT
