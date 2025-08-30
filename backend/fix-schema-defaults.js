const fs = require('fs');

// Read schema file
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Add @default(uuid()) to all id fields that don't have it
schema = schema.replace(/^(\s+id\s+String\s+@id)(?!.*@default)/gm, '$1 @default(uuid())');

// Add @default(now()) @updatedAt to all updatedAt fields
schema = schema.replace(/^(\s+updatedAt\s+DateTime)(?!.*@default)/gm, '$1               @default(now()) @updatedAt');

// Write back
fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema fixed!');