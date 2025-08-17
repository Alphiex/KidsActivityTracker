#!/bin/bash
# Generate Prisma client with Alpine Linux binary target

# Create a modified schema with binaryTargets
cat > schema-temp.prisma << 'EOF'
// This is the enhanced Prisma schema for Kids Activity Tracker v2
// with user accounts, children profiles, and activity sharing

generator client {
  provider = "prisma-client-js"
  output   = "../generated/prisma"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
EOF

# Append everything after line 7 from the original schema
tail -n +8 prisma/schema.prisma >> schema-temp.prisma

# Generate with the modified schema
npx prisma generate --schema=./schema-temp.prisma

# Clean up
rm schema-temp.prisma

echo "Prisma client generated with Alpine Linux support"