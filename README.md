# TinyImg - Image Manipulation with WebAssembly

TinyImg is a web-based image manipulation application that leverages WebAssembly for high-performance image transformations. The application allows users to upload images, apply various transformations using matrix operations, and download the compressed results.

## Features

- **Image Upload**: Drag and drop or select images from your device
- **Real-time Transformations**: Apply and preview transformations instantly
- **Matrix-based Operations**:
  - Rotation (any angle)
  - Scaling (resize by percentage)
  - Flipping (horizontal/vertical mirroring)
  - Warping (perspective shifts)
- **Compression Options**:
  - Adjustable quality level
  - Multiple output formats (JPEG, PNG, WebP)
- **High Performance**: C code compiled to WebAssembly for efficient processing

## Technology Stack

- **Frontend**: React.js with React Router
- **Backend Logic**: C programming language compiled to WebAssembly (WASM)
- **Image Rendering**: HTML5 Canvas
- **Math Operations**: Linear algebra matrix transformations

## Project Structure

```
tinyimg/
├── app/                    # React frontend
│   ├── components/         # React components
│   ├── styles/             # CSS styles
│   └── wasm/               # WebAssembly loader
├── c_src/                  # C source code
│   ├── include/            # Header files
│   └── src/                # Implementation files
├── public/                 # Static assets
│   └── wasm/               # Compiled WebAssembly files
└── README.md               # Project documentation
```

## Setup and Installation

### Prerequisites

- Node.js (v14 or later)
- Emscripten (for compiling C to WebAssembly)

### Building the WebAssembly Module

1. Install Emscripten following the [official instructions](https://emscripten.org/docs/getting_started/downloads.html)
2. Navigate to the `c_src` directory
3. Run the build command:

```bash
cd c_src
make
```

This will compile the C code to WebAssembly and place the output in the `public/wasm` directory.

### Running the Frontend

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## Mathematical Background

The image transformations are based on matrix operations:

### Rotation Matrix

```
R(θ) = [
  cos(θ)  -sin(θ)  0
  sin(θ)   cos(θ)  0
  0        0       1
]
```

### Scaling Matrix

```
S = [
  sx  0   0
  0   sy  0
  0   0   1
]
```

### Flipping Matrix

Horizontal flip:
```
[
  -1  0   0
  0   1   0
  0   0   1
]
```

Vertical flip:
```
[
  1   0   0
  0   -1  0
  0   0   1
]
```

### Warp/Shear Matrix

```
W = [
  1   kx  0
  ky  1   0
  0   0   1
]
```

## License

MIT

## Acknowledgments

- The mathematical formulations for image transformations are based on standard linear algebra techniques
- WebAssembly compilation is handled by Emscripten
