const axios = require('axios');

async function testActivityData() {
  try {
    const response = await axios.get('https://kids-activity-api-4ev6yi22va-uc.a.run.app/api/v1/activities', {
      params: {
        page: 1,
        limit: 1,
        hideClosedOrFull: false
      }
    });

    console.log('API Response Structure:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.activities && response.data.activities.length > 0) {
      const activity = response.data.activities[0];
      console.log('\n\n=== First Activity Details ===');
      console.log('Name:', activity.name);
      console.log('Schedule:', activity.schedule);
      console.log('Sessions:', activity.sessions);
      console.log('Time Fields:');
      console.log('  - startTime:', activity.startTime);
      console.log('  - endTime:', activity.endTime);
      if (activity.schedule) {
        console.log('  - schedule.startTime:', activity.schedule.startTime);
        console.log('  - schedule.endTime:', activity.schedule.endTime);
      }
      if (activity.sessions && activity.sessions[0]) {
        console.log('  - sessions[0].startTime:', activity.sessions[0].startTime);
        console.log('  - sessions[0].endTime:', activity.sessions[0].endTime);
      }
    }
  } catch (error) {
    console.error('Error fetching data:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testActivityData();