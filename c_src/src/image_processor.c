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
    // This is a simplified placeholder for SVD compression
    // A real implementation would decompose the image matrix and reconstruct with fewer singular values
    
    // For now, we'll just return a copy of the image
    if (!image) return NULL;
    
    ImageMatrix* result = createImageMatrix(image->width, image->height, image->channels);
    if (!result) return NULL;
    
    size_t dataSize = image->width * image->height * image->channels;
    memcpy(result->data, image->data, dataSize);
    
    // TODO: Implement actual SVD compression
    
    return result;
} 