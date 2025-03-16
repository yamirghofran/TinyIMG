#include "../include/image_processor.h"
#include <stdio.h>
#include <string.h>
#include <math.h>

// Memory management functions
ImageMatrix* createImageMatrix(int width, int height, int channels) {
    ImageMatrix* matrix = (ImageMatrix*)malloc(sizeof(ImageMatrix));
    if (!matrix) return NULL;
    
    matrix->width = width;
    matrix->height = height;
    matrix->channels = channels;
    
    size_t dataSize = width * height * channels;
    matrix->data = (unsigned char*)malloc(dataSize);
    if (!matrix->data) {
        free(matrix);
        return NULL;
    }
    
    memset(matrix->data, 0, dataSize);
    return matrix;
}

void freeImageMatrix(ImageMatrix* matrix) {
    if (matrix) {
        if (matrix->data) {
            free(matrix->data);
        }
        free(matrix);
    }
}

// Data conversion functions
ImageMatrix* canvasDataToMatrix(unsigned char* data, int width, int height, int channels) {
    ImageMatrix* matrix = createImageMatrix(width, height, channels);
    if (!matrix) return NULL;
    
    size_t dataSize = width * height * channels;
    memcpy(matrix->data, data, dataSize);
    
    return matrix;
}

unsigned char* matrixToCanvasData(ImageMatrix* matrix) {
    if (!matrix || !matrix->data) return NULL;
    
    size_t dataSize = matrix->width * matrix->height * matrix->channels;
    unsigned char* canvasData = (unsigned char*)malloc(dataSize);
    if (!canvasData) return NULL;
    
    memcpy(canvasData, matrix->data, dataSize);
    return canvasData;
}

// Transformation matrix functions
TransformMatrix* createIdentityMatrix() {
    TransformMatrix* matrix = (TransformMatrix*)malloc(sizeof(TransformMatrix));
    if (!matrix) return NULL;
    
    // Initialize to identity matrix
    matrix->m[0][0] = 1.0f; matrix->m[0][1] = 0.0f; matrix->m[0][2] = 0.0f;
    matrix->m[1][0] = 0.0f; matrix->m[1][1] = 1.0f; matrix->m[1][2] = 0.0f;
    matrix->m[2][0] = 0.0f; matrix->m[2][1] = 0.0f; matrix->m[2][2] = 1.0f;
    
    return matrix;
}

TransformMatrix* createRotationMatrix(float angle) {
    TransformMatrix* matrix = createIdentityMatrix();
    if (!matrix) return NULL;
    
    // Convert angle from degrees to radians
    float radians = angle * (M_PI / 180.0f);
    float cosTheta = cosf(radians);
    float sinTheta = sinf(radians);
    
    // Set rotation values
    matrix->m[0][0] = cosTheta;
    matrix->m[0][1] = -sinTheta;
    matrix->m[1][0] = sinTheta;
    matrix->m[1][1] = cosTheta;
    
    return matrix;
}

TransformMatrix* createScalingMatrix(float sx, float sy) {
    TransformMatrix* matrix = createIdentityMatrix();
    if (!matrix) return NULL;
    
    matrix->m[0][0] = sx;
    matrix->m[1][1] = sy;
    
    return matrix;
}

TransformMatrix* createFlipMatrix(int horizontalFlip, int verticalFlip) {
    TransformMatrix* matrix = createIdentityMatrix();
    if (!matrix) return NULL;
    
    if (horizontalFlip) {
        matrix->m[0][0] = -1.0f;
    }
    
    if (verticalFlip) {
        matrix->m[1][1] = -1.0f;
    }
    
    return matrix;
}

TransformMatrix* createWarpMatrix(float kx, float ky) {
    TransformMatrix* matrix = createIdentityMatrix();
    if (!matrix) return NULL;
    
    matrix->m[0][1] = kx;
    matrix->m[1][0] = ky;
    
    return matrix;
}

TransformMatrix* multiplyMatrices(TransformMatrix* m1, TransformMatrix* m2) {
    if (!m1 || !m2) return NULL;
    
    TransformMatrix* result = (TransformMatrix*)malloc(sizeof(TransformMatrix));
    if (!result) return NULL;
    
    for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
            result->m[i][j] = 0;
            for (int k = 0; k < 3; k++) {
                result->m[i][j] += m1->m[i][k] * m2->m[k][j];
            }
        }
    }
    
    return result;
}

void freeTransformMatrix(TransformMatrix* matrix) {
    if (matrix) {
        free(matrix);
    }
}

// Image transformation function
ImageMatrix* applyTransformation(ImageMatrix* image, TransformMatrix* transform) {
    if (!image || !transform) return NULL;
    
    int width = image->width;
    int height = image->height;
    int channels = image->channels;
    
    ImageMatrix* result = createImageMatrix(width, height, channels);
    if (!result) return NULL;
    
    // Calculate the center of the image for transformation
    float centerX = width / 2.0f;
    float centerY = height / 2.0f;
    
    // For each pixel in the result image
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            // Convert to centered coordinates
            float srcX = x - centerX;
            float srcY = y - centerY;
            
            // Apply inverse transformation to find source pixel
            float det = transform->m[0][0] * transform->m[1][1] - transform->m[0][1] * transform->m[1][0];
            if (fabs(det) < 1e-6) continue; // Skip if transformation is not invertible
            
            float invDet = 1.0f / det;
            float a = transform->m[1][1] * invDet;
            float b = -transform->m[0][1] * invDet;
            float c = -transform->m[1][0] * invDet;
            float d = transform->m[0][0] * invDet;
            
            float origX = a * srcX + b * srcY;
            float origY = c * srcX + d * srcY;
            
            // Convert back to image coordinates
            origX += centerX;
            origY += centerY;
            
            // Check if the source pixel is within bounds
            if (origX >= 0 && origX < width - 1 && origY >= 0 && origY < height - 1) {
                // Bilinear interpolation
                int x0 = (int)origX;
                int y0 = (int)origY;
                int x1 = x0 + 1;
                int y1 = y0 + 1;
                
                float dx = origX - x0;
                float dy = origY - y0;
                
                for (int c = 0; c < channels; c++) {
                    unsigned char p00 = image->data[(y0 * width + x0) * channels + c];
                    unsigned char p01 = image->data[(y0 * width + x1) * channels + c];
                    unsigned char p10 = image->data[(y1 * width + x0) * channels + c];
                    unsigned char p11 = image->data[(y1 * width + x1) * channels + c];
                    
                    float value = (1 - dx) * (1 - dy) * p00 +
                                 dx * (1 - dy) * p01 +
                                 (1 - dx) * dy * p10 +
                                 dx * dy * p11;
                    
                    result->data[(y * width + x) * channels + c] = (unsigned char)value;
                }
            }
        }
    }
    
    return result;
}

// Simple SVD-based compression (placeholder - a full SVD implementation would be more complex)
ImageMatrix* compressSVD(ImageMatrix* image, float compressionRatio) {
    if (!image || compressionRatio <= 0 || compressionRatio > 100) return NULL;
    
    int width = image->width;
    int height = image->height;
    int channels = image->channels;
    
    // Create result image
    ImageMatrix* result = createImageMatrix(width, height, channels);
    if (!result) return NULL;
    
    // For very large images, use a simpler approach to avoid performance issues
    int pixelCount = width * height;
    if (pixelCount > 1000000) { // More than 1 million pixels
        // For large images, use a simpler approximation
        // Just copy the image and apply a simple quality reduction
        float quality = compressionRatio / 100.0f;
        for (int i = 0; i < height; i++) {
            for (int j = 0; j < width; j++) {
                for (int c = 0; c < channels; c++) {
                    unsigned char pixel = image->data[(i * width + j) * channels + c];
                    // Simple quality reduction by quantization
                    int steps = 2 + (int)(254 * quality);
                    int quantized = (pixel * steps / 256) * (256 / steps);
                    result->data[(i * width + j) * channels + c] = (unsigned char)quantized;
                }
            }
        }
        return result;
    }
    
    // Process each channel separately
    for (int c = 0; c < channels; c++) {
        // Extract channel data into a matrix
        float** matrix = (float**)malloc(height * sizeof(float*));
        for (int i = 0; i < height; i++) {
            matrix[i] = (float*)malloc(width * sizeof(float));
            for (int j = 0; j < width; j++) {
                matrix[i][j] = (float)image->data[(i * width + j) * channels + c];
            }
        }
        
        // Calculate the rank to keep based on compression ratio
        // Higher compression ratio means keeping more singular values
        int maxRank = (width < height) ? width : height;
        int k = (int)(maxRank * compressionRatio / 100.0);
        
        // Limit k to a reasonable value for performance
        if (k < 1) k = 1;
        if (k > 50) k = 50; // Cap at 50 for performance
        if (k > maxRank) k = maxRank;
        
        // Allocate memory for SVD components
        float** U = (float**)malloc(height * sizeof(float*));
        float* S = (float*)malloc(k * sizeof(float));
        float** V = (float**)malloc(width * sizeof(float*));
        
        for (int i = 0; i < height; i++) {
            U[i] = (float*)malloc(k * sizeof(float));
            // Initialize to zero
            for (int j = 0; j < k; j++) {
                U[i][j] = 0.0f;
            }
        }
        
        for (int i = 0; i < width; i++) {
            V[i] = (float*)malloc(k * sizeof(float));
            // Initialize to zero
            for (int j = 0; j < k; j++) {
                V[i][j] = 0.0f;
            }
        }
        
        // Initialize S to zero
        for (int i = 0; i < k; i++) {
            S[i] = 0.0f;
        }
        
        // For very small rank values, use a simpler approach
        if (k <= 3) {
            // For small k, just average the rows and columns
            // This is a crude approximation but much faster
            
            // Calculate row and column averages
            float* rowAvg = (float*)malloc(height * sizeof(float));
            float* colAvg = (float*)malloc(width * sizeof(float));
            
            // Calculate row averages
            for (int i = 0; i < height; i++) {
                float sum = 0;
                for (int j = 0; j < width; j++) {
                    sum += matrix[i][j];
                }
                rowAvg[i] = sum / width;
            }
            
            // Calculate column averages
            for (int j = 0; j < width; j++) {
                float sum = 0;
                for (int i = 0; i < height; i++) {
                    sum += matrix[i][j];
                }
                colAvg[j] = sum / height;
            }
            
            // Use these as our first singular vectors
            for (int i = 0; i < height; i++) {
                U[i][0] = rowAvg[i];
            }
            
            for (int j = 0; j < width; j++) {
                V[j][0] = colAvg[j];
            }
            
            // Normalize U
            float normU = 0;
            for (int i = 0; i < height; i++) {
                normU += U[i][0] * U[i][0];
            }
            normU = sqrtf(normU);
            if (normU > 1e-10) {
                for (int i = 0; i < height; i++) {
                    U[i][0] /= normU;
                }
            }
            
            // Normalize V
            float normV = 0;
            for (int j = 0; j < width; j++) {
                normV += V[j][0] * V[j][0];
            }
            normV = sqrtf(normV);
            if (normV > 1e-10) {
                for (int j = 0; j < width; j++) {
                    V[j][0] /= normV;
                }
            }
            
            // Calculate S[0]
            for (int i = 0; i < height; i++) {
                for (int j = 0; j < width; j++) {
                    S[0] += U[i][0] * matrix[i][j] * V[j][0];
                }
            }
            
            free(rowAvg);
            free(colAvg);
        } else {
            // For larger k, use power iteration but with fewer iterations
            
            // Initialize U with random values
            srand(42); // Fixed seed for reproducibility
            for (int i = 0; i < height; i++) {
                for (int j = 0; j < k; j++) {
                    U[i][j] = (float)rand() / RAND_MAX;
                }
            }
            
            // Limit iterations based on image size for performance
            int maxIter = 5; // Reduced from 10 to 5
            if (pixelCount > 500000) maxIter = 3; // Even fewer for larger images
            
            // Power iteration for SVD (simplified)
            for (int iter = 0; iter < maxIter; iter++) {
                // Orthogonalize U
                for (int j = 0; j < k; j++) {
                    for (int p = 0; p < j; p++) {
                        float dot = 0;
                        for (int i = 0; i < height; i++) {
                            dot += U[i][j] * U[i][p];
                        }
                        for (int i = 0; i < height; i++) {
                            U[i][j] -= dot * U[i][p];
                        }
                    }
                    
                    // Normalize
                    float norm = 0;
                    for (int i = 0; i < height; i++) {
                        norm += U[i][j] * U[i][j];
                    }
                    norm = sqrtf(norm);
                    if (norm > 1e-10) {
                        for (int i = 0; i < height; i++) {
                            U[i][j] /= norm;
                        }
                    }
                }
                
                // Compute V = A^T * U
                for (int j = 0; j < k; j++) {
                    for (int i = 0; i < width; i++) {
                        V[i][j] = 0;
                        for (int p = 0; p < height; p++) {
                            V[i][j] += matrix[p][i] * U[p][j];
                        }
                    }
                }
                
                // Compute singular values and normalize V
                for (int j = 0; j < k; j++) {
                    float norm = 0;
                    for (int i = 0; i < width; i++) {
                        norm += V[i][j] * V[i][j];
                    }
                    norm = sqrtf(norm);
                    S[j] = norm;
                    
                    if (norm > 1e-10) {
                        for (int i = 0; i < width; i++) {
                            V[i][j] /= norm;
                        }
                    }
                }
                
                // Compute U = A * V
                for (int j = 0; j < k; j++) {
                    for (int i = 0; i < height; i++) {
                        U[i][j] = 0;
                        for (int p = 0; p < width; p++) {
                            U[i][j] += matrix[i][p] * V[p][j];
                        }
                    }
                }
            }
        }
        
        // Reconstruct the compressed image: A ≈ U * S * V^T
        for (int i = 0; i < height; i++) {
            for (int j = 0; j < width; j++) {
                float val = 0;
                for (int p = 0; p < k; p++) {
                    val += U[i][p] * S[p] * V[j][p];
                }
                
                // Clamp values to valid pixel range
                if (val < 0) val = 0;
                if (val > 255) val = 255;
                
                result->data[(i * width + j) * channels + c] = (unsigned char)val;
            }
        }
        
        // Free allocated memory
        for (int i = 0; i < height; i++) {
            free(matrix[i]);
            free(U[i]);
        }
        free(matrix);
        free(U);
        free(S);
        
        for (int i = 0; i < width; i++) {
            free(V[i]);
        }
        free(V);
    }
    
    return result;
} 