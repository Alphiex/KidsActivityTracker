const axios = require('axios');
const cheerio = require('cheerio');

class NVRCScraper {
  constructor() {
    this.baseUrl = 'https://www.nvrc.ca';
    this.searchUrl = `${this.baseUrl}/programs-memberships/find-program/results`;
  }

  async scrapePrograms(queryParams) {
    try {
      console.log('Scraping NVRC with params:', queryParams);
      
      // Build the full URL with query parameters
      const url = `${this.searchUrl}?${queryParams}`;
      
      // First, let's try to find the API endpoint they use
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        }
      });

      const $ = cheerio.load(response.data);
      
      // Look for PerfectMind data in scripts
      const scripts = $('script').map((i, el) => $(el).html()).get();
      let programData = [];

      // Try to find inline JSON data
      for (const script of scripts) {
        if (script && script.includes('perfectmind')) {
          // Look for JSON-like structures
          const jsonMatches = script.match(/\{[^{}]*programs?[^{}]*\}/gi);
          if (jsonMatches) {
            console.log('Found potential program data in script');
          }
        }
      }

      // Parse the HTML structure for program information
      // NVRC uses a specific structure for their program listings
      const programs = [];
      
      // Try different selectors that might contain programs
      const selectors = [
        '.program-item',
        '.course-item',
        '.activity-item',
        '[data-program-id]',
        '.pm-program',
        '.perfectmind-program'
      ];

      for (const selector of selectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          
          elements.each((index, element) => {
            const $el = $(element);
            const program = this.extractProgramData($el, $);
            if (program.name) {
              programs.push(program);
            }
          });
          
          if (programs.length > 0) break;
        }
      }

      // If no programs found with specific selectors, try a more general approach
      if (programs.length === 0) {
        // Look for common patterns in the HTML
        $('div').each((index, element) => {
          const $el = $(element);
          const text = $el.text();
          
          // Check if this might be a program listing
          if (text.includes('Register') || text.includes('Sign up')) {
            const program = this.extractGeneralProgramData($el, $);
            if (program.name) {
              programs.push(program);
            }
          }
        });
      }

      console.log(`Scraped ${programs.length} programs`);
      return programs;

    } catch (error) {
      console.error('Error scraping NVRC:', error.message);
      throw error;
    }
  }

  extractProgramData($element, $) {
    const program = {
      id: $element.attr('data-program-id') || $element.attr('id') || Date.now().toString(),
      name: this.findText($element, ['.program-name', '.course-name', 'h3', 'h4'], $),
      provider: 'NVRC',
      description: this.findText($element, ['.program-description', '.description', 'p'], $),
      location: {
        name: this.findText($element, ['.location', '.facility', '.venue'], $),
        address: this.findText($element, ['.address'], $)
      },
      dateRange: this.extractDateRange($element, $),
      schedule: this.extractSchedule($element, $),
      ageRange: this.extractAgeRange($element, $),
      cost: this.extractCost($element, $),
      spotsAvailable: this.extractSpots($element, $),
      registrationUrl: this.extractRegistrationUrl($element, $),
      activityType: this.extractActivityTypes($element, $),
      scrapedAt: new Date()
    };

    return program;
  }

  extractGeneralProgramData($element, $) {
    const text = $element.text();
    const html = $element.html();
    
    const program = {
      id: Date.now().toString(),
      name: '',
      provider: 'NVRC',
      description: '',
      location: { name: '', address: '' },
      dateRange: { start: null, end: null },
      schedule: { days: [], startTime: '', endTime: '' },
      ageRange: { min: 0, max: 18 },
      cost: 0,
      spotsAvailable: null,
      registrationUrl: this.baseUrl + '/register',
      activityType: [],
      scrapedAt: new Date()
    };

    // Extract name (usually in a heading)
    const heading = $element.find('h1, h2, h3, h4, h5').first().text().trim();
    if (heading) program.name = heading;

    // Extract cost
    const costMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
    if (costMatch) program.cost = parseFloat(costMatch[1]);

    // Extract ages
    const ageMatch = text.match(/(?:ages?|years?)\s*(\d+)\s*(?:-|to)\s*(\d+)/i);
    if (ageMatch) {
      program.ageRange.min = parseInt(ageMatch[1]);
      program.ageRange.max = parseInt(ageMatch[2]);
    }

    // Extract dates
    const dateMatch = text.match(/(\w+\s+\d+)\s*-\s*(\w+\s+\d+)/);
    if (dateMatch) {
      program.dateRange.start = new Date(dateMatch[1] + ', 2024');
      program.dateRange.end = new Date(dateMatch[2] + ', 2024');
    }

    // Extract registration link
    const link = $element.find('a[href*="register"], a[href*="book"]').attr('href');
    if (link) {
      program.registrationUrl = link.startsWith('http') ? link : this.baseUrl + link;
    }

    return program;
  }

  findText($element, selectors, $) {
    for (const selector of selectors) {
      const text = $element.find(selector).first().text().trim();
      if (text) return text;
    }
    return '';
  }

  extractDateRange($element, $) {
    const dateText = this.findText($element, ['.dates', '.date-range', '.schedule'], $);
    const dateMatch = dateText.match(/(\w+\s+\d+)\s*-\s*(\w+\s+\d+)/);
    
    if (dateMatch) {
      return {
        start: new Date(dateMatch[1] + ', 2024'),
        end: new Date(dateMatch[2] + ', 2024')
      };
    }
    
    return { start: new Date(), end: new Date() };
  }

  extractSchedule($element, $) {
    const scheduleText = this.findText($element, ['.schedule', '.time', '.days'], $);
    const timeMatch = scheduleText.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
    
    return {
      days: this.extractDays(scheduleText),
      startTime: timeMatch ? timeMatch[1] : '',
      endTime: timeMatch ? timeMatch[2] : ''
    };
  }

  extractDays(text) {
    const days = [];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    dayNames.forEach(day => {
      if (text.includes(day) || text.includes(day.substring(0, 3))) {
        days.push(day);
      }
    });
    
    return days.length > 0 ? days : ['TBD'];
  }

  extractAgeRange($element, $) {
    const ageText = this.findText($element, ['.age', '.ages', '.age-range'], $);
    const ageMatch = ageText.match(/(\d+)\s*(?:-|to)\s*(\d+)/);
    
    if (ageMatch) {
      return {
        min: parseInt(ageMatch[1]),
        max: parseInt(ageMatch[2])
      };
    }
    
    return { min: 4, max: 18 };
  }

  extractCost($element, $) {
    const costText = this.findText($element, ['.price', '.cost', '.fee'], $);
    const costMatch = costText.match(/\$(\d+(?:\.\d{2})?)/);
    
    return costMatch ? parseFloat(costMatch[1]) : 0;
  }

  extractSpots($element, $) {
    const spotsText = this.findText($element, ['.spots', '.availability', '.remaining'], $);
    const spotsMatch = spotsText.match(/(\d+)\s*(?:spots?|spaces?)/i);
    
    return spotsMatch ? parseInt(spotsMatch[1]) : null;
  }

  extractRegistrationUrl($element, $) {
    const link = $element.find('a[href*="register"], a[href*="book"], .register-button').attr('href');
    return link ? (link.startsWith('http') ? link : this.baseUrl + link) : this.baseUrl + '/register';
  }

  extractActivityTypes($element, $) {
    const text = $element.text().toLowerCase();
    const types = [];
    
    const typeMap = {
      'camp': 'camps',
      'swim': 'swimming',
      'martial': 'martial_arts',
      'karate': 'martial_arts',
      'dance': 'dance',
      'art': 'visual_arts',
      'paint': 'visual_arts',
      'music': 'music',
      'sport': 'sports',
      'early years': 'early_years',
      'toddler': 'early_years',
      'play': 'learn_and_play'
    };
    
    Object.keys(typeMap).forEach(keyword => {
      if (text.includes(keyword)) {
        types.push(typeMap[keyword]);
      }
    });
    
    return types.length > 0 ? types : ['camps'];
  }
}

module.exports = NVRCScraper;