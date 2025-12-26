const puppeteer = require('puppeteer');

async function extractComprehensiveDetails(page) {
  // First wait for content to load
  try {
    await page.waitForSelector('.bm-course-primary-content, .event-info-column, h1', { timeout: 10000 });
  } catch (e) {
    console.warn('Main content selectors not found, proceeding anyway...');
  }
  
  return await page.evaluate(() => {
    const data = {
      // Basic info
      name: '',
      courseId: '',
      courseDetails: '',
      
      // Dates and times
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      registrationEndDate: '',
      registrationEndTime: '',
      
      // Costs
      cost: 0,
      costIncludesTax: true,
      taxAmount: 0,
      
      // Availability
      spotsAvailable: 0,
      totalSpots: 0,
      registrationStatus: '',
      
      // Location
      location: '',
      fullAddress: '',
      latitude: null,
      longitude: null,
      city: '',
      postalCode: '',
      
      // Details
      fullDescription: '',
      courseDetails: '',
      instructor: '',
      whatToBring: '',
      prerequisites: [],
      ageRestrictions: '',
      requiredExtras: [],
      
      // Sessions
      sessions: []
    };
    
    // Extract course name - look for main title
    const titleElement = document.querySelector('.bm-course-primary-event-name, .bm-event-name-h1, h1');
    if (titleElement) {
      data.name = titleElement.textContent.trim();
    }
    
    // Look for course ID - it's often in a specific element or after "Course ID" text
    const courseIdElement = Array.from(document.querySelectorAll('*')).find(el => 
      el.textContent.includes('Course ID') && el.textContent.length < 100
    );
    if (courseIdElement) {
      const idMatch = courseIdElement.textContent.match(/Course ID[:\s]*([A-Z0-9-]+)/i);
      if (idMatch) {
        data.courseId = idMatch[1];
      }
    }
    
    // Also check for barcode/activity code in the URL
    if (!data.courseId) {
      const urlMatch = window.location.href.match(/courseId=([a-f0-9-]+)/i);
      if (urlMatch) {
        data.courseId = urlMatch[1];
      }
    }
    
    // Extract dates - look for date range in event info
    const eventInfo = document.querySelector('.event-info-column');
    if (eventInfo) {
      const dateLabels = eventInfo.querySelectorAll('label');
      dateLabels.forEach(label => {
        const text = label.textContent;
        // Look for date pattern like "9/08/25 - 12/18/25"
        const dateMatch = text.match(/(\d{1,2}\/\d{2}\/\d{2})\s*-\s*(\d{1,2}\/\d{2}\/\d{2})/);
        if (dateMatch) {
          data.startDate = dateMatch[1];
          data.endDate = dateMatch[2];
        }
      });
    }
    
    // Extract time from event info
    if (eventInfo) {
      const timeLabels = eventInfo.querySelectorAll('label');
      timeLabels.forEach(label => {
        const text = label.textContent;
        // Look for time pattern like "05:30 pm - 06:55 pm"
        const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]m)\s*-\s*(\d{1,2}:\d{2}\s*[ap]m)/i);
        if (timeMatch) {
          data.startTime = timeMatch[1];
          data.endTime = timeMatch[2];
        }
      });
    }
    
    // Extract registration deadline
    const regDeadlineElement = Array.from(document.querySelectorAll('*')).find(el => 
      el.textContent.includes('Registration ends on')
    );
    
    if (regDeadlineElement) {
      const regText = regDeadlineElement.textContent;
      const regMatch = regText.match(/Registration ends on\s+(\d{1,2}\/\d{2}\/\d{2})\s+at\s+(\d{1,2}:\d{2}\s*[AP]M)/i);
      if (regMatch) {
        data.registrationEndDate = regMatch[1];
        data.registrationEndTime = regMatch[2];
      }
    }
    
    // Extract costs from fee section
    const feeSection = Array.from(document.querySelectorAll('*')).find(el => 
      el.textContent.includes('Fees') && el.tagName.match(/H[1-6]|DIV/)
    );
    
    if (feeSection && feeSection.parentElement) {
      const feeContainer = feeSection.parentElement;
      const feeText = feeContainer.textContent;
      
      // Look for price
      const costMatch = feeText.match(/\$([0-9,]+(?:\.\d{2})?)/);
      if (costMatch) {
        data.cost = parseFloat(costMatch[1].replace(',', ''));
      }
      
      // Check if tax is included
      if (feeText.toLowerCase().includes('plus tax')) {
        data.costIncludesTax = false;
      }
    }
    
    // Extract availability - look for spots in event info
    if (eventInfo) {
      const spotLabels = eventInfo.querySelectorAll('label');
      spotLabels.forEach(label => {
        const text = label.textContent;
        const spotsMatch = text.match(/(\d+)\s*spot\(s\)\s*left/i);
        if (spotsMatch) {
          data.spotsAvailable = parseInt(spotsMatch[1]);
        }
      });
    }
    
    // Extract location - look for location in about section
    const aboutSection = Array.from(document.querySelectorAll('*')).find(el => 
      el.textContent.includes('About this Course')
    );
    
    if (aboutSection && aboutSection.parentElement) {
      const locationContainer = aboutSection.parentElement;
      
      // Find location name
      const locationNameEl = locationContainer.querySelector('a, h3, h4');
      if (locationNameEl) {
        data.location = locationNameEl.textContent.trim();
      }
      
      // Find address
      const addressEls = locationContainer.querySelectorAll('div');
      addressEls.forEach(el => {
        const text = el.textContent.trim();
        if (text.match(/\d+.*(Ave|Avenue|St|Street|Road|Rd)/) && text.length < 100) {
          data.fullAddress = text;
        }
      });
    }
    
    // Alternative location extraction - look for map-related elements
    if (!data.location) {
      const mapShowLink = Array.from(document.querySelectorAll('*')).find(el => 
        el.textContent === 'Show Map' && el.tagName === 'SPAN'
      );
      
      if (mapShowLink && mapShowLink.previousElementSibling) {
        const locationEl = mapShowLink.previousElementSibling;
        if (locationEl && locationEl.textContent.trim()) {
          data.location = locationEl.textContent.trim();
        }
      }
    }
    
    // Try to find location from the map address section
    if (!data.location || !data.fullAddress) {
      const mapAddressEl = document.querySelector('.bm-map-address');
      if (mapAddressEl) {
        if (!data.location) {
          data.location = mapAddressEl.textContent.trim();
        }

        // Look for full address in subsequent divs
        let nextEl = mapAddressEl.nextElementSibling;
        while (nextEl && !data.fullAddress) {
          const text = nextEl.textContent.trim();
          if (text.match(/\d+.*(Ave|Avenue|St|Street|Road|Rd)/)) {
            data.fullAddress = text;
            break;
          }
          nextEl = nextEl.nextElementSibling;
        }
      }
    }

    // Extract location data from page HTML (PerfectMind embeds location JSON in page)
    // Format: "Street":"8880 Williams Road","City":"Richmond","PostalCode":"V7A 1G6","Latitude":49.140312,"Longitude":-123.127738
    const pageHtml = document.documentElement.outerHTML;

    // Extract coordinates - look for non-null values
    const latMatch = pageHtml.match(/["']Latitude["']\s*:\s*(-?\d+\.\d+)/i);
    const lngMatch = pageHtml.match(/["']Longitude["']\s*:\s*(-?\d+\.\d+)/i);
    if (latMatch && lngMatch) {
      data.latitude = parseFloat(latMatch[1]);
      data.longitude = parseFloat(lngMatch[1]);
    }

    // Extract city from JSON
    const cityJsonMatch = pageHtml.match(/["']City["']\s*:\s*["']([^"']+)["']/i);
    if (cityJsonMatch && cityJsonMatch[1].trim()) {
      data.city = cityJsonMatch[1].trim();
    }

    // Extract postal code from JSON
    const postalJsonMatch = pageHtml.match(/["']PostalCode["']\s*:\s*["']([A-Z]\d[A-Z]\s?\d[A-Z]\d)[\s"']/i);
    if (postalJsonMatch) {
      data.postalCode = postalJsonMatch[1].trim().toUpperCase();
    }

    // Extract street address from JSON
    const streetJsonMatch = pageHtml.match(/["']Street["']\s*:\s*["']([^"']+)["']/i);
    if (streetJsonMatch && streetJsonMatch[1].trim() && !data.fullAddress) {
      data.fullAddress = streetJsonMatch[1].trim();
    }

    // Extract detailed location info from map section
    const mapLocationDiv = document.querySelector('.bm-location-map');
    if (mapLocationDiv) {
      // Get venue name from first .bm-map-address
      const venueEl = mapLocationDiv.querySelector('.bm-map-address');
      if (venueEl && !data.location) {
        data.location = venueEl.textContent.trim();
      }

      // Get full address with city and postal code
      const addressDivs = mapLocationDiv.querySelectorAll('.bm-map-address');
      if (addressDivs.length > 1) {
        const addressText = addressDivs[1].textContent.trim();
        // Parse address: "8880 Williams Road \n Richmond, , V7A 1G6"
        const lines = addressText.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length >= 1) {
          // First line is usually street address
          const streetMatch = lines[0].match(/(\d+\s+.+?(?:Road|Street|Ave|Avenue|Way|Drive|Blvd|Boulevard|Lane|Cres|Crescent|Place|Court))/i);
          if (streetMatch) {
            data.fullAddress = streetMatch[1].trim();
          }
        }
        // Look for city and postal code
        const fullText = addressText;
        const cityMatch = fullText.match(/(Vancouver|Richmond|Burnaby|Surrey|Coquitlam|Port Moody|Port Coquitlam|New Westminster|Delta|Langley|Maple Ridge|Pitt Meadows|White Rock|West Vancouver|North Vancouver|Abbotsford|Bowen Island)/i);
        if (cityMatch) {
          data.city = cityMatch[1];
        }
        const postalMatch = fullText.match(/([A-Z]\d[A-Z]\s?\d[A-Z]\d)/i);
        if (postalMatch) {
          data.postalCode = postalMatch[1].toUpperCase();
        }
      }
    }

    // Extract course description from About this Course section
    const aboutHeaderElement = Array.from(document.querySelectorAll('*')).find(el => 
      el.textContent.trim() === 'About this Course'
    );
    if (aboutHeaderElement) {
      // Look for the description text after the header
      let descElement = aboutHeaderElement.parentElement;
      if (descElement) {
        // Find the actual description paragraph
        const allTexts = Array.from(descElement.querySelectorAll('p, div'));
        for (const textEl of allTexts) {
          const text = textEl.textContent.trim();
          // Skip if it's a header or location info
          if (text && 
              text !== 'About this Course' && 
              !text.includes('Show Map') && 
              !text.includes('Course ID') &&
              !text.includes('Restrictions') &&
              text.length > 50) {
            data.fullDescription = text;
            break;
          }
        }
      }
    }
    
    // Extract instructor
    const instructorSection = Array.from(document.querySelectorAll('*')).find(el => 
      el.textContent.trim() === 'Instructor'
    );
    if (instructorSection && instructorSection.nextElementSibling) {
      data.instructor = instructorSection.nextElementSibling.textContent.trim();
    }
    
    // Extract age restrictions
    const ageElement = Array.from(document.querySelectorAll('*')).find(el => 
      el.textContent.includes('Age:') && el.textContent.length < 50
    );
    if (ageElement) {
      const ageMatch = ageElement.textContent.match(/Age:\s*(.+)/i);
      if (ageMatch) {
        data.ageRestrictions = ageMatch[1].trim();
      }
    }
    
    // Determine registration status based on spots and button
    if (data.spotsAvailable > 0) {
      data.registrationStatus = 'Open';
    } else {
      // Check button text for waitlist or closed
      const bookButton = document.querySelector('.bm-book-button, [aria-label*="Book Now"]');
      if (bookButton) {
        const buttonText = bookButton.textContent.trim().toLowerCase();
        if (buttonText.includes('waitlist')) {
          data.registrationStatus = 'Waitlist';
        } else if (buttonText.includes('closed') || buttonText.includes('full')) {
          data.registrationStatus = 'Closed';
        }
      }
    }
    
    // Extract prerequisites
    const prereqElement = Array.from(document.querySelectorAll('*')).find(el => 
      el.textContent.includes('Prerequisite Events:')
    );
    if (prereqElement) {
      // Look for prerequisite links
      const prereqContainer = prereqElement.parentElement;
      if (prereqContainer) {
        const prereqLinks = prereqContainer.querySelectorAll('a');
        prereqLinks.forEach(link => {
          if (link.href && link.textContent.trim() && link.textContent !== 'Prerequisite Event(s)') {
            data.prerequisites.push({
              name: link.textContent.trim(),
              url: link.href,
              courseId: link.href.match(/courseId=([^&]+)/)?.[1] || ''
            });
          }
        });
      }
    }
    
    // Extract course dates/sessions from table
    const courseDatesSection = Array.from(document.querySelectorAll('*')).find(el => 
      el.textContent.includes('Course Dates') && el.tagName.match(/H[1-6]|DIV|SPAN/)
    );
    
    if (courseDatesSection && courseDatesSection.parentElement) {
      const sessionTable = courseDatesSection.parentElement.querySelector('table');
      if (sessionTable) {
        const rows = sessionTable.querySelectorAll('tr');
        rows.forEach((row, index) => {
          if (index === 0) return; // Skip header
          
          const cells = row.querySelectorAll('td');
          if (cells.length >= 4) {
            const session = {
              sessionNumber: index,
              dayOfWeek: cells[0].textContent.trim(),
              date: cells[1].textContent.trim(),
              startTime: '',
              endTime: '',
              location: data.location,
              subLocation: cells[3].textContent.trim(),
              instructor: ''
            };
            
            // Extract time from duration column
            const timeText = cells[2].textContent.trim();
            const timeMatch = timeText.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
            if (timeMatch) {
              session.startTime = timeMatch[1];
              session.endTime = timeMatch[2];
            }
            
            data.sessions.push(session);
          }
        });
      }
    }
    
    // Get total spots count from session info if available
    const sessionInfo = Array.from(document.querySelectorAll('*')).find(el => 
      el.textContent.match(/\d+\s+sessions?/i) && el.textContent.length < 100
    );
    if (sessionInfo) {
      const sessionCountMatch = sessionInfo.textContent.match(/(\d+)\s+sessions?/i);
      if (sessionCountMatch && data.sessions.length === 0) {
        // If we found session count but no detailed sessions, note it
        data.courseDetails = `${sessionCountMatch[0]} total`;
      }
    }
    
    // If no sessions found, try to create one from main schedule info
    if (data.sessions.length === 0 && (data.startDate || data.startTime)) {
      data.sessions.push({
        sessionNumber: 1,
        date: data.startDate,
        dayOfWeek: '',
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
        subLocation: '',
        instructor: ''
      });
    }
    
    // Extract Required Extras
    const requiredExtrasSection = Array.from(document.querySelectorAll('*')).find(el => 
      el.textContent.includes('Required Extras') && el.tagName.match(/H[1-6]|DIV|SPAN/)
    );
    
    if (requiredExtrasSection && requiredExtrasSection.parentElement) {
      const extrasContainer = requiredExtrasSection.parentElement;
      
      // Look for table or list of extras
      const extrasTable = extrasContainer.querySelector('table');
      if (extrasTable) {
        const rows = extrasTable.querySelectorAll('tr');
        rows.forEach((row, index) => {
          if (index === 0) return; // Skip header
          
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const extraName = cells[0].textContent.trim();
            const extraCost = cells[1].textContent.trim();
            
            if (extraName) {
              data.requiredExtras.push({
                name: extraName,
                cost: extraCost,
                required: true
              });
            }
          }
        });
      } else {
        // Try to find extras in a different format
        const extrasText = extrasContainer.textContent;
        const lines = extrasText.split('\n');
        
        lines.forEach(line => {
          const trimmedLine = line.trim();
          // Look for patterns like "Item Name - $XX.XX" or "Item Name: $XX.XX"
          const extraMatch = trimmedLine.match(/^(.+?)[\s-:]+(\$[\d,]+(?:\.\d{2})?)$/);
          if (extraMatch && !trimmedLine.includes('Required Extras')) {
            data.requiredExtras.push({
              name: extraMatch[1].trim(),
              cost: extraMatch[2].trim(),
              required: true
            });
          }
        });
      }
    }
    
    return data;
  });
}

module.exports = { extractComprehensiveDetails };