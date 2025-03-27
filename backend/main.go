//go:build js && wasm
// +build js,wasm

package main

import (
	"fmt"
	"runtime"
	"syscall/js"
	"time" // Import time for potential debugging/logging

	"gonum.org/v1/gonum/mat"
)

const CHUNK_SIZE = 64 // Define chunk size for parallel processing

func main() {
	fmt.Println("TinyIMG WASM Module Initializing...")

	// Register functions to be callable from JavaScript
	js.Global().Set("applyFilter", js.FuncOf(applyFilterWrapper))
	js.Global().Set("compressSVD", js.FuncOf(compressSVDWrapper))

	fmt.Println("TinyIMG WASM Module Ready.")

	// Keep the module running indefinitely
	select {}
}

// applyFilterWrapper wraps the applyFilter logic for syscall/js interaction.
// It expects imageData { width, height, data: Uint8ClampedArray } and filterType string.
// It returns the processed Uint8ClampedArray or an error object.
func applyFilterWrapper(this js.Value, args []js.Value) interface{} {
	startTime := time.Now()
	fmt.Println("applyFilterWrapper called")

	if len(args) < 2 {
		return createError("Invalid number of arguments for applyFilter: expected 2 (imageData, filterType)")
	}

	imageDataJS := args[0]
	filterType := args[1].String()

	// Validate imageDataJS structure
	if !imageDataJS.Truthy() || imageDataJS.Type() != js.TypeObject {
		return createError("Invalid imageData argument: expected an object")
	}
	widthVal := imageDataJS.Get("width")
	heightVal := imageDataJS.Get("height")
	dataVal := imageDataJS.Get("data")
	if !widthVal.Truthy() || widthVal.Type() != js.TypeNumber ||
		!heightVal.Truthy() || heightVal.Type() != js.TypeNumber ||
		!dataVal.Truthy() || dataVal.IsUndefined() || dataVal.IsNull() || dataVal.Length() == 0 {
		return createError("Invalid imageData structure: missing or invalid width, height, or data (Uint8ClampedArray expected)")
	}

	width := widthVal.Int()
	height := heightVal.Int()
	dataJS := dataVal // This is the Uint8ClampedArray

	// Create a Go byte slice and copy data from JavaScript
	srcData := make([]uint8, dataJS.Length())
	copied := js.CopyBytesToGo(srcData, dataJS)
	if copied != len(srcData) {
		return createError(fmt.Sprintf("Failed to copy image data from JavaScript: copied %d, expected %d", copied, len(srcData)))
	}
	fmt.Printf("applyFilterWrapper: Copied %d bytes from JS\n", copied)

	// Apply the filter using the internal logic function
	resultData := applyFilter(srcData, width, height, filterType)

	// Create a new Uint8ClampedArray in JavaScript for the result
	resultJS := js.Global().Get("Uint8ClampedArray").New(len(resultData))
	copied = js.CopyBytesToJS(resultJS, resultData)
	if copied != len(resultData) {
		// This shouldn't realistically fail if allocation succeeded, but check anyway
		return createError(fmt.Sprintf("Failed to copy result data to JavaScript: copied %d, expected %d", copied, len(resultData)))
	}
	fmt.Printf("applyFilterWrapper: Copied %d bytes to JS\n", copied)

	fmt.Printf("applyFilterWrapper completed in %v\n", time.Since(startTime))
	// Return the resulting Uint8ClampedArray
	return resultJS
}

// applyFilter applies a convolution filter to image data (internal logic).
// Takes raw pixel data, dimensions, and filter type. Returns processed pixel data.
func applyFilter(srcData []uint8, width, height int, filterType string) []uint8 {
	// Create result data slice, initialized to zeros
	resultData := make([]uint8, len(srcData))

	// Select filter kernel based on type
	var filter []float64
	filterSize := 3 // Assuming 3x3 filters
	switch filterType {
	case "blur":
		filter = []float64{
			1 / 9.0, 1 / 9.0, 1 / 9.0,
			1 / 9.0, 1 / 9.0, 1 / 9.0,
			1 / 9.0, 1 / 9.0, 1 / 9.0,
		}
	case "sharpen":
		filter = []float64{
			0, -1, 0,
			-1, 5, -1,
			0, -1, 0,
		}
	case "edge":
		filter = []float64{
			-1, -1, -1,
			-1, 8, -1,
			-1, -1, -1,
		}
	case "emboss":
		filter = []float64{
			-2, -1, 0,
			-1, 1, 1,
			0, 1, 2,
		}
	default:
		fmt.Printf("Unknown filter type '%s', returning original data\n", filterType)
		// If no valid filter is specified, return a copy of the original image data
		copy(resultData, srcData)
		return resultData
	}

	fmt.Printf("Applying filter '%s'...\n", filterType)

	// Calculate number of goroutines based on image height and chunk size
	numGoroutines := (height + CHUNK_SIZE - 1) / CHUNK_SIZE
	if numGoroutines <= 0 {
		numGoroutines = 1
	}
	done := make(chan bool, numGoroutines)

	// Process image in parallel chunks (rows)
	for i := 0; i < numGoroutines; i++ {
		startY := i * CHUNK_SIZE
		endY := min(startY+CHUNK_SIZE, height)

		go func(startY, endY int) {
			// Ensure channel is signaled even if a panic occurs within the goroutine
			defer func() {
				if r := recover(); r != nil {
					fmt.Printf("Recovered in applyFilter goroutine: %v\n", r)
				}
				done <- true
			}()

			// Process each pixel within the assigned chunk [startY, endY)
			for y := startY; y < endY; y++ {
				for x := 0; x < width; x++ {
					// Apply filter to R, G, B channels
					for c := 0; c < 3; c++ { // Iterate through R, G, B (0, 1, 2)
						sum := 0.0

						// Apply the convolution kernel
						for fy := 0; fy < filterSize; fy++ {
							for fx := 0; fx < filterSize; fx++ {
								// Calculate coordinates of the source pixel in the neighborhood
								sx := x + fx - filterSize/2
								sy := y + fy - filterSize/2

								// Clamp coordinates to handle image boundaries
								sx = clamp(sx, 0, width-1)
								sy = clamp(sy, 0, height-1)

								// Calculate the index of the source pixel in the 1D array
								sampleIndex := (sy*width+sx)*4 + c
								if sampleIndex >= len(srcData) {
									continue
								} // Bounds check

								sampleValue := float64(srcData[sampleIndex])

								// Apply filter weight
								filterIndex := fy*filterSize + fx
								sum += sampleValue * filter[filterIndex]
							}
						}

						// Set the resulting pixel value in the output data, clamping to [0, 255]
						resultIndex := (y*width+x)*4 + c
						if resultIndex >= len(resultData) {
							continue
						} // Bounds check
						// Add 0.5 before casting for better rounding
						resultData[resultIndex] = uint8(clamp(int(sum+0.5), 0, 255))
					}

					// Copy the Alpha channel directly (index 3)
					alphaIndex := (y*width+x)*4 + 3
					if alphaIndex < len(srcData) && alphaIndex < len(resultData) {
						resultData[alphaIndex] = srcData[alphaIndex]
					}
				}
			}
		}(startY, endY)
	}

	// Wait for all goroutines to complete
	for i := 0; i < numGoroutines; i++ {
		<-done
	}

	fmt.Println("Filter application complete.")
	return resultData
}

// compressSVDWrapper wraps the compressSVD logic for syscall/js interaction.
// It expects imageData { width, height, data: Uint8ClampedArray } and rank number.
// It returns the processed Uint8ClampedArray or an error object.
func compressSVDWrapper(this js.Value, args []js.Value) interface{} {
	startTime := time.Now()
	fmt.Println("compressSVDWrapper called")

	if len(args) < 2 {
		return createError("Invalid number of arguments for compressSVD: expected 2 (imageData, rank)")
	}

	imageDataJS := args[0]
	rankVal := args[1]

	// Validate imageDataJS structure
	if !imageDataJS.Truthy() || imageDataJS.Type() != js.TypeObject {
		return createError("Invalid imageData argument: expected an object")
	}
	widthVal := imageDataJS.Get("width")
	heightVal := imageDataJS.Get("height")
	dataVal := imageDataJS.Get("data")
	if !widthVal.Truthy() || widthVal.Type() != js.TypeNumber ||
		!heightVal.Truthy() || heightVal.Type() != js.TypeNumber ||
		!dataVal.Truthy() || dataVal.IsUndefined() || dataVal.IsNull() || dataVal.Length() == 0 {
		return createError("Invalid imageData structure: missing or invalid width, height, or data (Uint8ClampedArray expected)")
	}

	// Validate rank
	if !rankVal.Truthy() || rankVal.Type() != js.TypeNumber {
		return createError("Invalid rank argument: expected a number")
	}

	width := int32(widthVal.Int())
	height := int32(heightVal.Int())
	rank := int32(rankVal.Int())
	dataJS := dataVal // This is the Uint8ClampedArray

	// Create a Go byte slice and copy data from JavaScript
	srcData := make([]uint8, dataJS.Length())
	copied := js.CopyBytesToGo(srcData, dataJS)
	if copied != len(srcData) {
		return createError(fmt.Sprintf("Failed to copy image data from JavaScript: copied %d, expected %d", copied, len(srcData)))
	}
	fmt.Printf("compressSVDWrapper: Copied %d bytes from JS\n", copied)

	// Perform SVD compression using the internal logic function
	resultData := compressSVD(srcData, width, height, rank)

	// Create a new Uint8ClampedArray in JavaScript for the result
	resultJS := js.Global().Get("Uint8ClampedArray").New(len(resultData))
	copied = js.CopyBytesToJS(resultJS, resultData)
	if copied != len(resultData) {
		return createError(fmt.Sprintf("Failed to copy result data to JavaScript: copied %d, expected %d", copied, len(resultData)))
	}
	fmt.Printf("compressSVDWrapper: Copied %d bytes to JS\n", copied)

	fmt.Printf("compressSVDWrapper completed in %v\n", time.Since(startTime))
	// Return the resulting Uint8ClampedArray
	return resultJS
}

// compressSVD performs SVD compression on image data (internal logic).
// Takes raw pixel data, dimensions, and target rank. Returns compressed pixel data.
func compressSVD(data []uint8, width, height int32, rank int32) []uint8 {
	// Validate rank: must be positive and less than min(width, height) for actual compression
	if rank <= 0 || int(rank) >= min(int(width), int(height)) {
		fmt.Printf("SVD Compression skipped: rank %d is invalid or >= min(width, height) (%dx%d)\n", rank, width, height)
		return data // Return original data if rank is invalid or won't compress
	}
	fmt.Printf("Starting SVD Compression: rank %d, dimensions %dx%d\n", rank, width, height)

	// Create separate dense matrices for R, G, B, A channels
	rMatrix := mat.NewDense(int(height), int(width), nil)
	gMatrix := mat.NewDense(int(height), int(width), nil)
	bMatrix := mat.NewDense(int(height), int(width), nil)
	aMatrix := mat.NewDense(int(height), int(width), nil) // Compressing Alpha too

	// --- Parallelized Filling of Matrices ---
	numFillGoroutines := runtime.NumCPU()
	rowsPerFillGoroutine := (int(height) + numFillGoroutines - 1) / numFillGoroutines
	fillDone := make(chan bool, numFillGoroutines)

	for i := 0; i < numFillGoroutines; i++ {
		startY := i * rowsPerFillGoroutine
		endY := min(startY+rowsPerFillGoroutine, int(height))

		go func(startY, endY int) {
			defer func() { fillDone <- true }()
			for y := startY; y < endY; y++ {
				for x := 0; x < int(width); x++ {
					idx := (y*int(width) + x) * 4
					if idx+3 >= len(data) {
						continue
					} // Bounds check
					rMatrix.Set(y, x, float64(data[idx]))
					gMatrix.Set(y, x, float64(data[idx+1]))
					bMatrix.Set(y, x, float64(data[idx+2]))
					aMatrix.Set(y, x, float64(data[idx+3]))
				}
			}
		}(startY, endY)
	}
	for i := 0; i < numFillGoroutines; i++ {
		<-fillDone
	}
	fmt.Println("Matrix filling complete.")
	// --- End Parallelized Filling ---

	// Channels to receive results from parallel SVD computations
	rChan := make(chan *mat.Dense)
	gChan := make(chan *mat.Dense)
	bChan := make(chan *mat.Dense)
	aChan := make(chan *mat.Dense)

	// Process each channel's SVD compression in parallel
	go func() { rChan <- compressMatrixSVD(rMatrix, int(rank)) }()
	go func() { gChan <- compressMatrixSVD(gMatrix, int(rank)) }()
	go func() { bChan <- compressMatrixSVD(bMatrix, int(rank)) }()
	go func() { aChan <- compressMatrixSVD(aMatrix, int(rank)) }() // Compress Alpha

	// Receive the compressed matrices from channels
	rCompressed := <-rChan
	gCompressed := <-gChan
	bCompressed := <-bChan
	aCompressed := <-aChan
	fmt.Println("SVD computation for all channels complete.")

	// --- Parallelized Rebuilding of the result array ---
	result := make([]uint8, len(data))
	numRebuildGoroutines := runtime.NumCPU()
	rowsPerRebuildGoroutine := (int(height) + numRebuildGoroutines - 1) / numRebuildGoroutines
	rebuildDone := make(chan bool, numRebuildGoroutines)

	for i := 0; i < numRebuildGoroutines; i++ {
		startY := i * rowsPerRebuildGoroutine
		endY := min(startY+rowsPerRebuildGoroutine, int(height))

		go func(startY, endY int) {
			defer func() { rebuildDone <- true }()
			for y := startY; y < endY; y++ {
				for x := 0; x < int(width); x++ {
					idx := (y*int(width) + x) * 4
					if idx+3 >= len(result) {
						continue
					} // Bounds check

					// Read values from compressed matrices, clamp to [0, 255], and round before casting
					result[idx] = uint8(clampFloat64(rCompressed.At(y, x)+0.5, 0, 255))
					result[idx+1] = uint8(clampFloat64(gCompressed.At(y, x)+0.5, 0, 255))
					result[idx+2] = uint8(clampFloat64(bCompressed.At(y, x)+0.5, 0, 255))
					result[idx+3] = uint8(clampFloat64(aCompressed.At(y, x)+0.5, 0, 255)) // Also rebuild Alpha
				}
			}
		}(startY, endY)
	}
	for i := 0; i < numRebuildGoroutines; i++ {
		<-rebuildDone
	}
	fmt.Println("Result array rebuilding complete.")
	// --- End Parallelized Rebuilding ---

	fmt.Println("SVD Compression Finished.")
	return result
}

// compressMatrixSVD performs SVD factorization and reconstruction for a single channel matrix.
func compressMatrixSVD(m *mat.Dense, rank int) *mat.Dense {
	rows, cols := m.Dims()
	// Ensure rank is valid and potentially useful
	effectiveRank := min(rank, min(rows, cols))
	if effectiveRank <= 0 {
		fmt.Println("compressMatrixSVD: Invalid rank, returning original.")
		return m
	}

	var svd mat.SVD
	// Use SVDFull to get full U and V matrices needed for reconstruction
	ok := svd.Factorize(m, mat.SVDFull)
	if !ok {
		fmt.Println("SVD Factorization failed for a channel.")
		return m // Return original matrix if factorization fails
	}

	// Get U, Σ (singular values), V matrices
	var u, v mat.Dense
	svd.UTo(&u)          // U is (rows x rows)
	svd.VTo(&v)          // V is (cols x cols)
	s := svd.Values(nil) // Singular values slice

	// --- Reconstruction using truncated matrices ---
	// We need: U_r (rows x rank), S_r (rank x rank diag), V_r^T (rank x cols)

	// U_r: First 'effectiveRank' columns of U
	ur := u.Slice(0, rows, 0, effectiveRank)

	// S_r: Diagonal matrix with first 'effectiveRank' singular values
	sr := mat.NewDiagDense(effectiveRank, nil)
	for i := 0; i < effectiveRank; i++ {
		if i < len(s) {
			sr.SetDiag(i, s[i])
		} else {
			sr.SetDiag(i, 0) // Should not happen if effectiveRank <= len(s)
		}
	}

	// V_r: First 'effectiveRank' columns of V
	vr := v.Slice(0, cols, 0, effectiveRank)

	// Compute the reconstructed matrix: result = U_r * S_r * V_r^T
	var temp, result mat.Dense
	temp.Mul(ur, sr)          // temp = U_r * S_r (size: rows x effectiveRank)
	result.Mul(&temp, vr.T()) // result = temp * V_r^T (size: rows x cols)

	return &result
}

// Helper function to clamp integer values to a specified range [minVal, maxVal].
func clamp(value, minVal, maxVal int) int {
	if value < minVal {
		return minVal
	}
	if value > maxVal {
		return maxVal
	}
	return value
}

// Helper function to clamp float64 values to a specified range [minVal, maxVal].
func clampFloat64(v, minVal, maxVal float64) float64 {
	if v < minVal {
		return minVal
	}
	if v > maxVal {
		return maxVal
	}
	return v
}

// Helper function to find the minimum of two integers.
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// createError is a helper to create a JavaScript-friendly error object.
func createError(msg string) interface{} {
	fmt.Println("WASM Error:", msg) // Log error on the Go/WASM side for debugging
	// Return a simple JS object that can be checked on the JS side
	errorObject := js.Global().Get("Object").New()
	errorObject.Set("error", msg)
	return errorObject
}
