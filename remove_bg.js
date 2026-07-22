const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

async function processImage(inputPath, outputPath) {
  try {
    const img = await loadImage(inputPath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      
      // If it's close to white
      if (r > 240 && g > 240 && b > 240) {
        data[i+3] = 0; // set alpha to 0
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log('Saved to', outputPath);
  } catch (err) {
    console.error('Error processing', inputPath, err);
  }
}

async function main() {
  const images = [
    { in: '/Users/tiny/.gemini/antigravity-ide/brain/b2ed1b77-7fa7-4326-85a8-b9f8eb56ed78/pink_pig_silhouette_1784715721701.png', out: 'tray-icon.png' },
  ];

  for (const img of images) {
    await processImage(img.in, path.join('/Users/tiny/Documents/Personal/Pig-cleaner/src/renderer/assets', img.out));
  }
}

main();
