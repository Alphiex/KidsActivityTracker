const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Create app icon with tent and stars
function createAppIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#3F51B5'); // Primary blue
  gradient.addColorStop(1, '#303F9F'); // Darker blue
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // Draw tent
  const tentSize = size * 0.5;
  const tentX = size / 2;
  const tentY = size * 0.6;
  
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  // Tent triangle
  ctx.moveTo(tentX - tentSize/2, tentY);
  ctx.lineTo(tentX, tentY - tentSize * 0.7);
  ctx.lineTo(tentX + tentSize/2, tentY);
  ctx.closePath();
  ctx.fill();
  
  // Tent opening
  ctx.fillStyle = '#303F9F';
  ctx.beginPath();
  ctx.moveTo(tentX - tentSize/4, tentY);
  ctx.lineTo(tentX, tentY - tentSize * 0.35);
  ctx.lineTo(tentX + tentSize/4, tentY);
  ctx.closePath();
  ctx.fill();
  
  // Draw stars
  const drawStar = (cx, cy, outerRadius) => {
    const innerRadius = outerRadius * 0.5;
    const points = 5;
    
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.closePath();
    ctx.fill();
  };
  
  // Draw multiple stars
  drawStar(size * 0.2, size * 0.2, size * 0.08);
  drawStar(size * 0.8, size * 0.15, size * 0.06);
  drawStar(size * 0.15, size * 0.8, size * 0.06);
  drawStar(size * 0.85, size * 0.85, size * 0.08);
  
  return canvas.toBuffer('image/png');
}

// iOS icon sizes
const iosSizes = [
  { size: 20, scale: 2, name: '40' },
  { size: 20, scale: 3, name: '60' },
  { size: 29, scale: 2, name: '58' },
  { size: 29, scale: 3, name: '87' },
  { size: 40, scale: 2, name: '80' },
  { size: 40, scale: 3, name: '120' },
  { size: 60, scale: 2, name: '120' },
  { size: 60, scale: 3, name: '180' },
  { size: 1024, scale: 1, name: '1024' }
];

// Android icon sizes
const androidSizes = [
  { size: 48, folder: 'mipmap-mdpi' },
  { size: 72, folder: 'mipmap-hdpi' },
  { size: 96, folder: 'mipmap-xhdpi' },
  { size: 144, folder: 'mipmap-xxhdpi' },
  { size: 192, folder: 'mipmap-xxxhdpi' }
];

// Generate iOS icons
console.log('Generating iOS icons...');
const iosPath = path.join(__dirname, '../ios/KidsCampTracker/Images.xcassets/AppIcon.appiconset');

iosSizes.forEach(({ size, scale, name }) => {
  const actualSize = size * scale;
  const buffer = createAppIcon(actualSize);
  const filename = `icon-${name}.png`;
  fs.writeFileSync(path.join(iosPath, filename), buffer);
  console.log(`Created ${filename} (${actualSize}x${actualSize})`);
});

// Update Contents.json for iOS
const contentsJson = {
  "images": [
    { "size": "20x20", "idiom": "iphone", "filename": "icon-40.png", "scale": "2x" },
    { "size": "20x20", "idiom": "iphone", "filename": "icon-60.png", "scale": "3x" },
    { "size": "29x29", "idiom": "iphone", "filename": "icon-58.png", "scale": "2x" },
    { "size": "29x29", "idiom": "iphone", "filename": "icon-87.png", "scale": "3x" },
    { "size": "40x40", "idiom": "iphone", "filename": "icon-80.png", "scale": "2x" },
    { "size": "40x40", "idiom": "iphone", "filename": "icon-120.png", "scale": "3x" },
    { "size": "60x60", "idiom": "iphone", "filename": "icon-120.png", "scale": "2x" },
    { "size": "60x60", "idiom": "iphone", "filename": "icon-180.png", "scale": "3x" },
    { "size": "1024x1024", "idiom": "ios-marketing", "filename": "icon-1024.png", "scale": "1x" }
  ],
  "info": { "version": 1, "author": "xcode" }
};

fs.writeFileSync(
  path.join(iosPath, 'Contents.json'),
  JSON.stringify(contentsJson, null, 2)
);

// Generate Android icons
console.log('\nGenerating Android icons...');
const androidPath = path.join(__dirname, '../android/app/src/main/res');

androidSizes.forEach(({ size, folder }) => {
  const folderPath = path.join(androidPath, folder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  
  const buffer = createAppIcon(size);
  const filename = 'ic_launcher.png';
  fs.writeFileSync(path.join(folderPath, filename), buffer);
  
  // Also create round version
  const roundFilename = 'ic_launcher_round.png';
  fs.writeFileSync(path.join(folderPath, roundFilename), buffer);
  
  console.log(`Created ${folder}/${filename} (${size}x${size})`);
});

console.log('\nApp icons generated successfully!');