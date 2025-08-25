#!/bin/bash

# Script to replace activity images with new ones from downloads folder
# Converts webp to jpg and standardizes sizing

SOURCE_DIR="/Users/mike/Downloads/image_replacements"
TARGET_DIR="/Users/mike/Development/KidsActivityTracker/src/assets/images/activities"
BACKUP_DIR="/Users/mike/Development/KidsActivityTracker/src/assets/images/activities_backup_$(date +%Y%m%d_%H%M%S)"

# Standard dimensions for activity images (16:9 aspect ratio)
TARGET_WIDTH=800
TARGET_HEIGHT=450

echo "🎨 Starting image replacement process..."
echo "📁 Source: $SOURCE_DIR"
echo "📁 Target: $TARGET_DIR"
echo "💾 Backup: $BACKUP_DIR"

# Create backup directory
mkdir -p "$BACKUP_DIR"
cp -r "$TARGET_DIR"/* "$BACKUP_DIR/" 2>/dev/null

echo "✅ Backup created"

# Function to convert and optimize image
convert_image() {
    local source_file="$1"
    local target_file="$2"
    local filename=$(basename "$target_file" .jpg)
    
    echo "  📷 Processing: $filename"
    
    # Convert to jpg with proper sizing and quality
    # Using ImageMagick's convert command
    if command -v magick &> /dev/null; then
        # ImageMagick 7.x
        magick "$source_file" \
            -resize "${TARGET_WIDTH}x${TARGET_HEIGHT}^" \
            -gravity center \
            -extent "${TARGET_WIDTH}x${TARGET_HEIGHT}" \
            -quality 85 \
            -strip \
            "$target_file"
    elif command -v convert &> /dev/null; then
        # ImageMagick 6.x
        convert "$source_file" \
            -resize "${TARGET_WIDTH}x${TARGET_HEIGHT}^" \
            -gravity center \
            -extent "${TARGET_WIDTH}x${TARGET_HEIGHT}" \
            -quality 85 \
            -strip \
            "$target_file"
    elif command -v sips &> /dev/null; then
        # macOS built-in sips as fallback
        # First convert format if needed
        local temp_file="/tmp/${filename}_temp.jpg"
        sips -s format jpeg "$source_file" --out "$temp_file" &>/dev/null
        # Then resize
        sips -z $TARGET_HEIGHT $TARGET_WIDTH "$temp_file" --out "$target_file" &>/dev/null
        rm -f "$temp_file"
    else
        echo "    ⚠️  No image converter found, copying as-is"
        cp "$source_file" "$target_file"
    fi
}

# Process each replacement image
echo ""
echo "🔄 Processing replacement images..."

# Direct replacements (same name)
for image in "$SOURCE_DIR"/*.{jpg,jpeg,webp,png}; do
    [ -f "$image" ] || continue
    
    filename=$(basename "$image")
    base_name="${filename%.*}"
    
    # Map special cases
    case "$base_name" in
        "kids_leadership")
            target_name="leadership.jpg"
            ;;
        "kids_music")
            target_name="music.jpg"
            ;;
        "kids_nature")
            target_name="nature.jpg"
            ;;
        "kids_playground")
            target_name="playground.jpg"
            ;;
        "kids_pottery")
            target_name="pottery.jpg"
            ;;
        "kids_preschool")
            target_name="preschool.jpg"
            ;;
        "kids_recreation_center")
            target_name="recreation_center.jpg"
            ;;
        "kids_science")
            target_name="science.jpg"
            ;;
        "kids_sports_general")
            target_name="sports_general.jpg"
            ;;
        "kids_water_safety")
            target_name="water_safety.jpg"
            ;;
        "diving_pool")
            target_name="diving.jpg"
            ;;
        "scuba_diving")
            # Skip scuba diving as we don't have that activity
            continue
            ;;
        "camps")
            target_name="summer_camp.jpg"
            ;;
        *)
            target_name="${base_name}.jpg"
            ;;
    esac
    
    target_path="$TARGET_DIR/$target_name"
    convert_image "$image" "$target_path"
done

# Handle images that don't have replacements - keep originals for these
echo ""
echo "📋 Checking for missing replacements..."

# List of all expected activity images
expected_images=(
    "arts_crafts.jpg"
    "badminton.jpg"
    "ballet.jpg"
    "baseball.jpg"
    "basketball.jpg"
    "climbing.jpg"
    "community_center.jpg"
    "cooking.jpg"
    "crafts.jpg"
    "dance.jpg"
    "diving.jpg"
    "drums.jpg"
    "early_years.jpg"
    "family_fun.jpg"
    "fitness.jpg"
    "guitar.jpg"
    "gym.jpg"
    "hiking.jpg"
    "hip_hop_dance.jpg"
    "hockey.jpg"
    "ice_skating.jpg"
    "karate.jpg"
    "kids_activities.jpg"
    "kids_night_out.jpg"
    "language.jpg"
    "leadership.jpg"
    "martial_arts.jpg"
    "music.jpg"
    "nature.jpg"
    "outdoor.jpg"
    "painting.jpg"
    "piano.jpg"
    "playground.jpg"
    "pottery.jpg"
    "preschool.jpg"
    "racquet_sports.jpg"
    "recreation_center.jpg"
    "running.jpg"
    "science.jpg"
    "skateboarding.jpg"
    "skiing.jpg"
    "soccer.jpg"
    "sports_general.jpg"
    "stem.jpg"
    "summer_camp.jpg"
    "swimming.jpg"
    "tennis.jpg"
    "toddler_play.jpg"
    "volleyball.jpg"
    "water_safety.jpg"
    "yoga.jpg"
    "youth_activities.jpg"
)

# Check which images weren't replaced and restore from backup if needed
for expected in "${expected_images[@]}"; do
    if [ ! -f "$TARGET_DIR/$expected" ]; then
        if [ -f "$BACKUP_DIR/$expected" ]; then
            echo "  ↩️  Restoring original: $expected"
            cp "$BACKUP_DIR/$expected" "$TARGET_DIR/$expected"
        else
            echo "  ⚠️  Missing: $expected"
        fi
    fi
done

# Remove the backup skiing file if it exists
rm -f "$TARGET_DIR/skiing_backup.jpg"

echo ""
echo "✅ Image replacement complete!"
echo "📊 Summary:"
echo "  - Images processed: $(ls -1 $TARGET_DIR/*.jpg 2>/dev/null | wc -l | tr -d ' ')"
echo "  - Backup location: $BACKUP_DIR"