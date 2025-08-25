#!/bin/bash

cd /Users/mike/Development/KidsActivityTracker/src/assets/images/activities

echo "Downloading proper ice skating image..."
# Ice skating rink with kids
curl -L -H "User-Agent: Mozilla/5.0" "https://images.pexels.com/photos/8386684/pexels-photo-8386684.jpeg?auto=compress&cs=tinysrgb&w=800" -o ice_skating.jpg

echo "Downloading proper volleyball image..."
# Beach volleyball
curl -L -H "User-Agent: Mozilla/5.0" "https://images.pexels.com/photos/1263426/pexels-photo-1263426.jpeg?auto=compress&cs=tinysrgb&w=800" -o volleyball.jpg

# Check if downloads failed, use fallback images
if [ $(stat -f%z ice_skating.jpg) -lt 1000 ]; then
  echo "Ice skating download failed, using fallback..."
  # Try another source
  curl -L "https://picsum.photos/800/600?random=iceskating" -o ice_skating.jpg
fi

if [ $(stat -f%z volleyball.jpg) -lt 1000 ]; then
  echo "Volleyball download failed, using fallback..."
  # Try another source  
  curl -L "https://picsum.photos/800/600?random=volleyball" -o volleyball.jpg
fi

ls -lah ice_skating.jpg volleyball.jpg
echo "Done!"