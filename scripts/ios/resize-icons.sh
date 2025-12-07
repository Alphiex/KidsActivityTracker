#!/bin/bash

# iOS App Icon Resizer Script
# Usage: ./resize-icons.sh <path-to-1024x1024-icon.png> <output-directory>

if [ "$#" -ne 2 ]; then
    echo "Usage: ./resize-icons.sh <input-icon-1024.png> <output-directory>"
    echo "Example: ./resize-icons.sh my-icon.png set-01-playful-calendar/"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_DIR="$2"

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: Input file '$INPUT_FILE' not found!"
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Define all required iOS icon sizes
declare -a SIZES=(1024 512 256 180 167 152 120 87 80 76 60 58 40 29 20)

echo "Resizing icon for iOS app..."
echo "Input: $INPUT_FILE"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Resize to all required sizes
for SIZE in "${SIZES[@]}"
do
    OUTPUT_FILE="$OUTPUT_DIR/icon-${SIZE}.png"
    echo "Creating ${SIZE}x${SIZE}..."
    sips -z $SIZE $SIZE "$INPUT_FILE" --out "$OUTPUT_FILE" > /dev/null 2>&1

    if [ $? -eq 0 ]; then
        echo "✓ Created: $OUTPUT_FILE"
    else
        echo "✗ Failed to create: $OUTPUT_FILE"
    fi
done

# Also create @2x and @3x versions for common sizes
echo ""
echo "Creating @2x and @3x versions..."

# iPhone App Icon (60pt)
sips -z 120 120 "$INPUT_FILE" --out "$OUTPUT_DIR/icon-60@2x.png" > /dev/null 2>&1
sips -z 180 180 "$INPUT_FILE" --out "$OUTPUT_DIR/icon-60@3x.png" > /dev/null 2>&1

# Settings Icon (29pt)
sips -z 58 58 "$INPUT_FILE" --out "$OUTPUT_DIR/icon-29@2x.png" > /dev/null 2>&1
sips -z 87 87 "$INPUT_FILE" --out "$OUTPUT_DIR/icon-29@3x.png" > /dev/null 2>&1

# Spotlight Icon (40pt)
sips -z 80 80 "$INPUT_FILE" --out "$OUTPUT_DIR/icon-40@2x.png" > /dev/null 2>&1
sips -z 120 120 "$INPUT_FILE" --out "$OUTPUT_DIR/icon-40@3x.png" > /dev/null 2>&1

echo ""
echo "✓ All icons created successfully!"
echo "Total files created: $(ls -1 $OUTPUT_DIR | wc -l)"
echo ""
echo "Ready to use in iOS project!"
