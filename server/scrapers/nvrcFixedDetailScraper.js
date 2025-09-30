const puppeteer = require('puppeteer');

async function extractComprehensiveDetails(page) {
  // Wait for content to load
  try {
    await page.waitForSelector('body', { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (e) {
    console.warn('Timeout waiting for content');
  }
  
  return await page.evaluate(() => {
    const data = {
      // Basic info
      name: '',
      courseId: '',  // This should be the SITE's course ID (e.g., 00371053)
      internalCourseId: '', // This is our internal ID from the URL
      
      // Dates and times
      dates: '',  // Full date string like "10/18/25"
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      registrationDate: '',
      registrationEndDate: '',
      registrationEndTime: '',
      
      // Costs
      cost: 0,
      costIncludesTax: false,
      taxAmount: 0,
      
      // Availability
      spotsAvailable: 0,
      totalSpots: 0,
      registrationStatus: '',
      registrationButtonText: '',
      
      // Location
      location: '',
      facility: '',
      fullAddress: '',
      
      // Details
      fullDescription: '',
      instructor: '',
      whatToBring: '',
      prerequisites: [],
      ageRestrictions: '',
      requiredExtras: [],
      
      // Sessions
      sessions: []
    };
    
    // Get all text content for pattern matching
    const pageText = document.body.innerText;
    
    // Extract course name - look for main title
    const titleElement = document.querySelector('h1, .bm-course-primary-event-name, .bm-event-name-h1');
    if (titleElement) {
      data.name = titleElement.textContent.trim();
    }
    
    // Extract SITE's Course ID (e.g., 00371053) - NOT the internal ID
    const courseIdMatch = pageText.match(/Course\s*ID[\s:\n]*(\d+)/i);
    if (courseIdMatch) {
      data.courseId = courseIdMatch[1];  // This will be 00371053
    }
    
    // Get internal course ID from URL
    const urlMatch = window.location.href.match(/courseId=([a-f0-9-]+)/i);
    if (urlMatch) {
      data.internalCourseId = urlMatch[1];
    }
    
    // Extract date directly from the page (10/18/25)
    const dateMatch = pageText.match(/(\d{1,2}\/\d{2}\/\d{2})/);
    if (dateMatch) {
      data.dates = dateMatch[1];
      data.startDate = dateMatch[1];
      data.endDate = dateMatch[1]; // Single date course
    }
    
    // Extract time (09:00 am - 04:00 pm)
    const timeMatch = pageText.match(/(\d{1,2}:\d{2}\s*(?:am|pm))\s*-\s*(\d{1,2}:\d{2}\s*(?:am|pm))/i);
    if (timeMatch) {
      data.startTime = timeMatch[1];
      data.endTime = timeMatch[2];
    }
    
    // Extract spots available (11 spot(s) left)
    const spotsMatch = pageText.match(/(\d+)\s*spot\(s\)\s*left/i);
    if (spotsMatch) {
      data.spotsAvailable = parseInt(spotsMatch[1]);
    }
    
    // Extract registration status - check for closed/full status first
    if (pageText.includes('Registration is closed') ||
        pageText.includes('Registration closed') ||
        pageText.includes('Course is closed') ||
        pageText.includes('Course is full')) {
      data.registrationStatus = 'Closed';
    } else if (pageText.includes('Waitlist') || pageText.includes('Wait list')) {
      data.registrationStatus = 'Waitlist';
    } else {
      // Check for active registration button
      const bookNowButton = Array.from(document.querySelectorAll('button, a')).find(el =>
        el.textContent.includes('BOOK NOW') || el.textContent.includes('Register')
      );
      if (bookNowButton) {
        data.registrationStatus = 'Open';
        data.registrationButtonText = bookNowButton.textContent.trim();
      } else if (spotsMatch && parseInt(spotsMatch[1]) > 0) {
        data.registrationStatus = 'Open';
      } else if (pageText.includes('Closed') || pageText.includes('Full')) {
        data.registrationStatus = 'Closed';
      } else {
        data.registrationStatus = 'Unknown';
      }
    }
    
    // Extract registration end date/time
    const regEndMatch = pageText.match(/Registration ends (?:on\s*)?(\d{1,2}\/\d{2}\/\d{2})\s*at\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    if (regEndMatch) {
      data.registrationEndDate = regEndMatch[1];
      data.registrationEndTime = regEndMatch[2];
      data.registrationDate = regEndMatch[1] + ' ' + regEndMatch[2];
    }
    
    // Extract cost - try multiple patterns
    let costFound = false;
    
    // Pattern 1: Look for price tag elements with class bm-price-tag
    const priceElements = document.querySelectorAll('.bm-price-tag');
    if (priceElements.length > 0) {
      const priceText = priceElements[0].textContent.trim();
      const priceMatch = priceText.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
      if (priceMatch) {
        data.cost = parseFloat(priceMatch[1].replace(/,/g, ''));
        costFound = true;
      }
    }
    
    // Pattern 2: Course Fee pattern (fallback)
    if (!costFound) {
      const costMatch = pageText.match(/Course Fee[^$]*\$(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
      if (costMatch) {
        data.cost = parseFloat(costMatch[1].replace(/,/g, ''));
        costFound = true;
      }
    }
    
    // Pattern 3: Look for any price pattern with dollar sign
    if (!costFound) {
      // Find all dollar amounts and pick the most likely course fee
      const dollarAmounts = pageText.matchAll(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g);
      const amounts = [];
      for (const match of dollarAmounts) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        // Skip very small amounts (likely not course fees)
        if (amount > 5) {
          amounts.push({ amount, context: pageText.substring(pageText.indexOf(match[0]) - 20, pageText.indexOf(match[0]) + 50) });
        }
      }
      
      // Look for amounts near words like "fee", "cost", "price", or in fee tables
      for (const item of amounts) {
        if (item.context.match(/fee|cost|price|lesson|program|course/i)) {
          data.cost = item.amount;
          costFound = true;
          break;
        }
      }
      
      // If still not found, take the first reasonable amount
      if (!costFound && amounts.length > 0) {
        data.cost = amounts[0].amount;
      }
    }
    
    // Check if cost includes tax - look for nearby tax indicators
    const taxIndicator = document.querySelector('.bm-taxable-state-tag');
    if (taxIndicator || pageText.includes('Plus Tax') || pageText.includes('+ tax') || pageText.includes('+ Tax')) {
      data.costIncludesTax = false;
    } else {
      data.costIncludesTax = true;
    }
    
    // Extract required extras
    const extrasSection = pageText.match(/Required Extras[^]*?(?=Course Dates|About this Course|$)/i);
    if (extrasSection) {
      const extrasText = extrasSection[0];
      // Match pattern like "Babysitters Training Manual x1 $10.00"
      const extraMatches = extrasText.matchAll(/([^\n]+?)\s*x?\d*\s*\$(\d+(?:\.\d{2})?)/g);
      for (const match of extraMatches) {
        if (match[1] && !match[1].includes('Required Extras')) {
          data.requiredExtras.push({
            name: match[1].trim(),
            cost: `$${match[2]}`,
            required: true
          });
        }
      }
    }
    
    // Extract sessions
    const sessionsMatch = pageText.match(/(\d+)\s*sessions?/i);
    if (sessionsMatch) {
      const sessionCount = parseInt(sessionsMatch[1]);
      
      // Look for session details like "Sat 10/18/25 09:00 AM - 04:00 PM Second Floor Multipurpose Room"
      const sessionPattern = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^\n]*(\d{1,2}\/\d{2}\/\d{2})[^\n]*(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)([^\n]*)/gi;
      const sessionMatches = pageText.matchAll(sessionPattern);
      
      let sessionNumber = 1;
      for (const match of sessionMatches) {
        data.sessions.push({
          sessionNumber: sessionNumber++,
          dayOfWeek: match[1],
          date: match[2],
          startTime: match[3],
          endTime: match[4],
          location: match[5].trim() || data.location,
          subLocation: match[5].trim()
        });
      }
    }
    
    // Extract description from "About this Course" section
    const aboutMatch = pageText.match(/About this Course\s*([^]+?)(?=Show Map|Course ID|Restrictions|$)/i);
    if (aboutMatch) {
      data.fullDescription = aboutMatch[1].trim();
    }
    
    // Extract location (Parkgate Community Centre)
    const locationMatch = pageText.match(/([^,\n]*(Centre|Center)[^,\n]*)/i);
    if (locationMatch) {
      data.location = locationMatch[1].trim();
      data.facility = locationMatch[1].trim();
    }
    
    // Extract age restrictions
    const ageMatch = pageText.match(/Age Restriction[s]?\s*(\d+)\s*to\s*(\d+)/i);
    if (ageMatch) {
      data.ageRestrictions = `${ageMatch[1]} to ${ageMatch[2]} years`;
    }
    
    // Look for instructor - must be preceded by "Instructor" label and followed by a name
    // Pattern looks for "Instructor" followed by optional colon/space, then a capitalized name
    const instructorSection = document.querySelector('.bm-instructor-name');
    if (instructorSection) {
      data.instructor = instructorSection.textContent.trim();
    } else {
      // Fallback: Look for pattern like "Instructor: John Doe" or "Instructor John Doe"
      // Must have capital letter after "Instructor" to indicate a name
      const instructorMatch = pageText.match(/\bInstructor\s*:?\s*([A-Z][a-zA-Z\s\-\.]+?)(?=\n|$|[,])/);
      if (instructorMatch) {
        const potentialName = instructorMatch[1].trim();
        // Validate it looks like a name (at least 2 characters, not a sentence)
        if (potentialName.length >= 2 && potentialName.length <= 50 && !potentialName.includes(' will ') && !potentialName.includes(' are ')) {
          data.instructor = potentialName;
        }
      }
    }
    
    return data;
  });
}

async function scrapeCourseDetails(courseUrl) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.goto(courseUrl, { waitUntil: 'networkidle0' });
    
    const details = await extractComprehensiveDetails(page);
    return details;
  } finally {
    await browser.close();
  }
}

module.exports = {
  extractComprehensiveDetails,
  scrapeCourseDetails
};