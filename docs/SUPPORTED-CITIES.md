# Supported Cities & Providers

Coverage of recreation centers and activity providers across Canada.

## Coverage Summary

| Region | Cities | Status |
|--------|--------|--------|
| British Columbia | 19 | Active |
| Ontario | 15 | Active |
| Alberta | 2 | Active |
| Saskatchewan | 2 | Active |
| Manitoba | 1 | Active |
| Nova Scotia | 1 | Active |
| Quebec | 1 | Active |
| **Total** | **43** | |

## British Columbia (19 Cities)

| City | Provider | Platform | Status |
|------|----------|----------|--------|
| Vancouver | Vancouver Parks & Rec | ActiveNetwork | Active |
| Burnaby | Burnaby Parks & Rec | PerfectMind | Active |
| Richmond | Richmond Community | PerfectMind | Active |
| Surrey | Surrey Parks & Rec | PerfectMind | Active |
| Abbotsford | Abbotsford Rec | PerfectMind | Active |
| Coquitlam | Coquitlam Parks | PerfectMind | Active |
| Langley | Langley City/Township | PerfectMind | Active |
| Langley City | Langley City Rec | PerfectMind | Active |
| New Westminster | New West Parks | PerfectMind | Active |
| North Vancouver | NVRC | PerfectMind | Active |
| Port Coquitlam | Port Coquitlam Rec | PerfectMind | Active |
| Port Moody | Port Moody Rec | PerfectMind | Active |
| West Vancouver | West Van Rec | PerfectMind | Active |
| White Rock | White Rock Rec | PerfectMind | Active |
| Lions Bay | Lions Bay Rec | Custom | Active |
| Pitt Meadows | Pitt Meadows Rec | PerfectMind | Active |
| Maple Ridge | Maple Ridge Parks | PerfectMind | Active |
| Bowen Island | Bowen Island Rec | Custom | Active |
| Delta | Delta Rec | PerfectMind | Active |

## Ontario (15 Cities)

| City | Provider | Platform | Status |
|------|----------|----------|--------|
| Toronto | City of Toronto | ActiveNetwork | Active |
| Ottawa | City of Ottawa | ActiveNetwork | Active |
| Mississauga | Mississauga Rec | ActiveNetwork | Active |
| Brampton | Brampton Rec | ActiveNetwork | Active |
| Hamilton | Hamilton Rec | WebTrac | Active |
| London | London Parks & Rec | PerfectMind | Active |
| Kitchener | Kitchener Rec | PerfectMind | Active |
| Windsor | Windsor Rec | WebTrac | Active |
| Markham | Markham Rec | PerfectMind | Active |
| Oakville | Oakville Rec | PerfectMind | Active |
| Richmond Hill | Richmond Hill Rec | PerfectMind | Active |
| Vaughan | Vaughan Rec | ActiveNetwork | Active |
| Burlington | Burlington Rec | PerfectMind | Active |
| Oshawa | Oshawa Rec | WebTrac | Active |
| Greater Sudbury | Sudbury Rec | WebTrac | Active |
| Guelph | Guelph Rec | PerfectMind | Active |

## Alberta (2 Cities)

| City | Provider | Platform | Status |
|------|----------|----------|--------|
| Calgary | Live and Play Calgary | REGPROG | Active |
| Edmonton | Edmonton Parks & Rec | COE | Active |

## Saskatchewan (2 Cities)

| City | Provider | Platform | Status |
|------|----------|----------|--------|
| Saskatoon | Saskatoon Leisure | PerfectMind | Active |
| Regina | Regina Parks & Rec | WebTrac | Active |

## Manitoba (1 City)

| City | Provider | Platform | Status |
|------|----------|----------|--------|
| Winnipeg | Winnipeg Leisure Guide | ActiveNetwork | Active |

## Nova Scotia (1 City)

| City | Provider | Platform | Status |
|------|----------|----------|--------|
| Halifax | Halifax Recreation | PerfectMind | Active |

## Quebec (1 City)

| City | Provider | Platform | Status |
|------|----------|----------|--------|
| Montreal | Ville de Montreal | Custom | Active |

## Platform Distribution

| Platform | Cities | % Coverage |
|----------|--------|------------|
| PerfectMind | 22 | 51% |
| ActiveNetwork | 8 | 19% |
| WebTrac | 5 | 12% |
| REGPROG | 1 | 2% |
| COE | 1 | 2% |
| Custom | 3 | 7% |
| Other | 3 | 7% |

## Activity Categories

All providers are mapped to these standard categories:

| Category | Description |
|----------|-------------|
| Aquatics | Swimming, water polo, diving |
| Arts | Visual arts, music, drama |
| Sports | Team sports, individual sports |
| Dance | Ballet, hip hop, ballroom |
| Camps | Day camps, specialty camps |
| Early Years | Programs for ages 0-5 |
| Youth | Teen programs (13-17) |
| Fitness | Exercise classes, gym programs |
| Education | Academic, life skills |

## Scheduling Tiers

| Tier | Frequency | Cities |
|------|-----------|--------|
| Critical | 3x daily | Vancouver, Calgary, Toronto |
| Standard | Daily | All other cities |

### Critical Tier Schedule
- 7:00 AM local time
- 1:00 PM local time
- 7:00 PM local time

### Standard Tier Schedule
- 6:00 AM UTC (daily)

## Adding New Cities

### Requirements
1. Identify registration platform type
2. Locate activity catalog URL
3. Analyze page structure
4. Create provider config
5. Test scraper locally
6. Deploy to production

### Config Template

```json
{
  "id": "cityname-provider",
  "name": "City Name Parks & Recreation",
  "code": "cityname",
  "platform": "perfectmind",
  "region": "Province",
  "city": "City Name",
  "baseUrl": "https://cityname.perfectmind.com",
  "isActive": true,
  "scraperConfig": {
    "type": "category-browse",
    "entryPoints": ["/youth", "/camps", "/aquatics"],
    "ageFilters": { "min": 0, "max": 18 },
    "rateLimit": {
      "requestsPerMinute": 25,
      "concurrentRequests": 3
    }
  },
  "schedule": {
    "tier": "standard",
    "timezone": "America/Vancouver"
  }
}
```

## Coverage Roadmap

### Phase 1 (Complete)
- All major BC cities
- Major Ontario cities

### Phase 2 (In Progress)
- Alberta expansion
- Prairie provinces

### Phase 3 (Planned)
- Atlantic provinces
- Northern territories

### Phase 4 (Future)
- Quebec (bilingual support)
- Complete national coverage

---

**Document Version**: 4.0
**Last Updated**: December 2024
