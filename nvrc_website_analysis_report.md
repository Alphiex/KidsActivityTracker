# NVRC Website Analysis Report for Camp Data Scraping

## Overview
The North Vancouver Recreation and Culture Commission (NVRC) website uses a Drupal 10 CMS integrated with PerfectMind, a recreation management platform, to display programs and camps.

## Key Findings

### 1. Page Structure

#### URL Pattern
The results page URL follows this pattern:
```
https://www.nvrc.ca/programs-memberships/find-program/results?[parameters]
```

Parameters include:
- `programs`: Program categories (e.g., "Early Years: On My Own/Early Years: Parent Participation")
- `activities`: Activity types (e.g., "activities_camps", "activities_swimming", etc.)
- `locations`: Location GUIDs

#### HTML Structure
The page uses JavaScript templating (jQuery tmpl) to dynamically render program data. Key templates include:

**Programs Event Template** (lines 870-919):
```html
<script id="ProgramsEventTemplate" type="text/x-jquery-tmpl">
  <div id="ProgramsEvent${ID}" class="programs-event" data-spots="${Remaining}" ...>
    <div class="programs-event-info">
      <div class="programs-event-title">${Subject}</div>
      <div class="programs-event-location">${Location.Name}</div>
      <div class="programs-event-facility">${Facility.RecordName}</div>
    </div>
    <div class="programs-event-schedule">
      <div class="programs-event-days">${Days}</div>
      <div class="programs-event-date-range">${DateRange}</div>
      <div class="programs-event-time-range">${TimeRange}</div>
    </div>
    <div class="programs-event-age-price">
      <div class="programs-event-age-range">${AgeRange}</div>
      <div class="programs-event-price-range">...</div>
    </div>
    <div class="programs-event-course-id">
      Course ID: ${EventID}
    </div>
  </div>
</script>
```

### 2. Data Fields Available

Based on the JavaScript templates, each program/camp includes:
- **ID**: Unique identifier
- **Subject/Title**: Program name
- **Location**: Location name and ID
- **Facility**: Facility name
- **Days**: Days of the week
- **DateRange**: Start and end dates
- **TimeRange**: Start and end times
- **AgeRange**: Minimum and maximum ages
- **Prices**: Price information (multiple price types possible)
- **EventID**: Course ID
- **Remaining**: Spots available
- **RegistrationStartDateTime**: Registration opening date
- **AlertMessage**: Any special alerts
- **Description**: Program description (in ServiceTemplate)

### 3. Dynamic Data Loading

The page uses AJAX to load program data dynamically:
- Results are rendered into the `.perfectmind-results` container
- Data is loaded after page load using JavaScript
- Templates use jQuery tmpl syntax (`${variable}`)
- The actual AJAX endpoint is not visible in the static HTML

### 4. Filter System

The sidebar contains filters for:
- **Availability**: Show only programs with spots available
- **Age**: Age range filter (months or years)
- **Locations**: Multiple location checkboxes
- **Days**: Day of the week checkboxes
- **Times**: Time slot checkboxes

### 5. CSS Selectors for Scraping

Key selectors to target:
- `.perfectmind-results`: Main results container
- `.programs-event`: Individual program card
- `.programs-event-title`: Program name
- `.programs-event-location`: Location
- `.programs-event-date-range`: Date range
- `.programs-event-time-range`: Time range
- `.programs-event-age-range`: Age range
- `.programs-event-price-range`: Pricing
- `.programs-event-course-id`: Course ID

### 6. Challenges for Scraping

1. **JavaScript Rendering**: The page loads data dynamically via JavaScript, so simple HTTP requests won't capture the program data.

2. **AJAX Endpoint**: The actual API endpoint is not visible in the HTML. It's likely called from minified JavaScript files.

3. **PerfectMind Integration**: The system uses PerfectMind's API, which may require authentication or specific headers.

4. **Dynamic Content**: Content is rendered using jQuery templates after page load.

## Recommended Scraping Approaches

### Option 1: Browser Automation (Recommended)
Use Selenium, Playwright, or Puppeteer to:
1. Load the page with desired filters
2. Wait for AJAX content to load
3. Extract data from rendered HTML

### Option 2: Network Analysis
1. Use browser developer tools to capture the actual AJAX requests
2. Identify the API endpoint and parameters
3. Replicate the API calls directly (if no authentication is required)

### Option 3: Reverse Engineering
1. Analyze the minified JavaScript files to find API endpoints
2. Look for patterns in how filters are converted to API parameters
3. Build direct API requests

## Sample Scraping Code Structure

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def scrape_nvrc_camps(url):
    driver = webdriver.Chrome()
    driver.get(url)
    
    # Wait for results to load
    wait = WebDriverWait(driver, 10)
    wait.until(EC.presence_of_element_located((By.CLASS_NAME, "programs-event")))
    
    # Extract program data
    programs = []
    program_elements = driver.find_elements(By.CLASS_NAME, "programs-event")
    
    for element in program_elements:
        program = {
            'title': element.find_element(By.CLASS_NAME, "programs-event-title").text,
            'location': element.find_element(By.CLASS_NAME, "programs-event-location").text,
            'date_range': element.find_element(By.CLASS_NAME, "programs-event-date-range").text,
            'time_range': element.find_element(By.CLASS_NAME, "programs-event-time-range").text,
            'age_range': element.find_element(By.CLASS_NAME, "programs-event-age-range").text,
            'course_id': element.find_element(By.CLASS_NAME, "programs-event-course-id").text,
        }
        programs.append(program)
    
    driver.quit()
    return programs
```

## Next Steps

1. **Inspect Network Traffic**: Use browser developer tools on the live site to identify the actual API endpoints being called.

2. **Test Browser Automation**: Implement a Selenium/Playwright script to verify data extraction works.

3. **Handle Pagination**: Check if there's pagination or "load more" functionality that needs to be handled.

4. **Error Handling**: Implement robust error handling for network issues and dynamic content loading.

5. **Rate Limiting**: Add delays between requests to avoid overwhelming the server.

6. **Data Validation**: Ensure all extracted data is properly formatted and complete.