import React, { useCallback } from "react";
import { ImageUploader } from "../components/ImageUploader";
import { CanvasWorkspace } from "../components/CanvasWorkspace";
import { TransformationControls } from "../components/TransformationControls";
import { DownloadOptions } from "../components/DownloadOptions";
import "../styles/home.css";

export default function Home() {
  const [imageData, setImageData] = React.useState<ImageData | null>(null);
  const [transformMatrix, setTransformMatrix] = React.useState<number[][]>([
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ]);
  const [originalDimensions, setOriginalDimensions] = React.useState({ width: 0, height: 0 });
  const [imageFormat, setImageFormat] = React.useState("");
  const [transformedImageData, setTransformedImageData] = React.useState<ImageData | null>(null);
  const [compressionLevel, setCompressionLevel] = React.useState(100);
  const [outputFormat, setOutputFormat] = React.useState("image/jpeg");

  const handleImageUpload = useCallback((data: ImageData, format: string) => {
    setImageData(data);
    setOriginalDimensions({ width: data.width, height: data.height });
    setImageFormat(format);
    // Reset transformations when a new image is uploaded
    setTransformMatrix([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ]);
  }, []);

  const handleTransformationChange = useCallback((newMatrix: number[][]) => {
    setTransformMatrix(newMatrix);
  }, []);

  const handleTransformedImageUpdate = useCallback((data: ImageData) => {
    setTransformedImageData(data);
  }, []);

  return (
    <div className="home-container">
      <header className="app-header">
        <h1>TinyImg - Image Editor</h1>
      </header>
      
      <main className="app-content">
        <div className="left-panel">
          {!imageData ? (
            <ImageUploader onImageUpload={handleImageUpload} />
          ) : (
            <div className="image-info">
              <h3>Image Information</h3>
              <p>Dimensions: {originalDimensions.width} x {originalDimensions.height}</p>
              <p>Format: {imageFormat}</p>
              <button 
                className="reset-button"
                onClick={() => setImageData(null)}
              >
                Upload New Image
              </button>
            </div>
          )}
          
          {imageData && (
            <TransformationControls 
              onTransformationChange={handleTransformationChange}
              transformMatrix={transformMatrix}
            />
          )}
        </div>
        
        <div className="center-panel">
          {imageData ? (
            <CanvasWorkspace 
              imageData={imageData}
              transformMatrix={transformMatrix}
              onTransformedImageUpdate={handleTransformedImageUpdate}
            />
          ) : (
            <div className="empty-workspace">
              <p>Upload an image to get started</p>
            </div>
          )}
        </div>
        
        <div className="right-panel">
          {transformedImageData && (
            <DownloadOptions 
              transformedImageData={transformedImageData}
              compressionLevel={compressionLevel}
              setCompressionLevel={setCompressionLevel}
              outputFormat={outputFormat}
              setOutputFormat={setOutputFormat}
            />
          )}
        </div>
      </main>
      
      <footer className="app-footer">
        <p>TinyImg - Image Manipulation with WebAssembly</p>
      </footer>
    </div>
  );
}
