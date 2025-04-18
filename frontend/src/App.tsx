import React, { useState, useEffect, useRef } from 'react'; // Removed ScriptHTMLAttributes, not needed
import { mat4, glMatrix } from 'gl-matrix';
import WebGLCanvas, { WebGLCanvasRef } from './components/WebGLCanvas';
import { Button } from "./components/ui/button";
import { Slider } from "./components/ui/slider";
import { Label } from "./components/ui/label";
import { Switch } from "./components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Github } from 'lucide-react'; // Import Github icon

// Declare Go types on window for TypeScript
declare global {
  interface Window {
    Go: any;
    applyFilter?: (imageData: { width: number; height: number; data: Uint8ClampedArray }, filterType: string) => Promise<Uint8ClampedArray | { error: string }>; // More specific type
    compressSVD?: (imageData: { width: number; height: number; data: Uint8ClampedArray }, rank: number) => Promise<Uint8ClampedArray | { error: string }>; // More specific type
  }
}

function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null); // Renamed from 'image' for clarity
  const [originalImageData, setOriginalImageData] = useState<{ data: Uint8ClampedArray; width: number; height: number } | null>(null); // State for original pixels
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);
  const [isScaleLinked, setIsScaleLinked] = useState(true);
  const [shearX, setShearX] = useState(0);
  const [shearY, setShearY] = useState(0);
  const [translationX, setTranslationX] = useState(0);
  const [translationY, setTranslationY] = useState(0);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
  const [transformMatrix, setTransformMatrix] = useState<mat4>(mat4.create());
  const [rotationMatrix, setRotationMatrix] = useState<mat4>(mat4.create());
  const [scaleMatrix, setScaleMatrix] = useState<mat4>(mat4.create());
  const [shearMatrixState, setShearMatrixState] = useState<mat4>(mat4.create()); // Renamed to avoid conflict
  const [translationMatrix, setTranslationMatrix] = useState<mat4>(mat4.create());
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const webGLCanvasRef = useRef<WebGLCanvasRef>(null);
  const goRef = useRef<any>(null);

  const [wasmLoading, setWasmLoading] = useState(true);
  const [wasmError, setWasmError] = useState<string | null>(null);
  const [svdRank, setSvdRank] = useState(50);
  const [transformedArea, setTransformedArea] = useState<number | null>(null); // State for transformed area

  // Function to get original pixel data from an image source
  const getPixelDataFromImageSrc = (src: string): Promise<{ data: Uint8ClampedArray; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error("Could not get 2D context"));
        }
        ctx.drawImage(img, 0, 0);
        try {
          const imageData = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
          resolve({ data: imageData.data, width: imageData.width, height: imageData.height });
        } catch (e) {
          // Handle potential SecurityError if image is tainted (e.g., CORS)
          reject(new Error(`Could not get image data: ${e}`));
        }
      };
      img.onerror = (err) => {
        reject(new Error(`Failed to load image for pixel extraction: ${err}`));
      };
      img.crossOrigin = "anonymous"; // Attempt to prevent tainting for CORS images/data URLs
      img.src = src;
    });
  };


  const processImageFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const newImageSrc = reader.result as string;
        try {
          // Get original pixel data *before* setting state
          const pixelData = await getPixelDataFromImageSrc(newImageSrc);

          setImageWidth(pixelData.width);
          setImageHeight(pixelData.height);
          setOriginalImageData(pixelData); // Store original data
          setImageSrc(newImageSrc); // Set the source for WebGLCanvas

          // Reset transforms
          setRotation(0);
          setScaleX(1);
          setScaleY(1);
          setIsScaleLinked(true);
          setShearX(0);
          setShearY(0);
          setTranslationX(0);
          setTranslationY(0);
          setFlipHorizontal(false);
          setFlipVertical(false);
          setSvdRank(Math.min(50, pixelData.width, pixelData.height)); // Reset SVD rank based on new image

        } catch (error) {
           console.error("Error processing image:", error);
           setWasmError(`Error processing image: ${error instanceof Error ? error.message : String(error)}`);
           // Clear potentially stale state
           setImageSrc(null);
           setOriginalImageData(null);
           setImageWidth(0);
           setImageHeight(0);
        }
      };
      reader.onerror = () => {
        console.error("FileReader error");
        setWasmError("Error reading file.");
      };
      reader.readAsDataURL(file);
    } else {
      console.error("Invalid file type. Please upload an image.");
      setWasmError("Invalid file type. Please upload an image.");
    }
  };


  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Drag and Drop Handlers (remain the same)
  const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // --- WASM Loading Effect (remains the same) ---
  useEffect(() => {
    if (!document.getElementById('wasm-exec-script')) {
      const script = document.createElement('script');
      script.id = 'wasm-exec-script';
      script.src = '/wasm_exec.js';
      script.async = true;
      script.onload = () => {
        console.log("wasm_exec.js loaded.");
        loadWasm();
      };
      script.onerror = () => {
        console.error("Failed to load wasm_exec.js");
        setWasmError("Failed to load wasm_exec.js");
        setWasmLoading(false);
      };
      document.body.appendChild(script);
    } else if (window.Go && !goRef.current) { // Check if Go exists but not instantiated yet
        loadWasm();
    } else if (goRef.current) {
        console.log("WASM already loaded or loading.");
        setWasmLoading(false); // Assume loaded if goRef exists
    }

    async function loadWasm() {
      if (!window.Go) {
        console.error("Go runtime not available");
        setWasmError("Go runtime not available");
        setWasmLoading(false);
        return;
      }
      if (goRef.current) {
        console.log("WASM already instantiated.");
        setWasmLoading(false);
        return;
      }

      try {
        console.log("Instantiating Go WASM...");
        setWasmLoading(true);
        setWasmError(null);
        const go = new window.Go();
        goRef.current = go;

        const wasmPath = '/main.wasm';
        const result = await WebAssembly.instantiateStreaming(fetch(wasmPath), go.importObject);

        console.log("WASM instantiation successful. Running module...");
        // Don't block, run in background
        Promise.resolve(go.run(result.instance)).catch(err => {
            // Catch errors from go.run if it rejects asynchronously
            console.error("Error during WASM execution:", err);
            setWasmError(`Error during WASM execution: ${err}`);
            setWasmLoading(false); // Ensure loading state is reset on error
        });

        // Check for functions shortly after run starts
        setTimeout(() => {
            if (typeof window.applyFilter !== 'function' || typeof window.compressSVD !== 'function') {
                console.warn("WASM functions not found shortly after run. Check Go registration.");
                // Optionally set an error or warning state here if functions are critical
            } else {
                console.log("WASM functions found on window.");
            }
            // Consider WASM 'ready' even if functions aren't immediately found,
            // as they might be registered slightly later. The handlers will check again.
            setWasmLoading(false);
        }, 100); // Adjust timeout if needed

      } catch (error) {
        console.error("Error loading or running WASM:", error);
        setWasmError(`Error loading WASM: ${error}`);
        setWasmLoading(false);
      }
    }
  }, []);


  // Handlers for linked scale (remain the same)
  const handleScaleXChange = (value: number) => {
    setScaleX(value);
    if (isScaleLinked) {
      setScaleY(value);
    }
  };

  const handleScaleYChange = (value: number) => {
    setScaleY(value);
    if (isScaleLinked) {
      setScaleX(value);
    }
  };

  const handleLinkScaleChange = (checked: boolean) => {
    setIsScaleLinked(checked);
    if (checked) {
      setScaleY(scaleX);
    }
  };


  // Calculate transformation matrices
  useEffect(() => {
    // --- Calculate individual matrices ---
    const rotMat = mat4.create();
    mat4.rotateZ(rotMat, rotMat, glMatrix.toRadian(-rotation));
    setRotationMatrix(rotMat);

    const scaleMat = mat4.create();
    const finalScaleX = scaleX * (flipHorizontal ? -1 : 1);
    const finalScaleY = scaleY * (flipVertical ? -1 : 1);
    mat4.scale(scaleMat, scaleMat, [finalScaleX, finalScaleY, 1]);
    setScaleMatrix(scaleMat);

    const shearMat = mat4.fromValues(
      1,    shearY, 0, 0, // Col 1
      shearX, 1,      0, 0, // Col 2
      0,    0,      1, 0, // Col 3
      0,    0,      0, 1  // Col 4
    );
    setShearMatrixState(shearMat); // Use the state setter

    const transMat = mat4.create();
    const containerWidth = canvasContainerRef.current?.clientWidth ?? imageWidth; // Use imageWidth as fallback
    const containerHeight = canvasContainerRef.current?.clientHeight ?? imageHeight; // Use imageHeight as fallback
    const tx = containerWidth > 0 ? (translationX / containerWidth) * 2 : 0;
    const ty = containerHeight > 0 ? (-translationY / containerHeight) * 2 : 0; // Y is inverted in clip space
    mat4.translate(transMat, transMat, [tx, ty, 0]);
    setTranslationMatrix(transMat);

    // --- Calculate combined matrix (Order: Scale -> Shear -> Rotate -> Translate) ---
    // Note: Matrix multiplication is read right-to-left for application order
    const combinedMatrix = mat4.create();
    mat4.multiply(combinedMatrix, transMat, rotMat); // T * R
    mat4.multiply(combinedMatrix, combinedMatrix, shearMat); // T * R * Sh
    mat4.multiply(combinedMatrix, combinedMatrix, scaleMat); // T * R * Sh * Sc
    setTransformMatrix(combinedMatrix);

    // Calculate and set transformed area
    const determinant = mat4.determinant(combinedMatrix);
    const area = 4 * Math.abs(determinant); // Original clip space area is 4 (-1 to 1)
    setTransformedArea(area);

  }, [rotation, scaleX, scaleY, shearX, shearY, translationX, translationY, flipHorizontal, flipVertical, imageWidth, imageHeight, isScaleLinked]); // Added isScaleLinked dependency back

  // Helper function to display a matrix with modern styling
  const MatrixDisplay = ({ matrix }: { matrix: mat4 }) => {
    const formatNumber = (n: number) => n.toFixed(3);
    // Flatten the matrix in column-major order as it's stored, then map to grid cells
    const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(index => (
      <div key={index} className="p-1 text-center border border-border/50 rounded-sm bg-muted/50 text-xs font-mono ">
        {formatNumber(matrix[index])}
      </div>
    ));

    return (
      <div className="grid grid-cols-4 gap-1 p-1 bg-muted/20 rounded">
        {/* Render cells row by row for visual layout */}
        {cells[0]} {cells[4]} {cells[8]} {cells[12]} {/* Row 1 */}
        {cells[1]} {cells[5]} {cells[9]} {cells[13]} {/* Row 2 */}
        {cells[2]} {cells[6]} {cells[10]} {cells[14]} {/* Row 3 */}
        {cells[3]} {cells[7]} {cells[11]} {cells[15]} {/* Row 4 */}
      </div>
    );
  };


  // Handle Download
  const handleDownload = () => {
    const canvasElement = webGLCanvasRef.current?.getCanvasElement();
    if (canvasElement && imageSrc) {
      const dataURL = canvasElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'transformed-image.png';
      link.href = dataURL;
      link.click();
    }
  };

  // --- Modified WASM Processing Handlers ---
  const handleApplyFilter = async (filterType: string) => {
    // Use originalImageData instead of reading from GL canvas
    if (wasmLoading || !originalImageData || !webGLCanvasRef.current || typeof window.applyFilter !== 'function') {
      console.warn("WASM not ready, original image data missing, canvas ref missing, or applyFilter function not available.");
      setWasmError("Cannot apply filter: prerequisites not met.");
      return;
    }

    const { data, width, height } = originalImageData;

    console.log(`Applying filter '${filterType}' via WASM to original data...`);
    setWasmLoading(true);
    setWasmError(null);

    try {
      // 1. Prepare data for Go (already have it)
      const imageDataForGo = { width, height, data };

      // 2. Call WASM function
      const result = await window.applyFilter(imageDataForGo, filterType);

      // 3. Handle result
      if (result && 'error' in result) { // Check for error object
        throw new Error(result.error);
      } else if (result instanceof Uint8ClampedArray) {
         console.log(`Filter '${filterType}' applied successfully. Updating texture.`);
         // 4. Update WebGL Texture with the processed data
         webGLCanvasRef.current.updateTexture(result, width, height);
      } else {
         throw new Error("Invalid data returned from WASM applyFilter function.");
      }

    } catch (error: any) {
      console.error(`Error applying filter '${filterType}':`, error);
      setWasmError(`Filter error: ${error.message || error}`);
    } finally {
      setWasmLoading(false);
    }
  };

  const handleApplySVD = async () => {
     // Use originalImageData instead of reading from GL canvas
     if (wasmLoading || !originalImageData || !webGLCanvasRef.current || typeof window.compressSVD !== 'function') {
       console.warn("WASM not ready, original image data missing, canvas ref missing, or compressSVD function not available.");
       setWasmError("Cannot apply SVD: prerequisites not met.");
       return;
     }

     const { data, width, height } = originalImageData;

     // Ensure rank is valid
     const validRank = Math.max(1, Math.min(svdRank, width, height));
     if (validRank !== svdRank) {
        console.warn(`Adjusting SVD rank from ${svdRank} to ${validRank} based on image dimensions.`);
        setSvdRank(validRank); // Update state for consistency
     }


     console.log(`Applying SVD compression (rank ${validRank}) via WASM to original data...`);
     setWasmLoading(true);
     setWasmError(null);

     try {
       // 1. Prepare data for Go (already have it)
       const imageDataForGo = { width, height, data };

       // 2. Call WASM function
       const result = await window.compressSVD(imageDataForGo, validRank);

       // 3. Handle result
       if (result && 'error' in result) { // Check for error object
         throw new Error(result.error);
       } else if (result instanceof Uint8ClampedArray) {
          console.log(`SVD (rank ${validRank}) applied successfully. Updating texture.`);
          // 4. Update WebGL Texture with the processed data
          webGLCanvasRef.current.updateTexture(result, width, height);
       } else {
          throw new Error("Invalid data returned from WASM compressSVD function.");
       }

     } catch (error: any) {
       console.error(`Error applying SVD:`, error);
       setWasmError(`SVD error: ${error.message || error}`);
     } finally {
       setWasmLoading(false);
     }
  };


  // --- JSX Structure (mostly the same, update image check) ---
  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-72 border-r border-border p-4 flex flex-col">
        <Card className="flex-grow flex flex-col">
          <CardHeader>
            <CardTitle>Image Transforms</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-6 overflow-y-auto"> {/* Added overflow-y-auto */}
            {/* Rotation Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="rotation-slider">Rotation</Label>
                <span className="text-sm text-muted-foreground">{rotation}°</span>
              </div>
              <Slider id="rotation-slider" min={-360} max={360} step={1} value={[rotation]} onValueChange={(v) => setRotation(v[0])} disabled={!imageSrc} />
            </div>

            {/* Scale Controls */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch id="link-scale-switch" checked={isScaleLinked} onCheckedChange={handleLinkScaleChange} disabled={!imageSrc} />
                <Label htmlFor="link-scale-switch">Link Scale X/Y</Label>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="scale-x-slider">Scale X</Label>
                  <span className="text-sm text-muted-foreground">{scaleX.toFixed(2)}x</span>
                </div>
                <Slider id="scale-x-slider" min={0.1} max={3} step={0.05} value={[scaleX]} onValueChange={(v) => handleScaleXChange(v[0])} disabled={!imageSrc} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="scale-y-slider">Scale Y</Label>
                  <span className="text-sm text-muted-foreground">{scaleY.toFixed(2)}x</span>
                </div>
                <Slider id="scale-y-slider" min={0.1} max={3} step={0.05} value={[scaleY]} onValueChange={(v) => handleScaleYChange(v[0])} disabled={!imageSrc || isScaleLinked} />
              </div>
            </div>

             {/* Shear Sliders */}
             <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="shear-x-slider">Shear X</Label>
                    <span className="text-sm text-muted-foreground">{shearX.toFixed(2)}</span>
                  </div>
                  <Slider id="shear-x-slider" min={-1} max={1} step={0.01} value={[shearX]} onValueChange={(v) => setShearX(v[0])} disabled={!imageSrc} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="shear-y-slider">Shear Y</Label>
                    <span className="text-sm text-muted-foreground">{shearY.toFixed(2)}</span>
                  </div>
                  <Slider id="shear-y-slider" min={-1} max={1} step={0.01} value={[shearY]} onValueChange={(v) => setShearY(v[0])} disabled={!imageSrc} />
                </div>
              </div>

            {/* Translate Sliders */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="translate-x-slider">Translate X</Label>
                <span className="text-sm text-muted-foreground">{translationX} px</span>
              </div>
              <Slider id="translate-x-slider" min={-500} max={500} step={1} value={[translationX]} onValueChange={(v) => setTranslationX(v[0])} disabled={!imageSrc} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="translate-y-slider">Translate Y</Label>
                <span className="text-sm text-muted-foreground">{translationY} px</span>
              </div>
              <Slider id="translate-y-slider" min={-500} max={500} step={1} value={[translationY]} onValueChange={(v) => setTranslationY(v[0])} disabled={!imageSrc} />
            </div>

            {/* Flip Buttons */}
            <div className="space-y-2 pt-4">
              <Button variant="outline" onClick={() => setFlipHorizontal(prev => !prev)} className="w-full" disabled={!imageSrc}>
                Flip Horizontal {flipHorizontal ? '(On)' : '(Off)'}
              </Button>
              <Button variant="outline" onClick={() => setFlipVertical(prev => !prev)} className="w-full" disabled={!imageSrc}>
                Flip Vertical {flipVertical ? '(On)' : '(Off)'}
              </Button>
            </div>
          </CardContent>
          {/* Download Button moved to right sidebar */}
        </Card>
        {/* GitHub Link Button */}
        <div className="mt-auto pt-4"> {/* Pushes the button to the bottom */}
          <a
            href="https://github.com/yamirghofran/TinyIMG" // Replace with your actual GitHub repo URL
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center px-3 py-2 border border-border text-sm font-medium rounded-md text-foreground bg-secondary hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
          >
            <Github className="w-4 h-4 mr-2" />
            View on Github
          </a>
        </div>
      </aside>

      {/* Main content area */}
      <main
        ref={canvasContainerRef}
        className="flex-1 p-6 flex flex-col items-center justify-center overflow-hidden"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* File Input */}
        {!imageSrc && (
          <div className="mb-4 w-full max-w-md flex justify-center">
            <input type="file" accept="image/*" onChange={handleImageUpload} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" />
          </div>
        )}

        {/* Canvas Container */}
        <div className={`w-full h-full flex items-center justify-center relative border rounded-lg ${isDraggingOver ? 'border-primary border-dashed border-2' : 'border-border'} bg-muted/40 overflow-hidden`}>
          {imageSrc ? (
            <WebGLCanvas
              ref={webGLCanvasRef}
              imageSrc={imageSrc} // Use imageSrc state
              transformMatrix={transformMatrix}
              preserveDrawingBuffer={true}
              // Use container dimensions for canvas sizing
              width={canvasContainerRef.current?.clientWidth ?? 800}
              height={canvasContainerRef.current?.clientHeight ?? 600}
            />
          ) : (
            <div className="text-muted-foreground text-center p-4">
              {isDraggingOver ? "Drop image here" : "Drag & drop an image here, or use the button above"}
            </div>
          )}
        </div>
      </main>

      {/* Right Sidebar */}
      <aside className="w-72 border-l border-border p-4 flex flex-col">
        <Card className="flex-grow flex flex-col">
          <CardHeader>
            <CardTitle>Processing & Export</CardTitle> {/* Changed title */}
          </CardHeader>
          <CardContent className="flex-1 space-y-6 overflow-y-auto">
            {/* WASM Filters */}
            <div className="space-y-2 border-border">
              <Label className="text-sm font-medium">Filters</Label>
              <div className="grid grid-cols-2 gap-2">
                {['blur', 'sharpen', 'edge', 'emboss'].map(filter => (
                  <Button key={filter} variant="outline" size="sm" onClick={() => handleApplyFilter(filter)} disabled={wasmLoading || !imageSrc}>
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Button>
                ))}
              </div>
              {wasmLoading && <p className="text-xs text-muted-foreground">Processing...</p>}
              {wasmError && <p className="text-xs text-destructive">{wasmError}</p>}
            </div>

            {/* WASM SVD Compression */}
            <div className="space-y-4 pt-4 border-t border-border">
               <Label className="text-sm font-medium">SVD Compression</Label>
               <div className="space-y-2">
                 <div className="flex justify-between items-center">
                   <Label htmlFor="svd-rank-slider-right">Rank</Label> {/* Ensure unique ID if needed */}
                   <span className="text-sm text-muted-foreground">{svdRank}</span>
                 </div>
                 <Slider
                   id="svd-rank-slider-right" // Ensure unique ID if needed
                   min={1}
                   max={Math.max(1, Math.min(imageWidth, imageHeight, 100))}
                   step={1}
                   value={[svdRank]}
                   onValueChange={(value) => setSvdRank(value[0])}
                   disabled={wasmLoading || !imageSrc || imageWidth === 0 || imageHeight === 0}
                 />
               </div>
               <Button onClick={handleApplySVD} className="w-full" disabled={wasmLoading || !imageSrc}>
                 Apply SVD
               </Button>
            </div>

            {/* Transformed Area Display */}
            {imageSrc && transformedArea !== null && (
              <div className="pb-4 mb-4"> {/* Add padding and bottom border for separation */}
                <Label className="text-sm font-medium mb-1 block">Transformed Area</Label>
                {/* Display the area, formatted to a few decimal places */}
                <p className="text-lg font-semibold text-center">{transformedArea.toFixed(4)}</p>
                {/* Add context about the calculation */}
                <p className="text-xs text-muted-foreground text-center">Formula: Area = 4 × |det(M)|</p>
              </div>
            )}

            {/* Transformation Matrices Display */}
           <div className="pt-4 border-t border-border">
             <Label className="text-sm font-medium mb-2 block">Transformation Matrices</Label>
             <Tabs defaultValue="overall" className="w-full">
               <TabsList className="grid w-full grid-cols-3 mb-2 h-auto flex-wrap"> {/* Adjusted grid/wrap */}
                 <TabsTrigger value="overall" className="text-xs px-2 py-1">Overall</TabsTrigger>
                 <TabsTrigger value="translate" className="text-xs px-2 py-1">Translate</TabsTrigger>
                 <TabsTrigger value="rotate" className="text-xs px-2 py-1">Rotate</TabsTrigger>
                 <TabsTrigger value="scale" className="text-xs px-2 py-1">Scale</TabsTrigger>
                 <TabsTrigger value="shear" className="text-xs px-2 py-1">Shear</TabsTrigger>
               </TabsList>
               <TabsContent value="overall">
                 <MatrixDisplay matrix={transformMatrix} />
               </TabsContent>
               <TabsContent value="translate">
                 <MatrixDisplay matrix={translationMatrix} />
               </TabsContent>
               <TabsContent value="rotate">
                 <MatrixDisplay matrix={rotationMatrix} />
               </TabsContent>
               <TabsContent value="scale">
                 <MatrixDisplay matrix={scaleMatrix} />
               </TabsContent>
               <TabsContent value="shear">
                 <MatrixDisplay matrix={shearMatrixState} />
               </TabsContent>
             </Tabs>
           </div>
          </CardContent>
          {/* Download Button */}
          <div className="p-4 border-t border-border">
            <Button onClick={handleDownload} className="w-full" disabled={!imageSrc}>
              Download Image
            </Button>
          </div>

        </Card>
      </aside>
    </div>
  )
}

export default App
