const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const tailwindcss = require('@tailwindcss/postcss');
const autoprefixer = require('autoprefixer');

async function buildCSS() {
  const inputFile = path.join(__dirname, '../src/styles.css');
  const outputFile = path.join(__dirname, '../dist/styles.css');
  
  try {
    // Read input CSS
    const inputCSS = fs.readFileSync(inputFile, 'utf8');
    
    // Process with PostCSS and Tailwind
    const result = await postcss([
      tailwindcss,
      autoprefixer,
    ]).process(inputCSS, {
      from: inputFile,
      to: outputFile,
    });
    
    // Write output
    fs.writeFileSync(outputFile, result.css);
    
    console.log('✅ CSS built successfully!');
  } catch (error) {
    console.error('❌ Error building CSS:', error);
    process.exit(1);
  }
}

buildCSS();