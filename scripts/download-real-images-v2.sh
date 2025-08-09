#!/bin/bash

# Download real images for Kids Activity Tracker
echo "🖼️  Downloading real images for activities..."

cd src/assets/images/activities

# Function to download image with retry
download_image() {
    local filename=$1
    local search_terms=$2
    
    echo "📥 Downloading $filename..."
    
    # Use wget with follow redirects and user agent
    wget -q --user-agent="Mozilla/5.0" -O "$filename" "https://source.unsplash.com/800x600/?${search_terms}" || \
    curl -L -s -o "$filename" "https://source.unsplash.com/800x600/?${search_terms}"
    
    # Check if file is valid (more than 1KB)
    if [ -f "$filename" ] && [ $(stat -f%z "$filename" 2>/dev/null || stat -c%s "$filename" 2>/dev/null) -gt 1000 ]; then
        echo "✅ Downloaded: $filename"
    else
        echo "❌ Failed: $filename - retrying with Picsum..."
        # Fallback to Lorem Picsum (always returns images)
        curl -L -s -o "$filename" "https://picsum.photos/800/600" 
        echo "✅ Downloaded from Picsum: $filename"
    fi
    
    # Rate limiting
    sleep 2
}

# Download all images
download_image "swimming.jpg" "swimming,pool,water"
download_image "water_safety.jpg" "lifeguard,pool,safety"
download_image "diving.jpg" "diving,pool,water"
download_image "basketball.jpg" "basketball,court,sports"
download_image "soccer.jpg" "soccer,football,field"
download_image "tennis.jpg" "tennis,court,racket"
download_image "badminton.jpg" "badminton,shuttlecock"
download_image "volleyball.jpg" "volleyball,beach,sports"
download_image "hockey.jpg" "hockey,ice,rink"
download_image "baseball.jpg" "baseball,field,sports"
download_image "sports_general.jpg" "sports,equipment"
download_image "racquet_sports.jpg" "tennis,racquet,sports"
download_image "dance.jpg" "dance,studio,ballet"
download_image "ballet.jpg" "ballet,dance,studio"
download_image "hip_hop_dance.jpg" "dance,hiphop,studio"
download_image "arts_crafts.jpg" "art,craft,supplies"
download_image "pottery.jpg" "pottery,clay,ceramics"
download_image "painting.jpg" "painting,art,easel"
download_image "crafts.jpg" "crafts,art,supplies"
download_image "music.jpg" "music,instruments,piano"
download_image "piano.jpg" "piano,keyboard,music"
download_image "guitar.jpg" "guitar,acoustic,music"
download_image "drums.jpg" "drums,percussion,music"
download_image "fitness.jpg" "fitness,gym,exercise"
download_image "yoga.jpg" "yoga,mat,meditation"
download_image "climbing.jpg" "climbing,wall,indoor"
download_image "gym.jpg" "gym,fitness,equipment"
download_image "martial_arts.jpg" "martial,arts,karate"
download_image "karate.jpg" "karate,dojo,martial"
download_image "stem.jpg" "science,technology,robotics"
download_image "cooking.jpg" "cooking,kitchen,chef"
download_image "science.jpg" "science,laboratory,experiment"
download_image "leadership.jpg" "teamwork,group,leadership"
download_image "language.jpg" "books,library,learning"
download_image "summer_camp.jpg" "camp,outdoor,summer"
download_image "outdoor.jpg" "outdoor,nature,adventure"
download_image "nature.jpg" "nature,forest,trees"
download_image "playground.jpg" "playground,park,colorful"
download_image "hiking.jpg" "hiking,trail,mountain"
download_image "early_years.jpg" "preschool,classroom,colorful"
download_image "toddler_play.jpg" "toys,playroom,colorful"
download_image "preschool.jpg" "preschool,education,classroom"
download_image "kids_activities.jpg" "children,playing,activities"
download_image "kids_night_out.jpg" "party,celebration,fun"
download_image "youth_activities.jpg" "teenagers,activities,group"
download_image "ice_skating.jpg" "ice,skating,rink"
download_image "skateboarding.jpg" "skateboard,park,ramp"
download_image "recreation_center.jpg" "recreation,building,community"
download_image "community_center.jpg" "community,center,building"
download_image "family_fun.jpg" "family,together,fun"

echo "✅ All images downloaded!"
cd ../../../..

# Verify downloads
echo ""
echo "📊 Verifying image sizes..."
ls -lh src/assets/images/activities/*.jpg | awk '{print $9 ": " $5}' | head -10