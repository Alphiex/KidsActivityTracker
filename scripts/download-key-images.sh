#\!/bin/bash

echo "📥 Downloading real activity images..."

# Basketball
curl -L -s -o src/assets/images/activities/basketball.jpg "https://images.pexels.com/photos/358042/pexels-photo-358042.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Soccer
curl -L -s -o src/assets/images/activities/soccer.jpg "https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Tennis  
curl -L -s -o src/assets/images/activities/tennis.jpg "https://images.pexels.com/photos/209977/pexels-photo-209977.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Dance studio
curl -L -s -o src/assets/images/activities/dance.jpg "https://images.pexels.com/photos/358010/pexels-photo-358010.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Arts and crafts
curl -L -s -o src/assets/images/activities/arts_crafts.jpg "https://images.pexels.com/photos/1148998/pexels-photo-1148998.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Music instruments
curl -L -s -o src/assets/images/activities/music.jpg "https://images.pexels.com/photos/164821/pexels-photo-164821.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Yoga
curl -L -s -o src/assets/images/activities/yoga.jpg "https://images.pexels.com/photos/2294354/pexels-photo-2294354.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Martial arts
curl -L -s -o src/assets/images/activities/martial_arts.jpg "https://images.pexels.com/photos/7045248/pexels-photo-7045248.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Playground
curl -L -s -o src/assets/images/activities/playground.jpg "https://images.pexels.com/photos/133578/pexels-photo-133578.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Cooking/Kitchen
curl -L -s -o src/assets/images/activities/cooking.jpg "https://images.pexels.com/photos/4259140/pexels-photo-4259140.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Science
curl -L -s -o src/assets/images/activities/science.jpg "https://images.pexels.com/photos/256262/pexels-photo-256262.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Climbing wall
curl -L -s -o src/assets/images/activities/climbing.jpg "https://images.pexels.com/photos/3077875/pexels-photo-3077875.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Ice skating
curl -L -s -o src/assets/images/activities/ice_skating.jpg "https://images.pexels.com/photos/47356/freerider-skiing-ski-sports-47356.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Piano
curl -L -s -o src/assets/images/activities/piano.jpg "https://images.pexels.com/photos/1407322/pexels-photo-1407322.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Pottery
curl -L -s -o src/assets/images/activities/pottery.jpg "https://images.pexels.com/photos/2988874/pexels-photo-2988874.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Summer camp
curl -L -s -o src/assets/images/activities/summer_camp.jpg "https://images.pexels.com/photos/939702/pexels-photo-939702.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Nature/Hiking
curl -L -s -o src/assets/images/activities/nature.jpg "https://images.pexels.com/photos/917494/pexels-photo-917494.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Early years/Preschool
curl -L -s -o src/assets/images/activities/early_years.jpg "https://images.pexels.com/photos/3661266/pexels-photo-3661266.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Community center
curl -L -s -o src/assets/images/activities/community_center.jpg "https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Fitness/Gym
curl -L -s -o src/assets/images/activities/fitness.jpg "https://images.pexels.com/photos/1954524/pexels-photo-1954524.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

echo "✅ Downloaded 20 real images\!"

# Check sizes
echo ""
echo "📊 Image sizes:"
ls -lh src/assets/images/activities/*.jpg | awk '{print $9 ": " $5}' | head -20
EOF < /dev/null