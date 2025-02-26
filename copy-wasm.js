// Script to copy WebAssembly files to the public directory
import fs from 'fs';
import path from 'path';

// Create the destination directory if it doesn't exist
const destDir = path.resolve('./public/wasm');
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  console.log('Created directory:', destDir);
}

// Source files
const sourceDir = path.resolve('./c_src/build');
const files = ['image_processor.js', 'image_processor.wasm'];

// Copy each file
files.forEach(file => {
  const sourcePath = path.join(sourceDir, file);
  const destPath = path.join(destDir, file);
  
  try {
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied ${file} to ${destPath}`);
    } else {
      console.warn(`Source file not found: ${sourcePath}`);
    }
  } catch (error) {
    console.error(`Error copying ${file}:`, error);
  }
});

console.log('WebAssembly files copied successfully!'); 