#!/bin/bash

echo "Generating app icons for Kids Camp Tracker..."

# iOS icon sizes
echo "Creating iOS icons..."
convert app_icon.svg -resize 40x40 ios/KidsCampTracker/Images.xcassets/AppIcon.appiconset/icon-40.png
convert app_icon.svg -resize 60x60 ios/KidsCampTracker/Images.xcassets/AppIcon.appiconset/icon-60.png
convert app_icon.svg -resize 58x58 ios/KidsCampTracker/Images.xcassets/AppIcon.appiconset/icon-58.png
convert app_icon.svg -resize 87x87 ios/KidsCampTracker/Images.xcassets/AppIcon.appiconset/icon-87.png
convert app_icon.svg -resize 80x80 ios/KidsCampTracker/Images.xcassets/AppIcon.appiconset/icon-80.png
convert app_icon.svg -resize 120x120 ios/KidsCampTracker/Images.xcassets/AppIcon.appiconset/icon-120.png
convert app_icon.svg -resize 180x180 ios/KidsCampTracker/Images.xcassets/AppIcon.appiconset/icon-180.png
convert app_icon.svg -resize 1024x1024 ios/KidsCampTracker/Images.xcassets/AppIcon.appiconset/icon-1024.png

# Android icon sizes
echo "Creating Android icons..."
mkdir -p android/app/src/main/res/mipmap-mdpi
mkdir -p android/app/src/main/res/mipmap-hdpi
mkdir -p android/app/src/main/res/mipmap-xhdpi
mkdir -p android/app/src/main/res/mipmap-xxhdpi
mkdir -p android/app/src/main/res/mipmap-xxxhdpi

convert app_icon.svg -resize 48x48 android/app/src/main/res/mipmap-mdpi/ic_launcher.png
convert app_icon.svg -resize 48x48 android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png

convert app_icon.svg -resize 72x72 android/app/src/main/res/mipmap-hdpi/ic_launcher.png
convert app_icon.svg -resize 72x72 android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png

convert app_icon.svg -resize 96x96 android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
convert app_icon.svg -resize 96x96 android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png

convert app_icon.svg -resize 144x144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
convert app_icon.svg -resize 144x144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png

convert app_icon.svg -resize 192x192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
convert app_icon.svg -resize 192x192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png

echo "Icons generated successfully!"