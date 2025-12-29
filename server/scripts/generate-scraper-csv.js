const fs = require('fs');
const path = require('path');

// Region to Province mapping
const regionToProvince = {
  'Metro Vancouver': 'British Columbia',
  'Fraser Valley': 'British Columbia',
  'Vancouver Island': 'British Columbia',
  'Greater Victoria': 'British Columbia',
  'Thompson-Okanagan': 'British Columbia',
  'Okanagan': 'British Columbia',
  'Northern BC': 'British Columbia',
  'West Vancouver': 'British Columbia',
  'North Vancouver': 'British Columbia',
  'Greater Toronto Area': 'Ontario',
  'Durham Region': 'Ontario',
  'York Region': 'Ontario',
  'Peel Region': 'Ontario',
  'Golden Horseshoe': 'Ontario',
  'Greater Hamilton Area': 'Ontario',
  'Waterloo Region': 'Ontario',
  'Niagara Region': 'Ontario',
  'Central Ontario': 'Ontario',
  'Eastern Ontario': 'Ontario',
  'Southwestern Ontario': 'Ontario',
  'Northern Ontario': 'Ontario',
  'Northwestern Ontario': 'Ontario',
  'National Capital Region': 'Ontario',
  'Alberta': 'Alberta',
  'Calgary Region': 'Alberta',
  'Edmonton Metro': 'Alberta',
  'Central Alberta': 'Alberta',
  'Saskatchewan': 'Saskatchewan',
  'Manitoba': 'Manitoba',
  'Quebec': 'Quebec',
  'Greater Montreal': 'Quebec',
  'Estrie': 'Quebec',
  'Outaouais': 'Quebec',
  'Nova Scotia': 'Nova Scotia',
  'Newfoundland': 'Newfoundland and Labrador'
};

// Database data (from production query)
const dbStats = {
  'Bowen Island Community Recreation': { activities: 113, locations: 14, lastExec: '2025-12-29 04:36:14' },
  'Centre Multi Loisirs Sherbrooke': { activities: 5, locations: 1, lastExec: '2025-12-28 23:52:10' },
  'City of Abbotsford Parks, Recreation & Culture': { activities: 1126, locations: 83, lastExec: '2025-12-29 19:38:19' },
  'City of Airdrie Recreation': { activities: 435, locations: 3, lastExec: '2025-12-29 19:47:56' },
  'City of Barrie Recreation': { activities: 1361, locations: 13, lastExec: '2025-12-26 19:42:06' },
  'City of Brampton Recreation': { activities: 3715, locations: 81, lastExec: '2025-12-28 06:12:15' },
  'City of Brantford Recreation': { activities: 406, locations: 18, lastExec: '' },
  'City of Burlington Recreation': { activities: 43, locations: 10, lastExec: '2025-12-29 19:35:35' },
  'City of Burnaby Parks & Recreation': { activities: 6648, locations: 481, lastExec: '' },
  'City of Calgary Recreation - Live and Play': { activities: 674, locations: 76, lastExec: '' },
  'City of Cambridge Recreation': { activities: 898, locations: 27, lastExec: '2025-12-28 20:16:31' },
  'City of Coquitlam Parks & Recreation': { activities: 1039, locations: 76, lastExec: '2025-12-29 18:32:18' },
  'City of Delta Parks & Recreation': { activities: 1954, locations: 28, lastExec: '2025-12-28 07:17:49' },
  'City of Dorval Recreation': { activities: 17, locations: 1, lastExec: '2025-12-29 19:02:30' },
  'City of Edmonton - move.learn.play': { activities: 3157, locations: 114, lastExec: '' },
  'City of Greater Sudbury Leisure Services': { activities: 613, locations: 16, lastExec: '2025-12-29 11:50:27' },
  'City of Guelph Parks and Recreation': { activities: 922, locations: 34, lastExec: '2025-12-28 19:58:55' },
  'City of Hamilton Recreation': { activities: 0, locations: 0, lastExec: '' },
  'City of Kamloops Recreation': { activities: 224, locations: 15, lastExec: '2025-12-29 19:37:58' },
  'City of Kelowna Active Living & Culture': { activities: 123, locations: 25, lastExec: '2025-12-29 19:47:01' },
  'City of Kingston Recreation': { activities: 201, locations: 3, lastExec: '2025-12-28 11:51:59' },
  'City of Kitchener Recreation': { activities: 1212, locations: 38, lastExec: '' },
  'City of Langley Recreation': { activities: 1712, locations: 12, lastExec: '' },
  'City of London Recreation': { activities: 31, locations: 12, lastExec: '2025-12-29 15:35:53' },
  'City of Maple Ridge Parks & Recreation': { activities: 2094, locations: 35, lastExec: '' },
  'City of Markham Recreation': { activities: 382, locations: 64, lastExec: '2025-12-29 15:52:16' },
  'City of Mississauga Recreation': { activities: 4687, locations: 50, lastExec: '2025-12-28 16:02:25' },
  'City of Nanaimo Recreation': { activities: 470, locations: 46, lastExec: '2025-12-28 12:14:18' },
  'City of New Westminster Parks & Recreation': { activities: 1733, locations: 23, lastExec: '' },
  'City of Niagara Falls Recreation': { activities: 161, locations: 12, lastExec: '2025-12-28 23:53:25' },
  'City of Oshawa Recreation': { activities: 235, locations: 12, lastExec: '' },
  'City of Ottawa Recreation': { activities: 7416, locations: 106, lastExec: '' },
  'City of Pickering Recreation': { activities: 870, locations: 19, lastExec: '' },
  'City of Pitt Meadows Recreation': { activities: 388, locations: 20, lastExec: '' },
  'City of Port Coquitlam Recreation': { activities: 2169, locations: 27, lastExec: '' },
  'City of Port Moody Recreation': { activities: 684, locations: 34, lastExec: '' },
  'City of Regina Recreation': { activities: 1178, locations: 34, lastExec: '' },
  'City of Richmond Community Services': { activities: 4249, locations: 121, lastExec: '' },
  'City of Richmond Hill Recreation': { activities: 1663, locations: 34, lastExec: '2025-12-28 01:58:25' },
  'City of Saskatoon Leisure Services': { activities: 82, locations: 9, lastExec: '' },
  'City of St. Catharines Recreation': { activities: 927, locations: 17, lastExec: '2025-12-29 08:31:28' },
  "City of St. John's Recreation": { activities: 391, locations: 25, lastExec: '' },
  'City of Surrey Parks, Recreation & Culture': { activities: 4017, locations: 34, lastExec: '' },
  'City of Toronto Parks, Forestry & Recreation': { activities: 4797, locations: 188, lastExec: '2025-12-29 08:31:58' },
  'City of Vancouver Parks & Recreation': { activities: 10356, locations: 391, lastExec: '' },
  'City of Vaughan Recreation': { activities: 462, locations: 74, lastExec: '2025-12-28 02:24:18' },
  'City of Vernon Recreation': { activities: 0, locations: 0, lastExec: '2025-12-28 00:18:02' },
  'City of Victoria Recreation': { activities: 169, locations: 9, lastExec: '2025-12-29 09:08:11' },
  'City of Waterloo Recreation': { activities: 0, locations: 0, lastExec: '' },
  'City of White Rock Recreation': { activities: 194, locations: 18, lastExec: '' },
  'City of Windsor Recreation': { activities: 0, locations: 0, lastExec: '' },
  'City of Winnipeg Leisure Guide': { activities: 0, locations: 0, lastExec: '2025-12-28 01:58:25' },
  'District of Saanich Recreation': { activities: 2002, locations: 36, lastExec: '2025-12-28 01:58:25' },
  'Halifax Regional Municipality Recreation': { activities: 0, locations: 0, lastExec: '2025-12-28 01:47:51' },
  'Lions Bay Community Recreation': { activities: 1, locations: 1, lastExec: '' },
  'Municipality of Chatham-Kent Recreation': { activities: 103, locations: 13, lastExec: '2025-12-29 19:53:31' },
  'Municipality of Clarington Recreation': { activities: 1109, locations: 45, lastExec: '2025-12-29 19:25:39' },
  'North Vancouver Recreation Commission': { activities: 7400, locations: 25, lastExec: '' },
  'NVRC': { activities: 321, locations: 0, lastExec: '' },
  'Town of Ajax Recreation': { activities: 937, locations: 140, lastExec: '' },
  'Town of Aurora Recreation': { activities: 736, locations: 32, lastExec: '2025-12-29 16:20:06' },
  'Town of Caledon Recreation': { activities: 595, locations: 42, lastExec: '2025-12-29 19:49:49' },
  'Town of Georgina Recreation': { activities: 0, locations: 0, lastExec: '' },
  'Town of Milton Recreation': { activities: 26, locations: 7, lastExec: '2025-12-29 15:58:22' },
  'Town of Newmarket Recreation': { activities: 0, locations: 0, lastExec: '' },
  'Town of Oakville Recreation': { activities: 1007, locations: 51, lastExec: '2025-12-28 02:24:31' },
  'Town of Whitby Recreation': { activities: 1099, locations: 17, lastExec: '2025-12-26 19:26:41' },
  'Town of Whitchurch-Stouffville Recreation': { activities: 419, locations: 35, lastExec: '2025-12-29 16:09:07' },
  'Township of King Recreation': { activities: 140, locations: 15, lastExec: '2025-12-29 19:53:23' },
  'Township of Langley Recreation': { activities: 2022, locations: 57, lastExec: '' },
  'Ville de Gatineau Culture et Loisirs': { activities: 0, locations: 0, lastExec: '' },
  'Ville de Laval Inscriptions': { activities: 20, locations: 1, lastExec: '2025-12-29 15:57:39' },
  'Ville de Montreal Loisirs': { activities: 1384, locations: 88, lastExec: '2025-12-29 16:56:44' },
  'Ville de Québec Loisirs': { activities: 43, locations: 1, lastExec: '2025-12-29 15:58:29' },
  'West Vancouver Recreation': { activities: 4488, locations: 158, lastExec: '' },
  'City of Prince George Recreation': { activities: 0, locations: 0, lastExec: '' },
  'City of Peterborough Recreation': { activities: 0, locations: 0, lastExec: '' },
  'City of Red Deer Recreation': { activities: 0, locations: 0, lastExec: '' },
  'Strathcona County Recreation': { activities: 0, locations: 0, lastExec: '' },
  'City of Thunder Bay Recreation': { activities: 0, locations: 0, lastExec: '' }
};

// Calculate executions per day based on frequency
function getExecutionsPerDay(frequency) {
  switch (frequency) {
    case '3x-daily': return 3;
    case '2x-daily': return 2;
    case 'daily':
    case '1x-daily': return 1;
    case 'weekly': return 0.14;
    default: return 1;
  }
}

// Read all config files
const configDir = path.join(__dirname, '../scrapers/configs/providers');
const files = fs.readdirSync(configDir).filter(f => f.endsWith('.json'));
const rows = [];

for (const file of files) {
  try {
    const content = fs.readFileSync(path.join(configDir, file), 'utf8');
    const config = JSON.parse(content);
    const stats = dbStats[config.name] || { activities: 0, locations: 0, lastExec: '' };
    const province = regionToProvince[config.region] || config.region;

    // Construct full URL from baseUrl + first entry point
    const baseUrl = config.baseUrl || '';
    const entryPoint = config.scraperConfig?.entryPoints?.[0] || '';
    const fullUrl = baseUrl + entryPoint;

    rows.push({
      city: config.city || '',
      province: province,
      name: config.name || '',
      fullUrl: fullUrl,
      platform: config.platform || '',
      activities: stats.activities,
      locations: stats.locations,
      parallelProcesses: config.scraperConfig?.rateLimits?.concurrentRequests || 1,
      tier: config.schedule?.tier || '',
      executionsDaily: getExecutionsPerDay(config.schedule?.frequency || 'daily'),
      executionTimes: config.schedule?.times?.join('; ') || '',
      lastExecution: stats.lastExec,
      population: config.metadata?.population || ''
    });
  } catch (e) {
    console.error('Error:', file, e.message);
  }
}

// Sort by province then city
rows.sort((a, b) => {
  if (a.province !== b.province) return a.province.localeCompare(b.province);
  return a.city.localeCompare(b.city);
});

// CSV header
const header = 'City,Province,Name,URL,Platform,Activities,Locations,Parallel Processes,Tier,Executions Daily,Execution Times,Last Execution,Population';

// Generate CSV rows
const csvRows = rows.map(r => [
  '"' + r.city + '"',
  '"' + r.province + '"',
  '"' + r.name + '"',
  '"' + r.fullUrl + '"',
  '"' + r.platform + '"',
  r.activities,
  r.locations,
  r.parallelProcesses,
  '"' + r.tier + '"',
  r.executionsDaily,
  '"' + r.executionTimes + '"',
  '"' + r.lastExecution + '"',
  r.population
].join(','));

const csv = header + '\n' + csvRows.join('\n');

// Write to docs directory
const docsDir = path.join(__dirname, '../../docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

fs.writeFileSync(path.join(docsDir, 'scrapers.csv'), csv);
console.log(`CSV written to ${path.join(docsDir, 'scrapers.csv')}`);
console.log(`Total scrapers: ${rows.length}`);
console.log(`Total activities: ${rows.reduce((sum, r) => sum + r.activities, 0)}`);
console.log(`Total locations: ${rows.reduce((sum, r) => sum + r.locations, 0)}`);
