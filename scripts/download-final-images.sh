#\!/bin/bash

echo "📥 Downloading final batch of real images..."

# Badminton
curl -L -s -o src/assets/images/activities/badminton.jpg "https://images.pexels.com/photos/115016/badminton-shuttle-sport-bat-115016.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Sports general
curl -L -s -o src/assets/images/activities/sports_general.jpg "https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Racquet sports
curl -L -s -o src/assets/images/activities/racquet_sports.jpg "https://images.pexels.com/photos/1103833/pexels-photo-1103833.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Hip hop dance
curl -L -s -o src/assets/images/activities/hip_hop_dance.jpg "https://images.pexels.com/photos/2834009/pexels-photo-2834009.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Crafts
curl -L -s -o src/assets/images/activities/crafts.jpg "https://images.pexels.com/photos/1314543/pexels-photo-1314543.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Toddler play
curl -L -s -o src/assets/images/activities/toddler_play.jpg "https://images.pexels.com/photos/3661243/pexels-photo-3661243.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Kids night out
curl -L -s -o src/assets/images/activities/kids_night_out.jpg "https://images.pexels.com/photos/1835927/pexels-photo-1835927.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Youth activities
curl -L -s -o src/assets/images/activities/youth_activities.jpg "https://images.pexels.com/photos/2519829/pexels-photo-2519829.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Recreation center
curl -L -s -o src/assets/images/activities/recreation_center.jpg "https://images.pexels.com/photos/209984/pexels-photo-209984.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

echo "✅ Downloaded final images\!"
echo ""
echo "📊 Checking for any remaining small files:"
ls -lh src/assets/images/activities/*.jpg | awk '$5 ~ /[0-9]+B$/ {print $9 ": " $5}'
