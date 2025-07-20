#!/bin/bash

# Create a simple app icon using ImageMagick or native macOS tools
# This creates a blue gradient background with a white tent icon

echo "Generating app icons for Kids Camp Tracker..."

# Function to create icon using macOS native tools
create_icon_macos() {
    local size=$1
    local output=$2
    
    # Create a temporary SVG file
    cat > /tmp/app_icon.svg << EOF
<svg width="$size" height="$size" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3F51B5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#303F9F;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="$size" height="$size" fill="url(#bgGradient)" rx="$((size/5))" />
  
  <!-- Tent -->
  <g transform="translate($((size/2)), $((size*3/5)))">
    <!-- Main tent -->
    <path d="M -$((size/4)) 0 L 0 -$((size*7/20)) L $((size/4)) 0 Z" fill="white" />
    <!-- Tent opening -->
    <path d="M -$((size/8)) 0 L 0 -$((size*7/40)) L $((size/8)) 0 Z" fill="#303F9F" />
  </g>
  
  <!-- Stars -->
  <g fill="#FFD700">
    <circle cx="$((size/5))" cy="$((size/5))" r="$((size/20))" />
    <circle cx="$((size*4/5))" cy="$((size/6))" r="$((size/25))" />
    <circle cx="$((size/6))" cy="$((size*4/5))" r="$((size/25))" />
    <circle cx="$((size*5/6))" cy="$((size*5/6))" r="$((size/20))" />
  </g>
</svg>
EOF
    
    # Convert SVG to PNG using native tools
    qlmanage -t -s $size -o /tmp /tmp/app_icon.svg > /dev/null 2>&1
    mv /tmp/app_icon.svg.png "$output" 2>/dev/null || {
        # Fallback: use sips to create a basic icon
        echo "Creating basic icon for $output"
        # Create a blue square
        printf "\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x10\x00\x00\x00\x10\x08\x02\x00\x00\x00\x90\x91h6\x00\x00\x00\x09pHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\x07tIME\x07\xe5\x07\x14\x0f\x00\x00\x00\x00\x00\x00\x00\x19tEXtComment\x00Created by Kids Camp Tracker\x00\x00\x00\x00\x00IEND\xaeB`\x82" > "$output"
    }
}

# iOS icon sizes with proper names
ios_sizes=(
    "40:icon-40.png"
    "60:icon-60.png"
    "58:icon-58.png"
    "87:icon-87.png"
    "80:icon-80.png"
    "120:icon-120.png"
    "180:icon-180.png"
    "1024:icon-1024.png"
)

# Android icon sizes
android_sizes=(
    "48:mipmap-mdpi"
    "72:mipmap-hdpi"
    "96:mipmap-xhdpi"
    "144:mipmap-xxhdpi"
    "192:mipmap-xxxhdpi"
)

# Create iOS icons
ios_path="../ios/KidsCampTracker/Images.xcassets/AppIcon.appiconset"
echo "Creating iOS icons..."

for size_info in "${ios_sizes[@]}"; do
    IFS=':' read -r size filename <<< "$size_info"
    output_path="$ios_path/$filename"
    echo "Creating $filename ($size x $size)"
    create_icon_macos $size "$output_path"
done

# Create Contents.json for iOS
cat > "$ios_path/Contents.json" << EOF
{
  "images" : [
    {
      "size" : "20x20",
      "idiom" : "iphone",
      "filename" : "icon-40.png",
      "scale" : "2x"
    },
    {
      "size" : "20x20",
      "idiom" : "iphone",
      "filename" : "icon-60.png",
      "scale" : "3x"
    },
    {
      "size" : "29x29",
      "idiom" : "iphone",
      "filename" : "icon-58.png",
      "scale" : "2x"
    },
    {
      "size" : "29x29",
      "idiom" : "iphone",
      "filename" : "icon-87.png",
      "scale" : "3x"
    },
    {
      "size" : "40x40",
      "idiom" : "iphone",
      "filename" : "icon-80.png",
      "scale" : "2x"
    },
    {
      "size" : "40x40",
      "idiom" : "iphone",
      "filename" : "icon-120.png",
      "scale" : "3x"
    },
    {
      "size" : "60x60",
      "idiom" : "iphone",
      "filename" : "icon-120.png",
      "scale" : "2x"
    },
    {
      "size" : "60x60",
      "idiom" : "iphone",
      "filename" : "icon-180.png",
      "scale" : "3x"
    },
    {
      "size" : "1024x1024",
      "idiom" : "ios-marketing",
      "filename" : "icon-1024.png",
      "scale" : "1x"
    }
  ],
  "info" : {
    "version" : 1,
    "author" : "xcode"
  }
}
EOF

# Create Android icons
android_path="../android/app/src/main/res"
echo -e "\nCreating Android icons..."

for size_info in "${android_sizes[@]}"; do
    IFS=':' read -r size folder <<< "$size_info"
    folder_path="$android_path/$folder"
    mkdir -p "$folder_path"
    
    echo "Creating $folder/ic_launcher.png ($size x $size)"
    create_icon_macos $size "$folder_path/ic_launcher.png"
    cp "$folder_path/ic_launcher.png" "$folder_path/ic_launcher_round.png"
done

echo -e "\nApp icons generated successfully!"
echo "Note: For best results, consider creating custom icons using a design tool."