#!/usr/bin/env ruby
# This script fixes the folder references in the Xcode project to use correct relative paths
# Run with: ruby scripts/utils/fix-xcode-folder-references.rb

require 'xcodeproj'

project_path = 'ios/KidsActivityTracker.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Get the main group
main_group = project.main_group

# Folders to fix with their relative paths from the ios directory
folders_to_fix = {
  'docs' => '../docs',
  'scripts' => '../scripts', 
  'backend' => '../backend',
  'tests' => '../tests',
  'src' => '../src'
}

# Remove existing incorrect references
folders_to_fix.each do |folder_name, _|
  existing = main_group.children.find { |child| child.path == folder_name || child.path == "../#{folder_name}" }
  if existing
    puts "Removing incorrect reference for: #{folder_name}"
    existing.remove_from_project
  end
end

# Add folders with correct relative paths from ios directory
folders_to_fix.each do |folder_name, relative_path|
  full_path = File.expand_path(relative_path, File.dirname(project_path))
  next unless Dir.exist?(full_path)
  
  puts "Adding correct folder reference for: #{folder_name} -> #{relative_path}"
  
  # Create a folder reference with the correct relative path
  folder_ref = main_group.new_reference(relative_path)
  folder_ref.name = folder_name  # Display name in Xcode
  folder_ref.last_known_file_type = 'folder'
  folder_ref.source_tree = '<group>'  # Use relative to group
end

# Save the project
project.save

puts "\nSuccessfully fixed Xcode folder references!"
puts "The folders should now appear blue (not red) in Xcode."
puts "You should be able to navigate into them and see all files."