#!/bin/bash

cd /Users/mike/Development/KidsActivityTracker/src/assets/images/activities

echo "Fixing all 23 mismatched images with appropriate content..."

# Arts & Crafts
curl -L "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&q=80" -o arts_crafts.jpg 2>/dev/null

# Badminton  
curl -L "https://images.unsplash.com/photo-1613918108466-292b78a8ef95?w=800&q=80" -o badminton.jpg 2>/dev/null

# Climbing
curl -L "https://images.unsplash.com/photo-1564769610726-63a64303e131?w=800&q=80" -o climbing.jpg 2>/dev/null

# Community Center
curl -L "https://images.unsplash.com/photo-1555685812-4e943f1cb0eb?w=800&q=80" -o community_center.jpg 2>/dev/null

# Diving  
curl -L "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80" -o diving.jpg 2>/dev/null

# Drums
curl -L "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=800&q=80" -o drums.jpg 2>/dev/null

# Hip Hop Dance
curl -L "https://images.unsplash.com/photo-1535525153412-5a42439a210d?w=800&q=80" -o hip_hop_dance.jpg 2>/dev/null

# Hockey
curl -L "https://images.unsplash.com/photo-1577223840737-9ea37d23d9cf?w=800&q=80" -o hockey.jpg 2>/dev/null

# Ice Skating  
curl -L "https://images.unsplash.com/photo-1606165478023-fd6db3e32502?w=800&q=80" -o ice_skating.jpg 2>/dev/null

# Karate
curl -L "https://images.unsplash.com/photo-1598518142144-82c0e0c587f1?w=800&q=80" -o karate.jpg 2>/dev/null

# Kids Night Out
curl -L "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&q=80" -o kids_night_out.jpg 2>/dev/null

# Leadership
curl -L "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800&q=80" -o leadership.jpg 2>/dev/null

# Outdoor
curl -L "https://images.unsplash.com/photo-1533873984035-25970ab07461?w=800&q=80" -o outdoor.jpg 2>/dev/null

# Playground
curl -L "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80" -o playground.jpg 2>/dev/null

# Pottery
curl -L "https://images.unsplash.com/photo-1481023469146-e58ce6afdd2b?w=800&q=80" -o pottery.jpg 2>/dev/null

# Racquet Sports
curl -L "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800&q=80" -o racquet_sports.jpg 2>/dev/null

# Recreation Center  
curl -L "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80" -o recreation_center.jpg 2>/dev/null

# Running
curl -L "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&q=80" -o running.jpg 2>/dev/null

# Skateboarding
curl -L "https://images.unsplash.com/photo-1568484352212-99d40baaf541?w=800&q=80" -o skateboarding.jpg 2>/dev/null

# STEM
curl -L "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&q=80" -o stem.jpg 2>/dev/null

# Volleyball
curl -L "https://images.unsplash.com/photo-1553005746-f1e78780b1c8?w=800&q=80" -o volleyball.jpg 2>/dev/null

# Water Safety
curl -L "https://images.unsplash.com/photo-1471874708433-acd480424946?w=800&q=80" -o water_safety.jpg 2>/dev/null

# Youth Activities
curl -L "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=800&q=80" -o youth_activities.jpg 2>/dev/null

echo "Download complete. Checking file sizes..."
echo ""

# Check which files are too small (failed downloads)
for file in arts_crafts.jpg badminton.jpg climbing.jpg community_center.jpg diving.jpg drums.jpg hip_hop_dance.jpg hockey.jpg ice_skating.jpg karate.jpg kids_night_out.jpg leadership.jpg outdoor.jpg playground.jpg pottery.jpg racquet_sports.jpg recreation_center.jpg running.jpg skateboarding.jpg stem.jpg volleyball.jpg water_safety.jpg youth_activities.jpg; do
  size=$(stat -f%z "$file" 2>/dev/null)
  if [ "$size" -lt 1000 ]; then
    echo "✗ $file - Failed (${size} bytes)"
  else
    echo "✓ $file - Success ($(ls -lh "$file" | awk '{print $5}'))"
  fi
done