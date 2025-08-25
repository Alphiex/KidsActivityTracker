// Helper functions for location normalization

function normalizeLocationName(name) {
  if (!name) return '';
  
  // Basic normalization
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .replace(/recreation\s+centre/gi, 'rec centre')
    .replace(/community\s+centre/gi, 'comm centre')
    .replace(/recreation/gi, 'rec')
    .replace(/community/gi, 'comm');
}

function determineFacilityType(locationName) {
  if (!locationName) return 'OTHER';
  
  const name = locationName.toLowerCase();
  
  if (name.includes('pool') || name.includes('aquatic')) {
    return 'POOL';
  } else if (name.includes('arena') || name.includes('ice')) {
    return 'ARENA';
  } else if (name.includes('rec') || name.includes('recreation')) {
    return 'RECREATION_CENTRE';
  } else if (name.includes('comm') || name.includes('community')) {
    return 'COMMUNITY_CENTRE';
  } else if (name.includes('park')) {
    return 'PARK';
  } else if (name.includes('field') || name.includes('sport')) {
    return 'SPORTS_FIELD';
  } else if (name.includes('gym')) {
    return 'GYM';
  } else {
    return 'OTHER';
  }
}

module.exports = {
  normalizeLocationName,
  determineFacilityType
};