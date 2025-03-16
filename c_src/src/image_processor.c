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

// Helper functions for SVD implementation
// Allocate a 2D matrix of floats
float** allocateMatrix(int rows, int cols) {
    float** matrix = (float**)malloc(rows * sizeof(float*));
    if (!matrix) return NULL;
    
    for (int i = 0; i < rows; i++) {
        matrix[i] = (float*)malloc(cols * sizeof(float));
        if (!matrix[i]) {
            // Free previously allocated memory
            for (int j = 0; j < i; j++) {
                free(matrix[j]);
            }
            free(matrix);
            return NULL;
        }
        // Initialize to zero
        for (int j = 0; j < cols; j++) {
            matrix[i][j] = 0.0f;
        }
    }
    return matrix;
}

// Free a 2D matrix
void freeMatrix(float** matrix, int rows) {
    if (!matrix) return;
    
    for (int i = 0; i < rows; i++) {
        if (matrix[i]) free(matrix[i]);
    }
    free(matrix);
}

// Create a copy of a matrix
float** copyMatrix(float** src, int rows, int cols) {
    float** dest = allocateMatrix(rows, cols);
    if (!dest) return NULL;
    
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            dest[i][j] = src[i][j];
        }
    }
    return dest;
}

// Transpose a matrix
float** transposeMatrix(float** matrix, int rows, int cols) {
    float** transpose = allocateMatrix(cols, rows);
    if (!transpose) return NULL;
    
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            transpose[j][i] = matrix[i][j];
        }
    }
    return transpose;
}

// Multiply two matrices: C = A * B
float** multiplyMatrices2D(float** A, int rowsA, int colsA, float** B, int rowsB, int colsB) {
    if (colsA != rowsB) return NULL;
    
    float** C = allocateMatrix(rowsA, colsB);
    if (!C) return NULL;
    
    for (int i = 0; i < rowsA; i++) {
        for (int j = 0; j < colsB; j++) {
            C[i][j] = 0.0f;
            for (int k = 0; k < colsA; k++) {
                C[i][j] += A[i][k] * B[k][j];
            }
        }
    }
    return C;
}

// Multiply matrix by scalar: B = A * s
void multiplyMatrixByScalar(float** A, int rows, int cols, float s, float** B) {
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            B[i][j] = A[i][j] * s;
        }
    }
}

// Calculate the Frobenius norm of a matrix
float frobeniusNorm(float** A, int rows, int cols) {
    float sum = 0.0f;
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            sum += A[i][j] * A[i][j];
        }
    }
    return sqrtf(sum);
}

// Calculate A^T * A for a matrix A
float** calculateATA(float** A, int rows, int cols) {
    float** AT = transposeMatrix(A, rows, cols);
    if (!AT) return NULL;
    
    float** ATA = multiplyMatrices2D(AT, cols, rows, A, rows, cols);
    
    freeMatrix(AT, cols);
    return ATA;
}

// Calculate A * A^T for a matrix A
float** calculateAAT(float** A, int rows, int cols) {
    float** AT = transposeMatrix(A, rows, cols);
    if (!AT) return NULL;
    
    float** AAT = multiplyMatrices2D(A, rows, cols, AT, cols, rows);
    
    freeMatrix(AT, cols);
    return AAT;
}

// Initialize identity matrix
void initIdentityMatrix(float** matrix, int size) {
    for (int i = 0; i < size; i++) {
        for (int j = 0; j < size; j++) {
            matrix[i][j] = (i == j) ? 1.0f : 0.0f;
        }
    }
}

// Find the largest off-diagonal element in a symmetric matrix
void findLargestOffDiagonal(float** A, int n, int* p, int* q) {
    float maxVal = 0.0f;
    *p = 0;
    *q = 1;
    
    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            if (fabs(A[i][j]) > maxVal) {
                maxVal = fabs(A[i][j]);
                *p = i;
                *q = j;
            }
        }
    }
}

// Perform a Jacobi rotation on a symmetric matrix
void jacobiRotation(float** A, float** V, int n, int p, int q) {
    // Calculate rotation parameters
    float a_pp = A[p][p];
    float a_qq = A[q][q];
    float a_pq = A[p][q];
    
    float theta = 0.5f * atan2(2.0f * a_pq, a_qq - a_pp);
    float c = cosf(theta);
    float s = sinf(theta);
    
    // Update the matrix A
    float new_app = a_pp * c * c + a_qq * s * s + 2.0f * a_pq * c * s;
    float new_aqq = a_pp * s * s + a_qq * c * c - 2.0f * a_pq * c * s;
    
    A[p][p] = new_app;
    A[q][q] = new_aqq;
    A[p][q] = 0.0f;
    A[q][p] = 0.0f;
    
    for (int i = 0; i < n; i++) {
        if (i != p && i != q) {
            float a_ip = A[i][p];
            float a_iq = A[i][q];
            A[i][p] = a_ip * c + a_iq * s;
            A[p][i] = A[i][p];
            A[i][q] = -a_ip * s + a_iq * c;
            A[q][i] = A[i][q];
        }
    }
    
    // Update the eigenvector matrix V
    for (int i = 0; i < n; i++) {
        float v_ip = V[i][p];
        float v_iq = V[i][q];
        V[i][p] = v_ip * c + v_iq * s;
        V[i][q] = -v_ip * s + v_iq * c;
    }
}

// Perform Jacobi SVD on a matrix
void jacobiSVD(float** A, int rows, int cols, float** U, float* S, float** V) {
    // Determine which dimension is smaller
    int m = rows;
    int n = cols;
    int min_dim = (m < n) ? m : n;
    
    // For SVD, we need to compute eigenvalues of A^T*A or A*A^T
    float** ATA = NULL;
    float** eigenvectors = NULL;
    
    // First, make a copy of A to preserve the original data
    float** A_copy = copyMatrix(A, m, n);
    if (!A_copy) {
        // If memory allocation fails, fall back to the original method
        if (n <= m) {
            // Use A^T*A which is n x n
            ATA = calculateATA(A, m, n);
            eigenvectors = allocateMatrix(n, n);
            initIdentityMatrix(eigenvectors, n);
        } else {
            // Use A*A^T which is m x m
            ATA = calculateAAT(A, m, n);
            eigenvectors = allocateMatrix(m, m);
            initIdentityMatrix(eigenvectors, m);
        }
    } else {
        // Use the more robust approach with the copy of A
        if (n <= m) {
            // Use A^T*A which is n x n
            ATA = calculateATA(A_copy, m, n);
            eigenvectors = allocateMatrix(n, n);
            initIdentityMatrix(eigenvectors, n);
        } else {
            // Use A*A^T which is m x m
            ATA = calculateAAT(A_copy, m, n);
            eigenvectors = allocateMatrix(m, m);
            initIdentityMatrix(eigenvectors, m);
        }
        
        // Free the copy of A
        freeMatrix(A_copy, m);
    }
    
    if (!ATA || !eigenvectors) {
        if (ATA) freeMatrix(ATA, (n <= m) ? n : m);
        if (eigenvectors) freeMatrix(eigenvectors, (n <= m) ? n : m);
        return;
    }
    
    // Perform Jacobi iterations
    const int MAX_ITERATIONS = 150; // Increase max iterations for better convergence
    const float EPSILON = 1e-8f;    // Tighter convergence threshold
    
    int iter;
    for (iter = 0; iter < MAX_ITERATIONS; iter++) {
        // Find the largest off-diagonal element
        int p, q;
        findLargestOffDiagonal(ATA, (n <= m) ? n : m, &p, &q);
        
        // If the element is very small, we're done
        if (fabs(ATA[p][q]) < EPSILON) {
            break;
        }
        
        // Perform Jacobi rotation
        jacobiRotation(ATA, eigenvectors, (n <= m) ? n : m, p, q);
    }
    
    // Extract singular values (square root of eigenvalues)
    for (int i = 0; i < min_dim; i++) {
        S[i] = sqrtf(fabs(ATA[i][i]));
    }
    
    // Sort singular values and corresponding vectors in descending order
    for (int i = 0; i < min_dim - 1; i++) {
        for (int j = i + 1; j < min_dim; j++) {
            if (S[i] < S[j]) {
                // Swap singular values
                float temp = S[i];
                S[i] = S[j];
                S[j] = temp;
                
                // Swap columns in eigenvectors
                for (int k = 0; k < ((n <= m) ? n : m); k++) {
                    temp = eigenvectors[k][i];
                    eigenvectors[k][i] = eigenvectors[k][j];
                    eigenvectors[k][j] = temp;
                }
            }
        }
    }
    
    // Set up V matrix
    if (n <= m) {
        // V is just the eigenvectors
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < min_dim; j++) {
                V[i][j] = eigenvectors[i][j];
            }
        }
    } else {
        // V needs to be computed from A^T*U*S^-1
        float** AT = transposeMatrix(A, m, n);
        float** US_inv = allocateMatrix(m, min_dim);
        
        // Compute U*S^-1
        for (int i = 0; i < m; i++) {
            for (int j = 0; j < min_dim; j++) {
                if (S[j] > EPSILON) {
                    US_inv[i][j] = eigenvectors[i][j] / S[j];
                } else {
                    US_inv[i][j] = 0.0f;
                }
            }
        }
        
        // V = A^T * U * S^-1
        float** temp = multiplyMatrices2D(AT, n, m, US_inv, m, min_dim);
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < min_dim; j++) {
                V[i][j] = temp[i][j];
            }
        }
        
        freeMatrix(AT, n);
        freeMatrix(US_inv, m);
        freeMatrix(temp, n);
    }
    
    // Set up U matrix
    if (n <= m) {
        // U needs to be computed from A*V*S^-1
        float** VS_inv = allocateMatrix(n, min_dim);
        
        // Compute V*S^-1
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < min_dim; j++) {
                if (S[j] > EPSILON) {
                    VS_inv[i][j] = V[i][j] / S[j];
                } else {
                    VS_inv[i][j] = 0.0f;
                }
            }
        }
        
        // U = A * V * S^-1
        float** temp = multiplyMatrices2D(A, m, n, VS_inv, n, min_dim);
        for (int i = 0; i < m; i++) {
            for (int j = 0; j < min_dim; j++) {
                U[i][j] = temp[i][j];
            }
        }
        
        freeMatrix(VS_inv, n);
        freeMatrix(temp, m);
    } else {
        // U is just the eigenvectors
        for (int i = 0; i < m; i++) {
            for (int j = 0; j < min_dim; j++) {
                U[i][j] = eigenvectors[i][j];
            }
        }
    }
    
    // Normalize U and V columns and ensure correct signs
    for (int j = 0; j < min_dim; j++) {
        // Normalize U[:, j]
        float u_norm = 0.0f;
        for (int i = 0; i < m; i++) {
            u_norm += U[i][j] * U[i][j];
        }
        u_norm = sqrtf(u_norm);
        
        if (u_norm > EPSILON) {
            for (int i = 0; i < m; i++) {
                U[i][j] /= u_norm;
            }
            // Adjust S to compensate for normalization
            S[j] *= u_norm;
        }
        
        // Normalize V[:, j]
        float v_norm = 0.0f;
        for (int i = 0; i < n; i++) {
            v_norm += V[i][j] * V[i][j];
        }
        v_norm = sqrtf(v_norm);
        
        if (v_norm > EPSILON) {
            for (int i = 0; i < n; i++) {
                V[i][j] /= v_norm;
            }
            // Adjust S to compensate for normalization
            S[j] *= v_norm;
        }
        
        // Ensure U and V have consistent signs
        // Check the sign of the first non-zero element in U[:, j]
        float sign = 0.0f;
        for (int i = 0; i < m && sign == 0.0f; i++) {
            if (fabs(U[i][j]) > EPSILON) {
                sign = U[i][j] > 0.0f ? 1.0f : -1.0f;
            }
        }
        
        // If sign is negative, flip the signs of U[:, j] and V[:, j]
        if (sign < 0.0f) {
            for (int i = 0; i < m; i++) {
                U[i][j] = -U[i][j];
            }
            for (int i = 0; i < n; i++) {
                V[i][j] = -V[i][j];
            }
        }
    }
    
    // Clean up
    freeMatrix(ATA, (n <= m) ? n : m);
    freeMatrix(eigenvectors, (n <= m) ? n : m);
}

// SVD-based image compression
ImageMatrix* compressSVD(ImageMatrix* image, float compressionRatio) {
    if (!image) return NULL;
    
    int width = image->width;
    int height = image->height;
    int channels = image->channels;
    
    // Calculate the number of singular values to keep
    int maxRank = (width < height) ? width : height;
    int k = (int)(maxRank * compressionRatio);
    if (k < 1) k = 1;
    if (k > maxRank) k = maxRank;
    
    printf("Compressing image with %d/%d singular values (%.2f%%)\n", 
           k, maxRank, (float)k / maxRank * 100.0f);
    
    // Create a new image matrix for the compressed image
    ImageMatrix* compressedImage = createImageMatrix(width, height, channels);
    if (!compressedImage) return NULL;
    
    // Process each channel separately
    for (int c = 0; c < channels; c++) {
        // Convert the channel to a float matrix
        float** A = allocateMatrix(height, width);
        if (!A) {
            freeImageMatrix(compressedImage);
            return NULL;
        }
        
        // Copy the channel data to the matrix
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                A[y][x] = (float)image->data[(y * width + x) * channels + c];
            }
        }
        
        // Allocate memory for SVD components
        float** U = allocateMatrix(height, maxRank);
        float* S = (float*)malloc(maxRank * sizeof(float));
        float** V = allocateMatrix(width, maxRank);
        
        if (!U || !S || !V) {
            if (A) freeMatrix(A, height);
            if (U) freeMatrix(U, height);
            if (S) free(S);
            if (V) freeMatrix(V, width);
            freeImageMatrix(compressedImage);
            return NULL;
        }
        
        // Initialize S to zeros
        for (int i = 0; i < maxRank; i++) {
            S[i] = 0.0f;
        }
        
        // Perform SVD
        jacobiSVD(A, height, width, U, S, V);
        
        // Check if SVD was successful by verifying S values
        int valid_svd = 0;
        for (int i = 0; i < k; i++) {
            if (S[i] > 1e-6) {
                valid_svd = 1;
                break;
            }
        }
        
        if (!valid_svd) {
            // SVD failed, just copy the original channel
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    compressedImage->data[(y * width + x) * channels + c] = image->data[(y * width + x) * channels + c];
                }
            }
        } else {
            // Use a more stable approach for reconstruction
            // First, compute U * S (height x k)
            float** US = allocateMatrix(height, k);
            if (!US) {
                // Fall back to original image if memory allocation fails
                for (int y = 0; y < height; y++) {
                    for (int x = 0; x < width; x++) {
                        compressedImage->data[(y * width + x) * channels + c] = image->data[(y * width + x) * channels + c];
                    }
                }
            } else {
                // Compute U * S
                for (int i = 0; i < height; i++) {
                    for (int j = 0; j < k; j++) {
                        US[i][j] = U[i][j] * S[j];
                    }
                }
                
                // Reconstruct the image: (U * S) * V^T
                for (int y = 0; y < height; y++) {
                    for (int x = 0; x < width; x++) {
                        float value = 0.0f;
                        for (int i = 0; i < k; i++) {
                            value += US[y][i] * V[x][i];
                        }
                        
                        // Clip the value to [0, 255]
                        if (value < 0.0f) value = 0.0f;
                        if (value > 255.0f) value = 255.0f;
                        
                        compressedImage->data[(y * width + x) * channels + c] = (unsigned char)value;
                    }
                }
                
                // Free the temporary matrix
                freeMatrix(US, height);
            }
        }
        
        // Free memory
        freeMatrix(A, height);
        freeMatrix(U, height);
        free(S);
        freeMatrix(V, width);
    }
    
    return compressedImage;
} 