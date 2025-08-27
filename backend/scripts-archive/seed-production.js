const { PrismaClient } = require('./generated/prisma');

async function seedProduction() {
  const prisma = new PrismaClient();
  
  try {
    // Seed categories
    console.log('🌱 Seeding categories...');
    const categories = [
      { code: 'baby-parent', name: 'Baby & Parent', ageMin: 0, ageMax: 1, requiresParent: true },
      { code: 'preschool', name: 'Preschool', ageMin: 2, ageMax: 4, requiresParent: false },
      { code: 'school-age', name: 'School Age', ageMin: 5, ageMax: 13, requiresParent: false },
      { code: 'teen', name: 'Teen', ageMin: 14, ageMax: 18, requiresParent: false },
      { code: 'all-ages', name: 'All Ages', ageMin: 0, ageMax: 99, requiresParent: false }
    ];
    
    for (const cat of categories) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Category" (id, code, name, "ageMin", "ageMax", "requiresParent")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)
        ON CONFLICT (code) DO NOTHING
      `, cat.code, cat.name, cat.ageMin, cat.ageMax, cat.requiresParent);
    }
    
    const categoryCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Category"`;
    console.log(`✅ Categories seeded: ${categoryCount[0].count}`);
    
    // Seed activity types
    console.log('🌱 Seeding activity types...');
    const activityTypes = [
      { name: 'Swimming & Aquatics', order: 1 },
      { name: 'Sports - Team', order: 2 },
      { name: 'Sports - Individual', order: 3 },
      { name: 'Arts & Crafts', order: 4 },
      { name: 'Dance', order: 5 },
      { name: 'Music', order: 6 },
      { name: 'Martial Arts', order: 7 },
      { name: 'Gymnastics', order: 8 },
      { name: 'Ice Sports', order: 9 },
      { name: 'Camps', order: 10 },
      { name: 'Fitness', order: 11 },
      { name: 'Educational', order: 12 },
      { name: 'Parent & Child', order: 13 },
      { name: 'Special Events', order: 14 },
      { name: 'Birthday Parties', order: 15 },
      { name: 'Nature & Outdoor', order: 16 },
      { name: 'Science & Tech', order: 17 },
      { name: 'Drama & Theatre', order: 18 },
      { name: 'Language', order: 19 },
      { name: 'Cooking', order: 20 },
      { name: 'Games & Hobbies', order: 21 },
      { name: 'Social Skills', order: 22 },
      { name: 'Life Skills', order: 23 },
      { name: 'Cultural', order: 24 },
      { name: 'Volunteer', order: 25 },
      { name: 'Other Activity', order: 99 }
    ];
    
    for (const type of activityTypes) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "ActivityType" (id, name, "displayOrder")
        VALUES (gen_random_uuid()::text, $1, $2)
        ON CONFLICT (name) DO NOTHING
      `, type.name, type.order);
    }
    
    const typeCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "ActivityType"`;
    console.log(`✅ Activity types seeded: ${typeCount[0].count}`);
    
    // Add some common subtypes for Swimming & Aquatics
    console.log('🌱 Seeding activity subtypes...');
    const swimTypeId = await prisma.$queryRaw`
      SELECT id FROM "ActivityType" WHERE name = 'Swimming & Aquatics'
    `;
    
    if (swimTypeId[0]) {
      const swimSubtypes = [
        'Learn to Swim', 'Parent & Tot Swim', 'Aqua Fitness', 
        'Competitive Swimming', 'Diving', 'Water Polo', 
        'Synchronized Swimming', 'Lifeguarding'
      ];
      
      for (const subtype of swimSubtypes) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "ActivitySubtype" (id, name, "activityTypeId")
          VALUES (gen_random_uuid()::text, $1, $2)
          ON CONFLICT DO NOTHING
        `, subtype, swimTypeId[0].id);
      }
    }
    
    const subtypeCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "ActivitySubtype"`;
    console.log(`✅ Activity subtypes seeded: ${subtypeCount[0].count}`);
    
    console.log('\n✨ Production seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Seeding error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedProduction().catch(console.error);