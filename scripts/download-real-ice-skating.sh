#!/bin/bash

cd /Users/mike/Development/KidsActivityTracker/src/assets/images/activities

echo "Downloading real ice skating images..."

# Try multiple sources for ice skating images
# Option 1: Pixabay direct download
wget -O ice_skating_temp1.jpg "https://cdn.pixabay.com/photo/2013/12/13/14/24/ice-skater-227853_960_720.jpg" 2>/dev/null

# Option 2: Another Pixabay ice skating image
wget -O ice_skating_temp2.jpg "https://cdn.pixabay.com/photo/2017/12/09/16/41/figure-skating-3008242_960_720.jpg" 2>/dev/null

# Option 3: Kids ice skating
wget -O ice_skating_temp3.jpg "https://cdn.pixabay.com/photo/2016/01/19/17/20/ice-skating-1149558_960_720.jpg" 2>/dev/null

# Check which download worked and use the largest file
largest_file=""
largest_size=0

for file in ice_skating_temp*.jpg; do
    if [ -f "$file" ]; then
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        if [ "$size" -gt "$largest_size" ]; then
            largest_size=$size
            largest_file=$file
        fi
    fi
done

if [ -n "$largest_file" ] && [ "$largest_size" -gt 10000 ]; then
    mv "$largest_file" ice_skating.jpg
    echo "✓ Successfully downloaded ice skating image ($(ls -lh ice_skating.jpg | awk '{print $5}'))"
    # Clean up temp files
    rm -f ice_skating_temp*.jpg 2>/dev/null
else
    echo "✗ Failed to download from Pixabay, trying Pexels..."
    
    # Fallback to Pexels
    curl -H "Authorization: XJqEPAu5zKqGzKFDlqGhCqJKKqPzYFYH8zPvGmNpLDpKpH7Bjqx5NqPz" \
         "https://api.pexels.com/v1/search?query=ice%20skating%20rink&per_page=1" \
         -o pexels_response.json 2>/dev/null
    
    # Extract URL from JSON (basic parsing)
    if [ -f pexels_response.json ]; then
        url=$(grep -o '"large":"[^"]*"' pexels_response.json | head -1 | cut -d'"' -f4)
        if [ -n "$url" ]; then
            curl -L "$url" -o ice_skating.jpg
            echo "✓ Downloaded from Pexels"
        fi
        rm -f pexels_response.json
    fi
fi

# Final check
if [ -f ice_skating.jpg ]; then
    final_size=$(stat -f%z ice_skating.jpg 2>/dev/null || stat -c%s ice_skating.jpg 2>/dev/null)
    if [ "$final_size" -gt 10000 ]; then
        echo "✓ Ice skating image ready: $(ls -lh ice_skating.jpg)"
    else
        echo "✗ Downloaded file is too small, may need manual intervention"
    fi
else
    echo "✗ Failed to download ice skating image"
fi