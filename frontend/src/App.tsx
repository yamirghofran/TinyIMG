import { useState, useEffect, useRef, ScriptHTMLAttributes } from 'react'; // Added ScriptHTMLAttributes
import { mat4, glMatrix } from 'gl-matrix';
import WebGLCanvas, { WebGLCanvasRef } from './components/WebGLCanvas'; // Import WebGLCanvasRef
import { Button } from "./components/ui/button";
import { Slider } from "./components/ui/slider";
import { Label } from "./components/ui/label";
import { Switch } from "./components/ui/switch"; // Import Shadcn Switch
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";

// Declare Go types on window for TypeScript
declare global {
  interface Window {
    Go: any; // Type for the Go WASM loader class
    applyFilter?: (imageData: any, filterType: string) => Promise<any>; // Define potential functions
    compressSVD?: (imageData: any, rank: number) => Promise<any>;
  }
}

function App() {
  const [image, setImage] = useState<string | null>(null);
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  const [rotation, setRotation] = useState(0);
  // Scale state
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);
  const [isScaleLinked, setIsScaleLinked] = useState(true);
  // Shear state
  const [shearX, setShearX] = useState(0);
  const [shearY, setShearY] = useState(0);
  // Translation state
  const [translationX, setTranslationX] = useState(0);
  const [translationY, setTranslationY] = useState(0);
  // Flip state
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false); // State for vertical flip
  const [transformMatrix, setTransformMatrix] = useState<mat4>(mat4.create());
  const [isDraggingOver, setIsDraggingOver] = useState(false); // State for drag-over visual feedback
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const webGLCanvasRef = useRef<WebGLCanvasRef>(null); // Update ref type to use the exposed handle
  const goRef = useRef<any>(null); // Ref to store the Go instance

  // WASM Loading State
  const [wasmLoading, setWasmLoading] = useState(true);
  const [wasmError, setWasmError] = useState<string | null>(null);
  // SVD State
  const [svdRank, setSvdRank] = useState(50); // Default rank for SVD

  const processImageFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          setImageWidth(img.naturalWidth);
          setImageHeight(img.naturalHeight);
          // Reset transforms when a new image is loaded
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
          setImage(reader.result as string);
        }
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      console.error("Invalid file type. Please upload an image.");
      // Optionally show an error message to the user
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault(); // Necessary to allow dropping
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

  // --- WASM Loading Effect ---
  useEffect(() => {
    // Ensure wasm_exec.js is loaded only once
    if (!document.getElementById('wasm-exec-script')) {
      const script = document.createElement('script');
      script.id = 'wasm-exec-script';
      script.src = '/wasm_exec.js'; // Assumes it's in the public folder
      script.async = true;
      script.onload = () => {
        console.log("wasm_exec.js loaded.");
        loadWasm(); // Load WASM after the script is ready
      };
      script.onerror = () => {
        console.error("Failed to load wasm_exec.js");
        setWasmError("Failed to load wasm_exec.js");
        setWasmLoading(false);
      };
      document.body.appendChild(script);
    } else if (window.Go) {
      // If script is already there and Go is available, try loading WASM
      loadWasm();
    } else {
      // Script tag exists but Go object not ready, wait for its onload (should have triggered above)
      console.warn("wasm_exec.js script tag found, but Go object not ready yet.");
      // Set a timeout as a fallback? Or rely on the onload above.
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
        setWasmLoading(false); // Already loaded
        return;
      }

      try {
        console.log("Instantiating Go WASM...");
        setWasmLoading(true);
        setWasmError(null);
        const go = new window.Go();
        goRef.current = go; // Store the instance

        const wasmPath = '/main.wasm'; // Assumes it's in the public folder
        const result = await WebAssembly.instantiateStreaming(fetch(wasmPath), go.importObject);

        console.log("WASM instantiation successful. Running module...");
        // Don't await go.run, as it blocks until the WASM exits (which it shouldn't)
        go.run(result.instance);
        console.log("Go WASM module finished running setup (main function returned or select{} started).");
        // Note: Go functions (applyFilter, compressSVD) are now globally available if registered correctly in Go main.

        // Check if functions are registered (optional sanity check)
        if (typeof window.applyFilter !== 'function' || typeof window.compressSVD !== 'function') {
           console.warn("WASM functions (applyFilter, compressSVD) not found on window after run. Check Go registration.");
           // Don't set error yet, maybe they appear slightly later?
        } else {
           console.log("WASM functions found on window.");
        }

        setWasmLoading(false);
      } catch (error) {
        console.error("Error loading or running WASM:", error);
        setWasmError(`Error loading WASM: ${error}`);
        setWasmLoading(false);
      }
    }

    // Cleanup function if needed (e.g., terminate worker if used)
    // return () => { ... };

  }, []); // Empty dependency array ensures this runs only once on mount

  // Handlers for linked scale
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
      // When linking, sync Y to X
      setScaleY(scaleX);
    }
  };


  // Calculate transformation matrix
  useEffect(() => {
    const matrix = mat4.create(); // Start with identity

    // Calculate translation in clip space (-1 to 1)
    // This needs the canvas dimensions. Let's use the container dimensions for now.
    // A more robust approach might involve passing canvas dimensions back from WebGLCanvas
    // or calculating based on image aspect ratio within the container.
    const containerWidth = canvasContainerRef.current?.clientWidth ?? imageWidth; // Fallback to image width
    const containerHeight = canvasContainerRef.current?.clientHeight ?? imageHeight; // Fallback to image height

    // Avoid division by zero if container/image dimensions are not yet available
    const tx = containerWidth > 0 ? (translationX / containerWidth) * 2 : 0;
    const ty = containerHeight > 0 ? (-translationY / containerHeight) * 2 : 0; // Y is inverted in clip space

    // Order: Flip -> Scale -> Shear -> Rotate -> Translate
    // Note: Transformations are applied in reverse order of multiplication

    // 1. Translate
    mat4.translate(matrix, matrix, [tx, ty, 0]);

    // 2. Rotate
    // Negate rotation angle for clockwise rotation with positive values
    mat4.rotateZ(matrix, matrix, glMatrix.toRadian(-rotation));

    // 3. Shear
    // Shear matrix (column-major for WebGL):
    // [ 1  sx  0  0 ]
    // [ sy  1  0  0 ]
    // [ 0   0  1  0 ]
    // [ 0   0  0  1 ]
    // gl-matrix mat4 is column-major: [m00, m10, m20, m30, m01, m11, m21, m31, ...]
    const shearMatrix = mat4.fromValues(
      1,    shearY, 0, 0, // Column 1
      shearX, 1,      0, 0, // Column 2
      0,    0,      1, 0, // Column 3
      0,    0,      0, 1  // Column 4
    );
    mat4.multiply(matrix, matrix, shearMatrix);

    // 4. Scale (incorporating flips)
    const finalScaleX = scaleX * (flipHorizontal ? -1 : 1);
    const finalScaleY = scaleY * (flipVertical ? -1 : 1);
    mat4.scale(matrix, matrix, [finalScaleX, finalScaleY, 1]);

    setTransformMatrix(matrix);

  }, [rotation, scaleX, scaleY, shearX, shearY, translationX, translationY, flipHorizontal, flipVertical, imageWidth, imageHeight, isScaleLinked /* Add isScaleLinked though it doesn't directly affect matrix */]);

  const handleDownload = () => {
    // Get the actual canvas element using the method exposed via the ref
    const canvasElement = webGLCanvasRef.current?.getCanvasElement();
    if (canvasElement && image) {
      // With preserveDrawingBuffer: true, the canvas content should be available
      const dataURL = canvasElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'transformed-image.png';
      link.href = dataURL;
      link.click();
    }
  };

  // --- WASM Processing Handlers ---
  const handleApplyFilter = async (filterType: string) => {
    if (wasmLoading || !image || !webGLCanvasRef.current || typeof window.applyFilter !== 'function') {
      console.warn("WASM not ready, no image, canvas ref missing, or applyFilter function not available.");
      return;
    }

    const gl = webGLCanvasRef.current.getGL();
    const canvasElement = webGLCanvasRef.current.getCanvasElement();
    if (!gl || !canvasElement) {
      console.error("WebGL context or canvas element not available.");
      return;
    }

    const width = canvasElement.width;
    const height = canvasElement.height;

    console.log(`Applying filter '${filterType}' via WASM...`);
    setWasmLoading(true); // Indicate processing
    setWasmError(null);

    try {
      // 1. Read pixels from WebGL canvas
      const pixelData = new Uint8Array(width * height * 4);
      // Bind the framebuffer (might be needed depending on setup, often default is fine)
      // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);
      console.log(`Read ${pixelData.length} bytes from canvas.`);

      // 2. Prepare data for Go
      // Need to pass Uint8ClampedArray to Go function as per its expectation
      const imageDataForGo = {
        width: width,
        height: height,
        // Create Uint8ClampedArray view on the same buffer
        data: new Uint8ClampedArray(pixelData.buffer)
      };

      // 3. Call WASM function
      // The Go wrapper returns the result directly (or an error object)
      const result = await window.applyFilter(imageDataForGo, filterType);

      // 4. Handle result
      if (result && result.error) {
        throw new Error(result.error);
      } else if (result instanceof Uint8ClampedArray) {
         console.log(`Filter '${filterType}' applied successfully. Updating texture.`);
         // 5. Update WebGL Texture
         webGLCanvasRef.current.updateTexture(result, width, height);
      } else {
         // Attempt to check if it's a JS object representing the error
         if (typeof result === 'object' && result !== null && 'error' in result) {
            throw new Error(result.error);
         }
         throw new Error("Invalid data returned from WASM applyFilter function.");
      }

    } catch (error: any) {
      console.error(`Error applying filter '${filterType}':`, error);
      setWasmError(`Filter error: ${error.message || error}`);
    } finally {
      setWasmLoading(false); // Finish processing
    }
  };

  const handleApplySVD = async () => {
     if (wasmLoading || !image || !webGLCanvasRef.current || typeof window.compressSVD !== 'function') {
       console.warn("WASM not ready, no image, canvas ref missing, or compressSVD function not available.");
       return;
     }

     const gl = webGLCanvasRef.current.getGL();
     const canvasElement = webGLCanvasRef.current.getCanvasElement();
     if (!gl || !canvasElement) {
       console.error("WebGL context or canvas element not available.");
       return;
     }

     const width = canvasElement.width;
     const height = canvasElement.height;

     console.log(`Applying SVD compression (rank ${svdRank}) via WASM...`);
     setWasmLoading(true); // Indicate processing
     setWasmError(null);

     try {
       // 1. Read pixels
       const pixelData = new Uint8Array(width * height * 4);
       gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);
       console.log(`Read ${pixelData.length} bytes from canvas.`);

       // 2. Prepare data for Go
       const imageDataForGo = {
         width: width,
         height: height,
         data: new Uint8ClampedArray(pixelData.buffer)
       };

       // 3. Call WASM function
       const result = await window.compressSVD(imageDataForGo, svdRank);

       // 4. Handle result
       if (result && result.error) {
         throw new Error(result.error);
       } else if (result instanceof Uint8ClampedArray) {
          console.log(`SVD (rank ${svdRank}) applied successfully. Updating texture.`);
          // 5. Update WebGL Texture
          webGLCanvasRef.current.updateTexture(result, width, height);
       } else {
          // Attempt to check if it's a JS object representing the error
          if (typeof result === 'object' && result !== null && 'error' in result) {
             throw new Error(result.error);
          }
          throw new Error("Invalid data returned from WASM compressSVD function.");
       }

     } catch (error: any) {
       console.error(`Error applying SVD:`, error);
       setWasmError(`SVD error: ${error.message || error}`);
     } finally {
       setWasmLoading(false); // Finish processing
     }
  };


  return (
    // Use background/foreground from theme
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar using Card component */}
      <aside className="w-72 border-r border-border p-4 flex flex-col">
        <Card className="flex-grow flex flex-col">
          <CardHeader>
            <CardTitle>Image Transforms</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-6">
            {/* Rotation Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="rotation-slider">Rotation</Label>
                <span className="text-sm text-muted-foreground">{rotation}°</span>
              </div>
              <Slider
                id="rotation-slider"
                min={-360}
                max={360}
                step={1}
                value={[rotation]}
                onValueChange={(value) => setRotation(value[0])}
              />
            </div>

            {/* Scale Controls */}
            <div className="space-y-4">
              {/* Link Scale Switch */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="link-scale-switch"
                  checked={isScaleLinked}
                  onCheckedChange={handleLinkScaleChange}
                />
                <Label htmlFor="link-scale-switch">Link Scale X/Y</Label>
              </div>
              {/* Scale X Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="scale-x-slider">Scale X</Label>
                  <span className="text-sm text-muted-foreground">{scaleX.toFixed(2)}x</span>
                </div>
                <Slider
                  id="scale-x-slider"
                  min={0.1}
                  max={3}
                  step={0.05}
                  value={[scaleX]}
                  onValueChange={(value) => handleScaleXChange(value[0])}
                />
              </div>
              {/* Scale Y Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="scale-y-slider">Scale Y</Label>
                  <span className="text-sm text-muted-foreground">{scaleY.toFixed(2)}x</span>
                </div>
                <Slider
                  id="scale-y-slider"
                  min={0.1}
                  max={3}
                  step={0.05}
                  value={[scaleY]}
                  onValueChange={(value) => handleScaleYChange(value[0])}
                  disabled={isScaleLinked} // Disable if linked
                />
              </div>
            </div>

             {/* Shear Sliders */}
             <div className="space-y-4">
                {/* Shear X Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="shear-x-slider">Shear X</Label>
                    <span className="text-sm text-muted-foreground">{shearX.toFixed(2)}</span>
                  </div>
                  <Slider
                    id="shear-x-slider"
                    min={-1}
                    max={1}
                    step={0.01}
                    value={[shearX]}
                    onValueChange={(value) => setShearX(value[0])}
                  />
                </div>
                {/* Shear Y Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="shear-y-slider">Shear Y</Label>
                    <span className="text-sm text-muted-foreground">{shearY.toFixed(2)}</span>
                  </div>
                  <Slider
                    id="shear-y-slider"
                    min={-1}
                    max={1}
                    step={0.01}
                    value={[shearY]}
                    onValueChange={(value) => setShearY(value[0])}
                  />
                </div>
              </div>


            {/* Translate X Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="translate-x-slider">Translate X</Label>
                <span className="text-sm text-muted-foreground">{translationX} px</span>
              </div>
              <Slider
                id="translate-x-slider"
                min={-500}
                max={500}
                step={1}
                value={[translationX]}
                onValueChange={(value) => setTranslationX(value[0])}
              />
            </div>

            {/* Translate Y Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="translate-y-slider">Translate Y</Label>
                <span className="text-sm text-muted-foreground">{translationY} px</span>
              </div>
              <Slider
                id="translate-y-slider"
                min={-500}
                max={500}
                step={1}
                value={[translationY]}
                onValueChange={(value) => setTranslationY(value[0])}
              />
            </div>

            {/* Flip Buttons */}
            <div className="space-y-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setFlipHorizontal(prev => !prev)}
                className="w-full"
              >
                Flip Horizontal {flipHorizontal ? '(On)' : '(Off)'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setFlipVertical(prev => !prev)}
                className="w-full"
              >
                Flip Vertical {flipVertical ? '(On)' : '(Off)'}
              </Button>
            </div>

            {/* --- WASM Filters --- */}
            <div className="space-y-2 pt-4 border-t border-border">
              <Label className="text-sm font-medium">Filters</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => handleApplyFilter('blur')} disabled={wasmLoading || !image}>Blur</Button>
                <Button variant="outline" size="sm" onClick={() => handleApplyFilter('sharpen')} disabled={wasmLoading || !image}>Sharpen</Button>
                <Button variant="outline" size="sm" onClick={() => handleApplyFilter('edge')} disabled={wasmLoading || !image}>Edge</Button>
                <Button variant="outline" size="sm" onClick={() => handleApplyFilter('emboss')} disabled={wasmLoading || !image}>Emboss</Button>
              </div>
              {wasmLoading && <p className="text-xs text-muted-foreground">WASM Loading...</p>}
              {wasmError && <p className="text-xs text-destructive">{wasmError}</p>}
            </div>

            {/* --- WASM SVD Compression --- */}
            <div className="space-y-4 pt-4 border-t border-border">
               <Label className="text-sm font-medium">SVD Compression</Label>
               <div className="space-y-2">
                 <div className="flex justify-between items-center">
                   <Label htmlFor="svd-rank-slider">Rank</Label>
                   <span className="text-sm text-muted-foreground">{svdRank}</span>
                 </div>
                 <Slider
                   id="svd-rank-slider"
                   min={1}
                   max={Math.min(imageWidth, imageHeight, 100)} // Limit max rank reasonably
                   step={1}
                   value={[svdRank]}
                   onValueChange={(value) => setSvdRank(value[0])}
                   disabled={wasmLoading || !image || imageWidth === 0 || imageHeight === 0}
                 />
               </div>
               <Button onClick={handleApplySVD} className="w-full" disabled={wasmLoading || !image}>
                 Apply SVD
               </Button>
            </div>


          </CardContent>
          {/* Download Button at the bottom */}
          <div className="p-4 border-t border-border">
            <Button onClick={handleDownload} className="w-full">
              Download Image
            </Button>
          </div>
        </Card>
      </aside>

      {/* Main content area - Add drag/drop handlers */}
      <main
        ref={canvasContainerRef}
        className="flex-1 p-6 flex flex-col items-center justify-center overflow-hidden"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* File Input - Conditionally render */}
        {!image && (
          <div className="mb-4 w-full max-w-md flex justify-center">
            <input type="file" accept="image/*" onChange={handleImageUpload} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" />
          </div>
        )}

        {/* Canvas Container - Add visual feedback for drag-over */}
        <div className={`w-full h-full flex items-center justify-center relative border rounded-lg ${isDraggingOver ? 'border-primary border-dashed border-2' : 'border-border'} bg-muted/40`}>
          {image ? (
            <WebGLCanvas
              ref={webGLCanvasRef} // Pass the ref
              imageSrc={image}
              transformMatrix={transformMatrix}
              preserveDrawingBuffer={true} // Enable preserving the buffer for download
              // Pass dimensions for the canvas element itself.
              // Let WebGL handle scaling the image texture onto the quad.
              // Use container dimensions to constrain canvas size initially.
              width={canvasContainerRef.current?.clientWidth ?? 800} // Default/max width
              height={canvasContainerRef.current?.clientHeight ?? 600} // Default/max height
            />
          ) : (
            <div className="text-muted-foreground text-center p-4">
              {isDraggingOver ? "Drop image here" : "Drag & drop an image here, or use the button above"}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
