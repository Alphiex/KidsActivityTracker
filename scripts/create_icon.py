#!/usr/bin/env python3

import os
from PIL import Image, ImageDraw, ImageFont
import math

def create_app_icon(size):
    """Create an app icon with tent and stars on blue gradient background"""
    # Create new image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Create gradient background
    for y in range(size):
        # Calculate gradient color
        ratio = y / size
        r = int(63 + (48 - 63) * ratio)  # 3F to 30
        g = int(81 + (63 - 81) * ratio)  # 51 to 3F
        b = int(181 + (159 - 181) * ratio)  # B5 to 9F
        
        # Draw gradient line
        draw.rectangle([(0, y), (size, y+1)], fill=(r, g, b, 255))
    
    # Add rounded corners
    corner_radius = size // 5
    
    # Create mask for rounded corners
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([(0, 0), (size, size)], radius=corner_radius, fill=255)
    
    # Apply mask
    output = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    output.paste(img, (0, 0))
    output.putalpha(mask)
    
    # Redraw on output
    draw = ImageDraw.Draw(output)
    
    # Draw tent
    tent_width = size // 2
    tent_height = int(size * 0.35)
    tent_x = size // 2
    tent_y = int(size * 0.6)
    
    # Main tent triangle
    tent_points = [
        (tent_x - tent_width//2, tent_y),
        (tent_x, tent_y - tent_height),
        (tent_x + tent_width//2, tent_y)
    ]
    draw.polygon(tent_points, fill=(255, 255, 255, 255))
    
    # Tent opening
    opening_width = tent_width // 2
    opening_height = tent_height // 2
    opening_points = [
        (tent_x - opening_width//2, tent_y),
        (tent_x, tent_y - opening_height),
        (tent_x + opening_width//2, tent_y)
    ]
    draw.polygon(opening_points, fill=(48, 63, 159, 255))
    
    # Draw stars
    def draw_star(x, y, radius):
        points = []
        for i in range(10):
            angle = math.pi * i / 5 - math.pi / 2
            if i % 2 == 0:
                r = radius
            else:
                r = radius * 0.5
            px = x + r * math.cos(angle)
            py = y + r * math.sin(angle)
            points.append((px, py))
        draw.polygon(points, fill=(255, 215, 0, 255))
    
    # Draw multiple stars
    star_positions = [
        (size * 0.2, size * 0.2, size * 0.08),
        (size * 0.8, size * 0.15, size * 0.06),
        (size * 0.15, size * 0.8, size * 0.06),
        (size * 0.85, size * 0.85, size * 0.08)
    ]
    
    for x, y, radius in star_positions:
        draw_star(x, y, radius)
    
    return output

def main():
    # Create directories if they don't exist
    ios_path = os.path.join(os.path.dirname(__file__), '../ios/KidsCampTracker/Images.xcassets/AppIcon.appiconset')
    android_path = os.path.join(os.path.dirname(__file__), '../android/app/src/main/res')
    
    # iOS sizes
    ios_sizes = [
        (40, 'icon-40.png'),
        (60, 'icon-60.png'),
        (58, 'icon-58.png'),
        (87, 'icon-87.png'),
        (80, 'icon-80.png'),
        (120, 'icon-120.png'),
        (180, 'icon-180.png'),
        (1024, 'icon-1024.png')
    ]
    
    # Generate iOS icons
    print("Generating iOS icons...")
    for size, filename in ios_sizes:
        icon = create_app_icon(size)
        icon.save(os.path.join(ios_path, filename), 'PNG')
        print(f"Created {filename} ({size}x{size})")
    
    # Update Contents.json
    contents = {
        "images": [
            {"size": "20x20", "idiom": "iphone", "filename": "icon-40.png", "scale": "2x"},
            {"size": "20x20", "idiom": "iphone", "filename": "icon-60.png", "scale": "3x"},
            {"size": "29x29", "idiom": "iphone", "filename": "icon-58.png", "scale": "2x"},
            {"size": "29x29", "idiom": "iphone", "filename": "icon-87.png", "scale": "3x"},
            {"size": "40x40", "idiom": "iphone", "filename": "icon-80.png", "scale": "2x"},
            {"size": "40x40", "idiom": "iphone", "filename": "icon-120.png", "scale": "3x"},
            {"size": "60x60", "idiom": "iphone", "filename": "icon-120.png", "scale": "2x"},
            {"size": "60x60", "idiom": "iphone", "filename": "icon-180.png", "scale": "3x"},
            {"size": "1024x1024", "idiom": "ios-marketing", "filename": "icon-1024.png", "scale": "1x"}
        ],
        "info": {"version": 1, "author": "xcode"}
    }
    
    import json
    with open(os.path.join(ios_path, 'Contents.json'), 'w') as f:
        json.dump(contents, f, indent=2)
    
    # Android sizes
    android_sizes = [
        (48, 'mipmap-mdpi'),
        (72, 'mipmap-hdpi'),
        (96, 'mipmap-xhdpi'),
        (144, 'mipmap-xxhdpi'),
        (192, 'mipmap-xxxhdpi')
    ]
    
    # Generate Android icons
    print("\nGenerating Android icons...")
    for size, folder in android_sizes:
        folder_path = os.path.join(android_path, folder)
        os.makedirs(folder_path, exist_ok=True)
        
        icon = create_app_icon(size)
        icon.save(os.path.join(folder_path, 'ic_launcher.png'), 'PNG')
        icon.save(os.path.join(folder_path, 'ic_launcher_round.png'), 'PNG')
        print(f"Created {folder}/ic_launcher.png ({size}x{size})")
    
    print("\nApp icons generated successfully!")

if __name__ == "__main__":
    main()