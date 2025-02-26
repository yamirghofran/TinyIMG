import React, { useState, useEffect } from 'react';

interface TransformationControlsProps {
  onTransformationChange: (matrix: number[][]) => void;
  transformMatrix: number[][];
}

export function TransformationControls({ 
  onTransformationChange,
  transformMatrix
}: TransformationControlsProps) {
  // Transformation parameters
  const [rotationAngle, setRotationAngle] = useState(0);
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
  const [shearX, setShearX] = useState(0);
  const [shearY, setShearY] = useState(0);
  
  // Reset all transformations
  const resetTransformations = () => {
    setRotationAngle(0);
    setScaleX(1);
    setScaleY(1);
    setFlipHorizontal(false);
    setFlipVertical(false);
    setShearX(0);
    setShearY(0);
    
    // Reset to identity matrix
    onTransformationChange([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ]);
  };
  
  // Calculate transformation matrix based on current parameters
  useEffect(() => {
    // Convert angle to radians
    const radians = rotationAngle * (Math.PI / 180);
    const cosTheta = Math.cos(radians);
    const sinTheta = Math.sin(radians);
    
    // Create rotation matrix
    const rotationMatrix = [
      [cosTheta, -sinTheta, 0],
      [sinTheta, cosTheta, 0],
      [0, 0, 1]
    ];
    
    // Create scaling matrix
    const scalingMatrix = [
      [scaleX, 0, 0],
      [0, scaleY, 0],
      [0, 0, 1]
    ];
    
    // Create flip matrix
    const flipMatrix = [
      [flipHorizontal ? -1 : 1, 0, 0],
      [0, flipVertical ? -1 : 1, 0],
      [0, 0, 1]
    ];
    
    // Create shear matrix
    const shearMatrix = [
      [1, shearX, 0],
      [shearY, 1, 0],
      [0, 0, 1]
    ];
    
    // Combine matrices (order matters: shear -> flip -> scale -> rotate)
    // Matrix multiplication function
    const multiplyMatrices = (a: number[][], b: number[][]) => {
      const result = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
      ];
      
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          for (let k = 0; k < 3; k++) {
            result[i][j] += a[i][k] * b[k][j];
          }
        }
      }
      
      return result;
    };
    
    // Combine all transformations
    let combinedMatrix = multiplyMatrices(rotationMatrix, scalingMatrix);
    combinedMatrix = multiplyMatrices(combinedMatrix, flipMatrix);
    combinedMatrix = multiplyMatrices(combinedMatrix, shearMatrix);
    
    onTransformationChange(combinedMatrix);
  }, [rotationAngle, scaleX, scaleY, flipHorizontal, flipVertical, shearX, shearY]);
  
  // Preset transformations
  const applyPreset = (preset: string) => {
    switch (preset) {
      case 'rotate90':
        setRotationAngle(90);
        break;
      case 'rotate180':
        setRotationAngle(180);
        break;
      case 'rotate270':
        setRotationAngle(270);
        break;
      case 'flipH':
        setFlipHorizontal(!flipHorizontal);
        break;
      case 'flipV':
        setFlipVertical(!flipVertical);
        break;
      case 'scale2x':
        setScaleX(2);
        setScaleY(2);
        break;
      case 'scale0.5x':
        setScaleX(0.5);
        setScaleY(0.5);
        break;
      default:
        break;
    }
  };
  
  return (
    <div className="transformation-controls">
      <h3>Image Transformations</h3>
      
      {/* Rotation controls */}
      <div className="control-group">
        <h4>Rotation</h4>
        <div className="slider-container">
          <input 
            type="range" 
            min="-180" 
            max="180" 
            value={rotationAngle} 
            onChange={(e) => setRotationAngle(Number(e.target.value))}
          />
          <label>
            <span>Angle:</span>
            <input 
              type="number" 
              value={rotationAngle} 
              onChange={(e) => setRotationAngle(Number(e.target.value))}
              min="-180"
              max="180"
            />°
          </label>
        </div>
        <div className="preset-buttons">
          <button className="preset-button" onClick={() => applyPreset('rotate90')}>90°</button>
          <button className="preset-button" onClick={() => applyPreset('rotate180')}>180°</button>
          <button className="preset-button" onClick={() => applyPreset('rotate270')}>270°</button>
        </div>
      </div>
      
      {/* Scaling controls */}
      <div className="control-group">
        <h4>Scaling</h4>
        <div className="slider-container">
          <label>
            <span>X Scale:</span>
            <input 
              type="number" 
              value={scaleX} 
              onChange={(e) => setScaleX(Number(e.target.value))}
              min="0.1"
              max="5"
              step="0.1"
            />
          </label>
          <input 
            type="range" 
            min="0.1" 
            max="3" 
            step="0.1"
            value={scaleX} 
            onChange={(e) => setScaleX(Number(e.target.value))}
          />
        </div>
        <div className="slider-container">
          <label>
            <span>Y Scale:</span>
            <input 
              type="number" 
              value={scaleY} 
              onChange={(e) => setScaleY(Number(e.target.value))}
              min="0.1"
              max="5"
              step="0.1"
            />
          </label>
          <input 
            type="range" 
            min="0.1" 
            max="3" 
            step="0.1"
            value={scaleY} 
            onChange={(e) => setScaleY(Number(e.target.value))}
          />
        </div>
        <div className="preset-buttons">
          <button className="preset-button" onClick={() => applyPreset('scale2x')}>2x</button>
          <button className="preset-button" onClick={() => applyPreset('scale0.5x')}>0.5x</button>
        </div>
      </div>
      
      {/* Flip controls */}
      <div className="control-group">
        <h4>Flip</h4>
        <div className="preset-buttons">
          <button 
            className={`preset-button ${flipHorizontal ? 'active' : ''}`} 
            onClick={() => applyPreset('flipH')}
          >
            Horizontal
          </button>
          <button 
            className={`preset-button ${flipVertical ? 'active' : ''}`} 
            onClick={() => applyPreset('flipV')}
          >
            Vertical
          </button>
        </div>
      </div>
      
      {/* Shear controls */}
      <div className="control-group">
        <h4>Shear/Warp</h4>
        <div className="slider-container">
          <label>
            <span>X Shear:</span>
            <input 
              type="number" 
              value={shearX} 
              onChange={(e) => setShearX(Number(e.target.value))}
              min="-1"
              max="1"
              step="0.1"
            />
          </label>
          <input 
            type="range" 
            min="-1" 
            max="1" 
            step="0.1"
            value={shearX} 
            onChange={(e) => setShearX(Number(e.target.value))}
          />
        </div>
        <div className="slider-container">
          <label>
            <span>Y Shear:</span>
            <input 
              type="number" 
              value={shearY} 
              onChange={(e) => setShearY(Number(e.target.value))}
              min="-1"
              max="1"
              step="0.1"
            />
          </label>
          <input 
            type="range" 
            min="-1" 
            max="1" 
            step="0.1"
            value={shearY} 
            onChange={(e) => setShearY(Number(e.target.value))}
          />
        </div>
      </div>
      
      {/* Reset button */}
      <button 
        className="reset-button"
        onClick={resetTransformations}
      >
        Reset All Transformations
      </button>
    </div>
  );
} 