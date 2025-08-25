#!/bin/bash

cd /Users/mike/Development/KidsActivityTracker/src/assets/images/activities

# Create proper placeholder images using ImageMagick (if available) or download from Lorem Picsum
echo "Downloading proper placeholder images..."

# Ice skating - winter/ice themed image
echo "Downloading ice skating image..."
curl -L "https://loremflickr.com/800/600/ice,skating,rink/all" -o ice_skating_temp.jpg
if [ -f ice_skating_temp.jpg ] && [ $(stat -f%z ice_skating_temp.jpg) -gt 10000 ]; then
    mv ice_skating_temp.jpg ice_skating.jpg
    echo "✓ Ice skating image downloaded"
else
    # Fallback: use a winter sports image
    curl -L "https://source.unsplash.com/800x600/?winter,sports" -o ice_skating.jpg
    echo "✓ Using winter sports fallback for ice skating"
fi

# Volleyball - beach/sport themed image
echo "Downloading volleyball image..."
curl -L "https://loremflickr.com/800/600/volleyball,beach,sport/all" -o volleyball_temp.jpg
if [ -f volleyball_temp.jpg ] && [ $(stat -f%z volleyball_temp.jpg) -gt 10000 ]; then
    mv volleyball_temp.jpg volleyball.jpg
    echo "✓ Volleyball image downloaded"
else
    # Fallback: use a beach sports image
    curl -L "https://source.unsplash.com/800x600/?beach,sports" -o volleyball.jpg
    echo "✓ Using beach sports fallback for volleyball"
fi

# Running - track/athletics themed image  
echo "Downloading running image..."
curl -L "https://loremflickr.com/800/600/running,track,athletics/all" -o running_temp.jpg
if [ -f running_temp.jpg ] && [ $(stat -f%z running_temp.jpg) -gt 10000 ]; then
    mv running_temp.jpg running.jpg
    echo "✓ Running image downloaded"
else
    # Fallback
    curl -L "https://source.unsplash.com/800x600/?running,athletics" -o running.jpg
    echo "✓ Using athletics fallback for running"
fi

echo ""
echo "Final status:"
ls -lah ice_skating.jpg volleyball.jpg running.jpg 2>/dev/null || echo "Some images may have failed to download"