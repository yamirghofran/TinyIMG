import React, { useRef, useEffect, forwardRef } from 'react';
import { mat4 } from 'gl-matrix';

interface WebGLCanvasProps {
  imageSrc: string;
  transformMatrix: mat4;
  width: number;
  height: number;
  preserveDrawingBuffer?: boolean; // Add prop for preserving buffer
}

const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  uniform mat4 u_matrix;
  varying vec2 v_texCoord;

  void main() {
    // Apply the transformation matrix
    gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  uniform sampler2D u_image;
  varying vec2 v_texCoord;

  void main() {
    gl_FragColor = texture2D(u_image, v_texCoord);
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    console.error('Unable to create shader');
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }
  console.error('Shader compilation failed:', gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) {
    console.error('Unable to create program');
    return null;
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }
  console.error('Program linking failed:', gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
  return null;
}

// Use forwardRef to pass the canvas ref up
const WebGLCanvas = forwardRef<HTMLCanvasElement, WebGLCanvasProps>(
  ({ imageSrc, transformMatrix, width, height, preserveDrawingBuffer = false }, ref) => {
  // Use the forwarded ref OR an internal ref if none is provided
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = ref || internalCanvasRef;
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const positionBufferRef = useRef<WebGLBuffer | null>(null);
  const texCoordBufferRef = useRef<WebGLBuffer | null>(null);

  // Initialize WebGL context, shaders, program, buffers
  useEffect(() => {
    // Ensure canvasRef is not null and is the correct type
    const canvas = (canvasRef as React.RefObject<HTMLCanvasElement>)?.current;
    if (!canvas) return;

    // Get context with preserveDrawingBuffer option
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer });
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    glRef.current = gl;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) return;

    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) return;
    programRef.current = program;

    // Create buffers for position and texture coordinates
    positionBufferRef.current = gl.createBuffer();
    texCoordBufferRef.current = gl.createBuffer();

    // Set rectangle coordinates (clip space)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBufferRef.current);
    const positions = [
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    // Set texture coordinates (flipped Y to match image data origin)
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBufferRef.current);
    const texCoords = [
      0.0, 1.0, // Bottom-left vertex -> Top-left texture coord
      1.0, 1.0, // Bottom-right vertex -> Top-right texture coord
      0.0, 0.0, // Top-left vertex -> Bottom-left texture coord
      0.0, 0.0, // Top-left vertex -> Bottom-left texture coord
      1.0, 1.0, // Bottom-right vertex -> Top-right texture coord
      1.0, 0.0, // Top-right vertex -> Bottom-right texture coord
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

    // Create texture
    textureRef.current = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
    // Fill the texture with a 1x1 blue pixel initially
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));
    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  }, []);

  // Load image and update texture
  useEffect(() => {
    const gl = glRef.current;
    if (!gl || !textureRef.current) return;

    const img = new Image();
    img.crossOrigin = "anonymous"; // Important for loading images from data URLs or other origins
    img.onload = () => {
      imageRef.current = img;
      gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      // Trigger a re-render after image loads
      drawScene();
    };
    img.onerror = (err) => {
        console.error("Error loading image:", err);
    }
    img.src = imageSrc;

  }, [imageSrc]);


  // Draw scene function
  const drawScene = () => {
    const gl = glRef.current;
    const program = programRef.current;
    const positionBuffer = positionBufferRef.current;
    const texCoordBuffer = texCoordBufferRef.current;
    const texture = textureRef.current;

    if (!gl || !program || !positionBuffer || !texCoordBuffer || !texture || !imageRef.current) {
      return;
    }

    // Set canvas size based on image dimensions or props
    const displayWidth = width || imageRef.current.naturalWidth;
    const displayHeight = height || imageRef.current.naturalHeight;

    if (gl.canvas.width !== displayWidth || gl.canvas.height !== displayHeight) {
        gl.canvas.width = displayWidth;
        gl.canvas.height = displayHeight;
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }


    gl.clearColor(0.0, 0.0, 0.0, 0.0); // Clear to transparent black
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    // Setup attributes
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // Setup uniforms
    const matrixLocation = gl.getUniformLocation(program, 'u_matrix');
    const imageLocation = gl.getUniformLocation(program, 'u_image');

    // --- Transformation Matrix Calculation ---
    // We need to map clip space (-1 to 1) to pixel space (0 to width/height)
    // and then apply the user's transformMatrix.
    // Finally, map back to clip space.

    // Matrix to convert from pixels to clip space
    const projectionMatrix = mat4.create();
    mat4.ortho(projectionMatrix, 0, gl.canvas.width, gl.canvas.height, 0, -1, 1); // Use ortho for 2D

    // The user's transformMatrix operates in a coordinate system where
    // the image is centered at (0,0) and scaled to fit within -1 to 1.
    // We need to adjust this. Let's assume the user matrix transforms
    // coordinates from (-1, -1) to (1, 1) relative to the image center.

    // 1. Translate image center to origin
    const translateToOrigin = mat4.create();
    mat4.translate(translateToOrigin, translateToOrigin, [-gl.canvas.width / 2, -gl.canvas.height / 2, 0]);

    // 2. Scale image to fit canvas (this might need adjustment based on desired behavior)
    // For now, let's assume the user matrix handles scaling relative to the original size.

    // 3. Apply user's transformation (rotation, scale, translate)
    // The user matrix expects coordinates in the -1 to 1 range.
    // Our vertex positions are already in -1 to 1 clip space.
    // Let's rethink: The vertex shader takes positions from -1 to 1.
    // The transformMatrix should directly transform these clip space coordinates.

    // Let's simplify: The transformMatrix passed in should already account
    // for the desired rotation, scale, and translation in clip space.
    // We might need to adjust how it's calculated in App.tsx.

    // For now, pass the user's matrix directly. We'll refine in App.tsx.
    // We still need the projection to map the final clip space coords correctly.
    // gl_Position = u_projectionMatrix * u_modelViewMatrix * vec4(a_position, 0.0, 1.0);
    // Let's combine projection and modelView into u_matrix for simplicity in the shader.

    // The user matrix transforms from model space (-1 to 1 square) to world space (scaled, rotated, translated).
    // The projection matrix transforms from world space to clip space.
    // Let's adjust the vertex shader to take two matrices? Or combine them here.

    // Let's assume transformMatrix transforms from the base quad (-1 to 1)
    // to the desired position/orientation/scale *in clip space*.
    // The ortho projection is usually for camera view, maybe not needed if we work directly in clip space.

    // Revised approach:
    // Vertices are -1 to 1.
    // transformMatrix directly manipulates these vertices in clip space.
    // Example: To scale by 0.5, the matrix would scale x and y by 0.5.
    // Example: To translate right by 0.1 clip units, matrix translates x by 0.1.

    gl.uniformMatrix4fv(matrixLocation, false, transformMatrix);


    // Set the texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(imageLocation, 0);

    // Draw the rectangle
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // Redraw when transform matrix changes
  useEffect(() => {
    drawScene();
  }, [transformMatrix, width, height]); // Redraw also if canvas size props change

  // Use props for initial size, but let WebGL control internal buffer size
  const initialWidth = width || 300;
  const initialHeight = height || 150;

  return (
    <div style={{ width: initialWidth, height: initialHeight, overflow: 'hidden' }}>
      {/* Assign the ref to the canvas element */}
      <canvas ref={canvasRef as React.RefObject<HTMLCanvasElement>} width={initialWidth} height={initialHeight} />
    </div>
  );
});

export default WebGLCanvas;
