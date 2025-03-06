#ifndef IMAGE_PROCESSOR_H
#define IMAGE_PROCESSOR_H

#include <stdlib.h>
#include <math.h>
#include <emscripten.h>

// Matrix structure for image representation
typedef struct {
    int width;
    int height;
    int channels; // 1 for grayscale, 3 for RGB, 4 for RGBA
    unsigned char* data;
} ImageMatrix;

// 3x3 transformation matrix
typedef struct {
    float m[3][3];
} TransformMatrix;

// Exported functions
#ifdef __cplusplus
extern "C" {
#endif

// Memory management
EMSCRIPTEN_KEEPALIVE
ImageMatrix* createImageMatrix(int width, int height, int channels);

EMSCRIPTEN_KEEPALIVE
void freeImageMatrix(ImageMatrix* matrix);

// Data conversion
EMSCRIPTEN_KEEPALIVE
ImageMatrix* canvasDataToMatrix(unsigned char* data, int width, int height, int channels);

EMSCRIPTEN_KEEPALIVE
unsigned char* matrixToCanvasData(ImageMatrix* matrix);

// Transformation matrices
EMSCRIPTEN_KEEPALIVE
TransformMatrix* createIdentityMatrix();

EMSCRIPTEN_KEEPALIVE
TransformMatrix* createRotationMatrix(float angle);

EMSCRIPTEN_KEEPALIVE
TransformMatrix* createScalingMatrix(float sx, float sy);

EMSCRIPTEN_KEEPALIVE
TransformMatrix* createFlipMatrix(int horizontalFlip, int verticalFlip);

EMSCRIPTEN_KEEPALIVE
TransformMatrix* createWarpMatrix(float kx, float ky);

EMSCRIPTEN_KEEPALIVE
TransformMatrix* multiplyMatrices(TransformMatrix* m1, TransformMatrix* m2);

EMSCRIPTEN_KEEPALIVE
void freeTransformMatrix(TransformMatrix* matrix);

// Image transformations
EMSCRIPTEN_KEEPALIVE
ImageMatrix* applyTransformation(ImageMatrix* image, TransformMatrix* transform);

// Compression
EMSCRIPTEN_KEEPALIVE
ImageMatrix* compressSVD(ImageMatrix* image, float compressionRatio);

#ifdef __cplusplus
}
#endif

#endif // IMAGE_PROCESSOR_H 