#!/bin/bash

cd /Users/mike/Development/KidsActivityTracker/src/assets/images/activities

echo "Downloading correct sports images..."

# Download real ice skating image from Wikimedia Commons (free to use)
echo "Downloading ice skating image..."
curl -L "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Ice_skating_on_the_Rideau_Canal.jpg/800px-Ice_skating_on_the_Rideau_Canal.jpg" -o ice_skating_new.jpg 2>/dev/null

if [ -f ice_skating_new.jpg ] && [ $(stat -f%z ice_skating_new.jpg) -gt 10000 ]; then
    mv ice_skating_new.jpg ice_skating.jpg
    echo "✓ Ice skating image downloaded successfully"
else
    # Try alternative ice skating image
    curl -L "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Figure_skating_at_the_2020_Winter_Youth_Olympics.jpg/800px-Figure_skating_at_the_2020_Winter_Youth_Olympics.jpg" -o ice_skating.jpg
    echo "✓ Using alternative ice skating image"
fi

# Download real volleyball image from Wikimedia Commons
echo "Downloading volleyball image..."
curl -L "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Beach_volleyball_ball.jpg/800px-Beach_volleyball_ball.jpg" -o volleyball_new.jpg 2>/dev/null

if [ -f volleyball_new.jpg ] && [ $(stat -f%z volleyball_new.jpg) -gt 10000 ]; then
    mv volleyball_new.jpg volleyball.jpg
    echo "✓ Volleyball image downloaded successfully"
else
    # Try alternative volleyball image
    curl -L "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Volleyball_game.jpg/800px-Volleyball_game.jpg" -o volleyball.jpg
    echo "✓ Using alternative volleyball image"
fi

echo ""
echo "Final status:"
ls -lah ice_skating.jpg volleyball.jpg