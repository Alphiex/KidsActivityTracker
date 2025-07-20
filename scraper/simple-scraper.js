const axios = require('axios');
const fs = require('fs');

async function analyzeNVRC() {
  const baseUrl = 'https://www.nvrc.ca/programs-memberships/find-program/results';
  const queryParams = 'programs=Early%20Years%3A%20On%20My%20Own%2FEarly%20Years%3A%20Parent%20Participation&activities=activities_camps%2Factivities_learn_and_play%2Factivities_martial_arts%2Factivities_swimming%2Farts_culture_dance%2Farts_culture_visual_arts&locations=0ca97f73-c2d6-45b9-b9a3-8d3346945ca8%2Fad9f1d30-91c6-4779-a5fd-e0109e69a8d6%2Fe153c19a-14a3-4b81-a121-13f1ec7405fc%2Fffbf31ae-84f3-495b-83d1-1a7f573db3c8%2F1b275d54-b65d-4169-94cd-847d1644ccc7%2F143ff434-0589-4785-9f34-334cfc713c2b%2F9c388e73-ed3c-4f82-85bd-cc6cf0fb0a68%2Ff67610ba-64ff-4176-9f59-81b27a23cbab%2F72be6805-1624-446d-9597-b70401b78293%2Fe5aebf2f-6163-43d8-b780-a90379b62026';
  
  const url = `${baseUrl}?${queryParams}`;
  
  console.log('Fetching page...');
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    
    const html = response.data;
    
    // Save HTML for analysis
    fs.writeFileSync('nvrc-page.html', html);
    console.log('Page HTML saved to nvrc-page.html');
    
    // Look for API endpoints in the HTML
    const apiMatches = html.match(/(?:api|ajax|endpoint|json)[\w\/\-\.]*"/gi);
    if (apiMatches) {
      console.log('\nPotential API endpoints found:');
      apiMatches.forEach(match => console.log(' -', match));
    }
    
    // Look for JavaScript data structures
    const jsonMatches = html.match(/(?:var|let|const)\s+\w+\s*=\s*(\{[\s\S]*?\}|\[[\s\S]*?\])/g);
    if (jsonMatches) {
      console.log('\nFound', jsonMatches.length, 'potential data structures in JavaScript');
    }
    
    // Check for PerfectMind references (the system they use)
    const perfectMindMatches = html.match(/perfectmind[\w\-\.\/]*/gi);
    if (perfectMindMatches) {
      console.log('\nPerfectMind integration found:');
      [...new Set(perfectMindMatches)].forEach(match => console.log(' -', match));
    }
    
    // Look for program/course containers
    const programPatterns = [
      /<div[^>]*class="[^"]*program[^"]*"[^>]*>/g,
      /<div[^>]*class="[^"]*course[^"]*"[^>]*>/g,
      /<div[^>]*class="[^"]*activity[^"]*"[^>]*>/g,
      /<div[^>]*data-program[^>]*>/g
    ];
    
    console.log('\nSearching for program containers...');
    programPatterns.forEach(pattern => {
      const matches = html.match(pattern);
      if (matches) {
        console.log(`Found ${matches.length} matches for pattern:`, pattern.source);
      }
    });
    
  } catch (error) {
    console.error('Error fetching page:', error.message);
  }
}

// For testing the API approach
async function testPerfectMindAPI() {
  // Common PerfectMind API endpoints
  const possibleEndpoints = [
    'https://www.nvrc.ca/perfectmind/api/programs',
    'https://www.nvrc.ca/api/perfectmind/programs',
    'https://www.nvrc.ca/pm/api/programs',
    'https://www.nvrc.ca/programs-memberships/api/search'
  ];
  
  console.log('\nTesting potential API endpoints...');
  
  for (const endpoint of possibleEndpoints) {
    try {
      const response = await axios.get(endpoint, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });
      console.log(`✓ ${endpoint} - Status: ${response.status}`);
    } catch (error) {
      console.log(`✗ ${endpoint} - ${error.message}`);
    }
  }
}

// Run the analysis
async function main() {
  await analyzeNVRC();
  await testPerfectMindAPI();
}

main();