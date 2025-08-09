#!/bin/bash

# Create placeholder images for all activity types
# These will be replaced with actual child-friendly images

echo "🎨 Creating placeholder images for activities..."

# Ensure ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick is required but not installed."
    echo "Install with: brew install imagemagick"
    exit 1
fi

# Create assets directory if it doesn't exist
mkdir -p assets/images/activities

# Define colors for each category
declare -A CATEGORY_COLORS=(
    ["swimming"]="#00BCD4"
    ["water_safety"]="#0097A7"
    ["diving"]="#00ACC1"
    ["basketball"]="#FF6F00"
    ["soccer"]="#388E3C"
    ["tennis"]="#FDD835"
    ["badminton"]="#7B1FA2"
    ["volleyball"]="#E53935"
    ["hockey"]="#1976D2"
    ["baseball"]="#795548"
    ["sports_general"]="#424242"
    ["racquet_sports"]="#F57C00"
    ["dance"]="#E91E63"
    ["ballet"]="#F06292"
    ["hip_hop_dance"]="#BA68C8"
    ["arts_crafts"]="#9C27B0"
    ["pottery"]="#8D6E63"
    ["painting"]="#7C4DFF"
    ["crafts"]="#536DFE"
    ["music"]="#3F51B5"
    ["piano"]="#5C6BC0"
    ["guitar"]="#7986CB"
    ["drums"]="#9FA8DA"
    ["fitness"]="#00897B"
    ["yoga"]="#26A69A"
    ["climbing"]="#66BB6A"
    ["gym"]="#43A047"
    ["martial_arts"]="#D32F2F"
    ["karate"]="#C62828"
    ["stem"]="#1565C0"
    ["cooking"]="#FB8C00"
    ["science"]="#039BE5"
    ["leadership"]="#6A1B9A"
    ["language"]="#00838F"
    ["summer_camp"]="#2E7D32"
    ["outdoor"]="#33691E"
    ["nature"]="#689F38"
    ["playground"]="#AFB42B"
    ["hiking"]="#827717"
    ["early_years"]="#FFB300"
    ["toddler_play"]="#FFA000"
    ["preschool"]="#FF8F00"
    ["kids_activities"]="#FF6F00"
    ["kids_night_out"]="#AD1457"
    ["youth_activities"]="#4527A0"
    ["ice_skating"]="#0277BD"
    ["skateboarding"]="#FF3D00"
    ["recreation_center"]="#37474F"
    ["community_center"]="#455A64"
    ["family_fun"]="#F4511E"
)

# Array of all image keys
IMAGE_KEYS=(
    "swimming" "water_safety" "diving"
    "basketball" "soccer" "tennis" "badminton" "volleyball" "hockey" "baseball" "sports_general"
    "racquet_sports" "dance" "ballet" "hip_hop_dance"
    "arts_crafts" "pottery" "painting" "crafts"
    "music" "piano" "guitar" "drums"
    "fitness" "yoga" "climbing" "gym"
    "martial_arts" "karate"
    "stem" "cooking" "science" "leadership" "language"
    "summer_camp" "outdoor" "nature" "playground" "hiking"
    "early_years" "toddler_play" "preschool" "kids_activities"
    "kids_night_out" "youth_activities"
    "ice_skating" "skateboarding"
    "recreation_center" "community_center" "family_fun"
)

# Create placeholder images
for key in "${IMAGE_KEYS[@]}"; do
    color="${CATEGORY_COLORS[$key]:-#757575}"
    filename="assets/images/activities/${key}.jpg"
    
    # Create a colored placeholder with the activity name
    convert -size 800x600 xc:"$color" \
        -gravity center \
        -fill white \
        -font Arial \
        -pointsize 48 \
        -annotate +0+0 "${key//_/ }" \
        -quality 85 \
        "$filename"
    
    echo "✅ Created placeholder: $filename"
done

echo ""
echo "🎉 Created ${#IMAGE_KEYS[@]} placeholder images!"
echo "📁 Location: assets/images/activities/"
echo ""
echo "Next steps:"
echo "1. Replace these placeholders with actual child-friendly images"
echo "2. Keep the same filenames when replacing"
echo "3. Use high-quality, landscape-oriented images"

# Make the script executable
chmod +x "$0"