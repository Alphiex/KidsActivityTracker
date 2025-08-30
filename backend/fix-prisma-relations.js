const fs = require('fs');

const schemaPath = 'prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

// Fix relation names to lowercase
const fixes = [
  // Activity model relations
  { from: /ActivitySubtype\s+ActivitySubtype\?/g, to: 'activitySubtype ActivitySubtype?' },
  { from: /ActivityType\s+ActivityType\?/g, to: 'activityType ActivityType?' },
  { from: /Location\s+Location\?/g, to: 'location Location?' },
  { from: /Provider\s+Provider/g, to: 'provider Provider' },
  { from: /ActivityPrerequisite\s+ActivityPrerequisite\[\]/g, to: 'prerequisites ActivityPrerequisite[]' },
  { from: /ActivitySession\s+ActivitySession\[\]/g, to: 'sessions ActivitySession[]' },
  { from: /ChildActivity\s+ChildActivity\[\]/g, to: 'childActivities ChildActivity[]' },
  { from: /Favorite\s+Favorite\[\]/g, to: 'favorites Favorite[]' },
  
  // User model relations
  { from: /Child\s+Child\[\]/g, to: 'children Child[]' },
  
  // Other model relations
  { from: /Activity\s+Activity\[\]/g, to: 'activities Activity[]' },
  { from: /Activity\s+Activity/g, to: 'activity Activity' },
  { from: /User\s+User/g, to: 'user User' },
  { from: /Child\s+Child/g, to: 'child Child' },
  { from: /ActivityShare\s+ActivityShare/g, to: 'activityShare ActivityShare' },
];

fixes.forEach(fix => {
  schema = schema.replace(fix.from, fix.to);
});

// Fix the User relations that have suffixes
schema = schema.replace(/User_ActivityShare_sharedWithUserIdToUser/g, 'sharedWithUser');
schema = schema.replace(/User_ActivityShare_sharingUserIdToUser/g, 'sharingUser');
schema = schema.replace(/User_Invitation_recipientUserIdToUser/g, 'recipient');
schema = schema.replace(/User_Invitation_senderIdToUser/g, 'sender');

// Fix ActivityShare relations
schema = schema.replace(/ActivityShareProfile\s+ActivityShareProfile\[\]/g, 'profiles ActivityShareProfile[]');

// Fix the references in other models
schema = schema.replace(/\"ActivityShare_sharedWithUserIdToUser\"/g, '"sharedWithUser"');
schema = schema.replace(/\"ActivityShare_sharingUserIdToUser\"/g, '"sharingUser"');
schema = schema.replace(/\"Invitation_recipientUserIdToUser\"/g, '"recipient"');
schema = schema.replace(/\"Invitation_senderIdToUser\"/g, '"sender"');

fs.writeFileSync(schemaPath, schema);
console.log('Fixed Prisma schema relations');
