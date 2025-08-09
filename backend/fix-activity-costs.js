const { PrismaClient } = require('./generated/prisma');
const puppeteer = require('puppeteer');

const prisma = new PrismaClient();

async function getCorrectPrice(url) {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait a bit for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try to extract price from multiple possible locations
    const priceInfo = await page.evaluate(() => {
      // Look for price in common locations
      const priceSelectors = [
        '.bm-price-tag',
        '.price-tag',
        '[class*="price"]',
        '[class*="cost"]',
        '[class*="fee"]'
      ];
      
      for (const selector of priceSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent.trim();
          const match = text.match(/\$([0-9,]+(?:\.\d{1,2})?)/);
          if (match) {
            return {
              selector: selector,
              text: text,
              price: parseFloat(match[1].replace(/,/g, ''))
            };
          }
        }
      }
      
      // Also check in JSON data if available
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent;
        if (content.includes('"Prices"')) {
          const pricesMatch = content.match(/"Prices"\s*:\s*\[(.*?)\]/);
          if (pricesMatch) {
            const amountMatch = pricesMatch[1].match(/"Amount"\s*:\s*([0-9.]+)/);
            if (amountMatch) {
              return {
                selector: 'script',
                text: 'From JSON data',
                price: parseFloat(amountMatch[1])
              };
            }
          }
        }
      }
      
      return null;
    });
    
    await browser.close();
    return priceInfo;
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function fixActivityCosts() {
  console.log('🔍 Finding activities with potentially incorrect costs...\n');
  
  // Find activities with suspiciously low costs
  const suspiciousActivities = await prisma.activity.findMany({
    where: {
      AND: [
        { cost: { lt: 10 } },
        { cost: { gt: 0 } },
        { registrationUrl: { not: null } }
      ]
    },
    select: {
      id: true,
      name: true,
      cost: true,
      registrationUrl: true,
      courseId: true
    },
    take: 5 // Start with just 5 for testing
  });
  
  console.log(`Found ${suspiciousActivities.length} activities with costs < $10\n`);
  
  for (const activity of suspiciousActivities) {
    console.log(`\nChecking: ${activity.name}`);
    console.log(`Current cost: $${activity.cost}`);
    console.log(`Course ID: ${activity.courseId}`);
    
    try {
      const priceInfo = await getCorrectPrice(activity.registrationUrl);
      
      if (priceInfo && priceInfo.price > activity.cost) {
        console.log(`✅ Found correct price: $${priceInfo.price}`);
        console.log(`   Source: ${priceInfo.selector}`);
        
        // Update the activity with correct price
        await prisma.activity.update({
          where: { id: activity.id },
          data: { 
            cost: priceInfo.price,
            rawData: {
              ...(activity.rawData || {}),
              cost: priceInfo.price,
              costCorrected: true,
              costCorrectedAt: new Date().toISOString()
            }
          }
        });
        
        console.log(`   Updated in database!`);
      } else {
        console.log(`❌ Could not find a higher price`);
      }
    } catch (error) {
      console.log(`❌ Error checking price: ${error.message}`);
    }
    
    // Rate limit to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n✅ Cost correction complete!');
}

fixActivityCosts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());