CC = emcc
CFLAGS = -O3 -s WASM=1 \
         -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] \
         -s ALLOW_MEMORY_GROWTH=1 \
         -s MODULARIZE=1 \
         -s EXPORT_NAME="ImageProcessor" \
         -s EXPORTED_FUNCTIONS=['_malloc','_free','_canvasDataToMatrix','_matrixToCanvasData','_createIdentityMatrix','_createRotationMatrix','_createScalingMatrix','_createFlipMatrix','_createWarpMatrix','_multiplyMatrices','_freeTransformMatrix','_applyTransformation','_freeImageMatrix']
INCLUDES = -I./include
SRC_DIR = src
BUILD_DIR = build
PUBLIC_DIR = ../public/wasm

SOURCES = $(SRC_DIR)/image_processor.c
OBJECTS = $(SOURCES:.c=.o)
TARGET = $(BUILD_DIR)/image_processor.js
PUBLIC_TARGET = $(PUBLIC_DIR)/image_processor.js

.PHONY: all clean

all: $(TARGET) $(PUBLIC_TARGET)

$(TARGET): $(OBJECTS)
	@mkdir -p $(BUILD_DIR)
	$(CC) $(CFLAGS) $(INCLUDES) $^ -o $@

$(PUBLIC_TARGET): $(TARGET)
	@mkdir -p $(PUBLIC_DIR)
	cp $(BUILD_DIR)/image_processor.js $(PUBLIC_DIR)/
	cp $(BUILD_DIR)/image_processor.wasm $(PUBLIC_DIR)/

%.o: %.c
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

clean:
	rm -f $(OBJECTS) $(TARGET) $(BUILD_DIR)/image_processor.wasm $(PUBLIC_DIR)/image_processor.js $(PUBLIC_DIR)/image_processor.wasm 