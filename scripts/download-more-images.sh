#\!/bin/bash

echo "📥 Downloading more real images..."

# Ballet
curl -L -s -o src/assets/images/activities/ballet.jpg "https://images.pexels.com/photos/2820896/pexels-photo-2820896.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Volleyball
curl -L -s -o src/assets/images/activities/volleyball.jpg "https://images.pexels.com/photos/1263426/pexels-photo-1263426.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Hockey
curl -L -s -o src/assets/images/activities/hockey.jpg "https://images.pexels.com/photos/89719/pexels-photo-89719.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Baseball
curl -L -s -o src/assets/images/activities/baseball.jpg "https://images.pexels.com/photos/264279/pexels-photo-264279.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Water safety
curl -L -s -o src/assets/images/activities/water_safety.jpg "https://images.pexels.com/photos/2027058/pexels-photo-2027058.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Diving
curl -L -s -o src/assets/images/activities/diving.jpg "https://images.pexels.com/photos/73760/swimming-swimmer-female-race-73760.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Guitar
curl -L -s -o src/assets/images/activities/guitar.jpg "https://images.pexels.com/photos/1010519/pexels-photo-1010519.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Drums
curl -L -s -o src/assets/images/activities/drums.jpg "https://images.pexels.com/photos/995301/pexels-photo-995301.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Gym
curl -L -s -o src/assets/images/activities/gym.jpg "https://images.pexels.com/photos/1756959/pexels-photo-1756959.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Hiking
curl -L -s -o src/assets/images/activities/hiking.jpg "https://images.pexels.com/photos/1365425/pexels-photo-1365425.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Skateboarding
curl -L -s -o src/assets/images/activities/skateboarding.jpg "https://images.pexels.com/photos/1164406/pexels-photo-1164406.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# STEM/Science
curl -L -s -o src/assets/images/activities/stem.jpg "https://images.pexels.com/photos/8613089/pexels-photo-8613089.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Leadership
curl -L -s -o src/assets/images/activities/leadership.jpg "https://images.pexels.com/photos/1367269/pexels-photo-1367269.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Language/Books
curl -L -s -o src/assets/images/activities/language.jpg "https://images.pexels.com/photos/256455/pexels-photo-256455.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Outdoor activities
curl -L -s -o src/assets/images/activities/outdoor.jpg "https://images.pexels.com/photos/1416736/pexels-photo-1416736.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Preschool
curl -L -s -o src/assets/images/activities/preschool.jpg "https://images.pexels.com/photos/8613312/pexels-photo-8613312.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Kids activities
curl -L -s -o src/assets/images/activities/kids_activities.jpg "https://images.pexels.com/photos/296301/pexels-photo-296301.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Family fun
curl -L -s -o src/assets/images/activities/family_fun.jpg "https://images.pexels.com/photos/1683975/pexels-photo-1683975.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Karate
curl -L -s -o src/assets/images/activities/karate.jpg "https://images.pexels.com/photos/7045497/pexels-photo-7045497.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

# Painting
curl -L -s -o src/assets/images/activities/painting.jpg "https://images.pexels.com/photos/1047540/pexels-photo-1047540.jpeg?auto=compress&cs=tinysrgb&w=800&h=600"

echo "✅ Downloaded 20 more real images\!"
echo ""
ls -lh src/assets/images/activities/*.jpg | wc -l
echo "total activity images"
