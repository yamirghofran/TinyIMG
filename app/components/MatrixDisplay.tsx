import React, { useState } from 'react';

interface TransformParams {
  rotationAngle: number;
  scaleX: number;
  scaleY: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  shearX: number;
  shearY: number;
}

interface MatrixDisplayProps {
  transformMatrix: number[][];
  transformParams?: TransformParams;
}

export function MatrixDisplay({ transformMatrix, transformParams }: MatrixDisplayProps) {
  const [showTheoretical, setShowTheoretical] = useState(true);
  
  // Format a matrix value to be more readable
  const formatValue = (value: number): string => {
    // Round to 2 decimal places and remove trailing zeros
    return value.toFixed(2).replace(/\.?0+$/, '');
  };

  // Create theoretical matrices based on exact parameters if available
  const createTheoreticalMatrices = () => {
    if (!transformParams) {
      return analyzeMatrix();
    }
    
    const { rotationAngle, scaleX, scaleY, flipHorizontal, flipVertical, shearX, shearY } = transformParams;
    const descriptions: string[] = [];
    let rotationMatrix, scaleMatrix, flipMatrix, shearMatrix;
    
    // Rotation matrix
    if (rotationAngle !== 0) {
      descriptions.push(`Rotation: ${rotationAngle}°`);
      const radians = rotationAngle * (Math.PI / 180);
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      rotationMatrix = [
        [cos, -sin, 0],
        [sin, cos, 0],
        [0, 0, 1]
      ];
    }
    
    // Scaling matrix
    if (scaleX !== 1 || scaleY !== 1) {
      descriptions.push(`Scaling: X=${scaleX}, Y=${scaleY}`);
      scaleMatrix = [
        [scaleX, 0, 0],
        [0, scaleY, 0],
        [0, 0, 1]
      ];
    }
    
    // Flip matrix
    if (flipHorizontal || flipVertical) {
      const flipType = flipHorizontal && flipVertical ? "both axes" : 
                      flipHorizontal ? "horizontal" : "vertical";
      descriptions.push(`Flipping: ${flipType}`);
      flipMatrix = [
        [flipHorizontal ? -1 : 1, 0, 0],
        [0, flipVertical ? -1 : 1, 0],
        [0, 0, 1]
      ];
    }
    
    // Shear matrix
    if (shearX !== 0 || shearY !== 0) {
      descriptions.push(`Shearing: X=${shearX}, Y=${shearY}`);
      shearMatrix = [
        [1, shearX, 0],
        [shearY, 1, 0],
        [0, 0, 1]
      ];
    }
    
    return {
      descriptions: descriptions.length > 0 ? descriptions : ['Identity matrix (no transformation)'],
      rotationMatrix,
      scaleMatrix,
      flipMatrix,
      shearMatrix
    };
  };

  // Analyze the matrix to determine what transformations are being applied
  const analyzeMatrix = (): {
    descriptions: string[];
    rotationMatrix?: number[][];
    scaleMatrix?: number[][];
    flipMatrix?: number[][];
    shearMatrix?: number[][];
  } => {
    const descriptions: string[] = [];
    const m = transformMatrix;
    let rotationMatrix, scaleMatrix, flipMatrix, shearMatrix;
    
    // Check for rotation
    if (Math.abs(m[0][0]) !== 1 || Math.abs(m[1][1]) !== 1 || m[0][1] !== 0 || m[1][0] !== 0) {
      // Calculate rotation angle in degrees
      const angle = Math.atan2(m[1][0], m[0][0]) * (180 / Math.PI);
      descriptions.push(`Rotation: ~${angle.toFixed(1)}°`);
      
      // Create theoretical rotation matrix
      const radians = angle * (Math.PI / 180);
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      rotationMatrix = [
        [cos, -sin, 0],
        [sin, cos, 0],
        [0, 0, 1]
      ];
    }
    
    // Check for scaling
    const scaleX = Math.sqrt(m[0][0] * m[0][0] + m[1][0] * m[1][0]);
    const scaleY = Math.sqrt(m[0][1] * m[0][1] + m[1][1] * m[1][1]);
    if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
      descriptions.push(`Scaling: X=${scaleX.toFixed(2)}, Y=${scaleY.toFixed(2)}`);
      
      // Create theoretical scaling matrix
      scaleMatrix = [
        [scaleX, 0, 0],
        [0, scaleY, 0],
        [0, 0, 1]
      ];
    }
    
    // Check for flipping
    const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    if (det < 0) {
      // Determine if horizontal, vertical, or both
      let flipH = false;
      let flipV = false;
      
      // This is a simplification - in complex transformations, it's hard to isolate
      // exactly which flip is happening, but we can make an educated guess
      if (m[0][0] < 0) flipH = true;
      if (m[1][1] < 0) flipV = true;
      
      const flipType = flipH && flipV ? "both axes" : flipH ? "horizontal" : "vertical";
      descriptions.push(`Flipping: ${flipType}`);
      
      // Create theoretical flip matrix
      flipMatrix = [
        [flipH ? -1 : 1, 0, 0],
        [0, flipV ? -1 : 1, 0],
        [0, 0, 1]
      ];
    }
    
    // Check for shearing
    if (Math.abs(m[0][1]) > 0.01 || Math.abs(m[1][0]) > 0.01) {
      // For simplicity, we'll use the actual values from the matrix
      // In practice, extracting pure shear values from a combined matrix is complex
      const shearX = m[0][1];
      const shearY = m[1][0];
      descriptions.push(`Shearing: X=${shearX.toFixed(2)}, Y=${shearY.toFixed(2)}`);
      
      // Create theoretical shear matrix
      shearMatrix = [
        [1, shearX, 0],
        [shearY, 1, 0],
        [0, 0, 1]
      ];
    }
    
    return {
      descriptions: descriptions.length > 0 ? descriptions : ['Identity matrix (no transformation)'],
      rotationMatrix,
      scaleMatrix,
      flipMatrix,
      shearMatrix
    };
  };

  const matrixAnalysis = transformParams ? createTheoreticalMatrices() : analyzeMatrix();

  // Render a small matrix with label
  const renderTheoreticalMatrix = (matrix: number[][] | undefined, label: string) => {
    if (!matrix) return null;
    
    return (
      <div className="theoretical-matrix">
        <h5>{label}</h5>
        <table className="matrix-table small">
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((value, colIndex) => (
                  <td key={colIndex}>{formatValue(value)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="matrix-display">
      <div className="matrix-header">
        <h3>Transformation Matrix</h3>
        <button 
          className="toggle-theoretical-btn"
          onClick={() => setShowTheoretical(!showTheoretical)}
        >
          {showTheoretical ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
      
      <div className="matrix-container">
        <div className="combined-matrix">
          <h4>Combined Matrix</h4>
          <table className="matrix-table">
            <tbody>
              {transformMatrix.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((value, colIndex) => (
                    <td key={colIndex}>{formatValue(value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {showTheoretical && (
        <div className="theoretical-matrices">
          <h4>Individual Transformation Matrices</h4>
          <div className="matrices-grid">
            {renderTheoreticalMatrix(matrixAnalysis.rotationMatrix, 'Rotation')}
            {renderTheoreticalMatrix(matrixAnalysis.scaleMatrix, 'Scaling')}
            {renderTheoreticalMatrix(matrixAnalysis.flipMatrix, 'Flipping')}
            {renderTheoreticalMatrix(matrixAnalysis.shearMatrix, 'Shearing')}
          </div>
        </div>
      )}
      
      <div className="matrix-explanation">
        <h4>Current Transformations:</h4>
        <ul>
          {matrixAnalysis.descriptions.map((desc, index) => (
            <li key={index}>{desc}</li>
          ))}
        </ul>
        <p className="matrix-hint">
          The combined matrix represents all transformations applied together.
          {showTheoretical && ' Individual matrices show the theoretical form of each transformation.'}
        </p>
      </div>
    </div>
  );
} 