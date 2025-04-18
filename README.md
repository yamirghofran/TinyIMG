# TinyIMG

A high-performance image processing application built with WebAssembly and React.

## Features

- Image filtering and processing
- SVD-based image compression
- Real-time image manipulation
- Parallel processing capabilities

## Tech Stack

### Frontend
- React 19
- TypeScript
- Vite
- TailwindCSS
- ShadcnUI Components
- GL Matrix for graphics operations

### Backend
- Go (WebAssembly)
- Gonum for numerical computing (SVD and filters)
- WebAssembly for high-performance image processing

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- Go 1.21 or higher
- Modern web browser with WebAssembly support

### Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/tinyimg.git
cd tinyimg
```

2. Start the frontend development server:
```bash
cd frontend
npm install
npm run dev
```

3. Build the WebAssembly module:
```bash
cd backend
./build.sh
```

The application will be available at `http://localhost:5173`

## Project Structure

```
tinyimg/
├── frontend/           # React frontend application
│   ├── src/           # Source code
│   ├── public/        # Static assets
│   └── package.json   # Frontend dependencies
└── backend/           # Go WebAssembly backend
    ├── main.go        # Core image processing logic
    └── build.sh       # Build script
```

## License

MIT
