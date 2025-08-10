const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function checkActivity() {
  const activity = await prisma.activity.findFirst({
    where: {
      fullDescription: { not: null },
      directRegistrationUrl: { not: null }
    }
  });
  
  if (activity) {
    console.log('Found activity with enhanced data:');
    console.log('Name:', activity.name);
    console.log('Has fullDescription:', Boolean(activity.fullDescription));
    console.log('Has directRegistrationUrl:', Boolean(activity.directRegistrationUrl));
    console.log('Has schedule:', Boolean(activity.schedule));
    console.log('Has instructor:', Boolean(activity.instructor));
    console.log('Has prerequisites:', Boolean(activity.prerequisites));
    console.log('Has whatToBring:', Boolean(activity.whatToBring));
    console.log('Registration URL:', activity.directRegistrationUrl);
  } else {
    console.log('No activities found with enhanced data');
  }
  
  await prisma.$disconnect();
}

checkActivity();