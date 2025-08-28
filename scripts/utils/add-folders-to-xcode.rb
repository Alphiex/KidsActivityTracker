#!/usr/bin/env ruby
# This script adds folder references to the Xcode project for better visibility
# Run with: ruby scripts/utils/add-folders-to-xcode.rb

require 'xcodeproj'

project_path = 'ios/KidsActivityTracker.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Get the main group
main_group = project.main_group

# Folders to add as references (not groups)
folders_to_add = [
  'docs',
  'scripts', 
  'backend',
  'tests',
  'src'
]

# Remove existing references if they exist
folders_to_add.each do |folder|
  existing = main_group.children.find { |child| child.path == folder }
  existing.remove_from_project if existing
end

# Add folders as folder references (blue folders in Xcode)
folders_to_add.each do |folder|
  next unless Dir.exist?(folder)
  
  puts "Adding folder reference for: #{folder}"
  
  # Create a folder reference (not a group)
  folder_ref = main_group.new_reference(folder)
  folder_ref.last_known_file_type = 'folder'
  
  # Don't add to any build phase - these are just for visibility
end

# Sort the main group children alphabetically
# main_group.sort_by_type! # This method doesn't exist in older versions

# Save the project
project.save

puts "Successfully updated Xcode project with folder references!"
puts "Open the project in Xcode to see all folders in the navigator."
puts "Note: These folders won't be compiled, they're just for visibility."