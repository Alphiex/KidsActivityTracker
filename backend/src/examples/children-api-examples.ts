/**
 * Example usage of the Children Profile Management API
 * 
 * This file demonstrates how to use the various endpoints
 * for managing children profiles and their activities.
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';
let authToken = '';

// Helper function to make authenticated requests
const apiRequest = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
apiRequest.interceptors.request.use(config => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Example: Register and login
async function authenticateUser() {
  try {
    // Register a new user
    const registerResponse = await apiRequest.post('/auth/register', {
      email: 'parent@example.com',
      password: 'SecurePassword123!',
      name: 'John Parent'
    });
    console.log('User registered:', registerResponse.data);

    // Login
    const loginResponse = await apiRequest.post('/auth/login', {
      email: 'parent@example.com',
      password: 'SecurePassword123!'
    });
    
    authToken = loginResponse.data.accessToken;
    console.log('User logged in successfully');
    
    return authToken;
  } catch (error: any) {
    console.error('Authentication error:', error.response?.data || error.message);
  }
}

// Example: Create child profiles
async function createChildren() {
  try {
    // Create first child
    const child1 = await apiRequest.post('/children', {
      name: 'Emma Johnson',
      dateOfBirth: '2018-05-15',
      gender: 'female',
      interests: ['swimming', 'art', 'music'],
      notes: 'Allergic to peanuts'
    });
    console.log('Child 1 created:', child1.data);

    // Create second child
    const child2 = await apiRequest.post('/children', {
      name: 'Liam Johnson',
      dateOfBirth: '2020-08-22',
      gender: 'male',
      interests: ['music', 'sports'],
      notes: 'Loves outdoor activities'
    });
    console.log('Child 2 created:', child2.data);

    return [child1.data.child, child2.data.child];
  } catch (error: any) {
    console.error('Error creating children:', error.response?.data || error.message);
  }
}

// Example: Get all children with stats
async function getChildrenWithStats() {
  try {
    const response = await apiRequest.get('/children/stats');
    console.log('Children with stats:', response.data.children);
    return response.data.children;
  } catch (error: any) {
    console.error('Error getting children:', error.response?.data || error.message);
  }
}

// Example: Search for activities and link to child
async function linkActivitiesToChild(childId: string) {
  try {
    // First, search for swimming activities (assuming this endpoint exists)
    const searchResponse = await apiRequest.post('/activities/search', {
      category: 'swimming',
      ageMin: 5,
      ageMax: 8,
      city: 'Richmond'
    });
    
    const activities = searchResponse.data.activities || [];
    
    if (activities.length > 0) {
      // Link first 3 activities as "interested"
      const activityIds = activities.slice(0, 3).map((a: any) => a.id);
      
      const linkResponse = await apiRequest.post('/child-activities/bulk-link', {
        childId,
        activityIds,
        status: 'interested'
      });
      
      console.log(`Linked ${linkResponse.data.linkedCount} activities to child`);
      
      // Register for the first activity
      if (activityIds[0]) {
        await apiRequest.put(`/child-activities/${childId}/activities/${activityIds[0]}`, {
          status: 'registered',
          notes: 'Excited to start!'
        });
        console.log('Registered for first activity');
      }
    }
  } catch (error: any) {
    console.error('Error linking activities:', error.response?.data || error.message);
  }
}

// Example: Get age-appropriate recommendations
async function getRecommendations(childId: string) {
  try {
    const response = await apiRequest.get(`/child-activities/${childId}/recommendations`);
    console.log('Recommended activities:', response.data.activities.length);
    
    // Display first 5 recommendations
    response.data.activities.slice(0, 5).forEach((activity: any) => {
      console.log(`- ${activity.name} (${activity.category}) - Ages ${activity.ageMin}-${activity.ageMax}`);
    });
    
    return response.data.activities;
  } catch (error: any) {
    console.error('Error getting recommendations:', error.response?.data || error.message);
  }
}

// Example: Get calendar data for the month
async function getCalendarData(childIds?: string[]) {
  try {
    const params: any = {
      view: 'month',
      date: new Date().toISOString()
    };
    
    if (childIds && childIds.length > 0) {
      params.childIds = childIds.join(',');
    }
    
    const response = await apiRequest.get('/child-activities/calendar', { params });
    console.log('Calendar events:', response.data.events);
    
    // Group events by date
    const eventsByDate: Record<string, any[]> = {};
    response.data.events.forEach((event: any) => {
      const date = new Date(event.startDate).toLocaleDateString();
      if (!eventsByDate[date]) {
        eventsByDate[date] = [];
      }
      eventsByDate[date].push(event);
    });
    
    console.log('Events by date:', eventsByDate);
    return eventsByDate;
  } catch (error: any) {
    console.error('Error getting calendar data:', error.response?.data || error.message);
  }
}

// Example: Mark activity as completed with rating
async function completeActivity(childId: string, activityId: string) {
  try {
    const response = await apiRequest.put(`/child-activities/${childId}/activities/${activityId}`, {
      status: 'completed',
      rating: 5,
      notes: 'Emma had a great time! The instructor was very patient and encouraging.'
    });
    
    console.log('Activity marked as completed:', response.data);
  } catch (error: any) {
    console.error('Error completing activity:', error.response?.data || error.message);
  }
}

// Example: Get activity history with filters
async function getActivityHistory(childId?: string) {
  try {
    const params: any = {
      status: 'completed',
      minRating: 4,
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() // Last 90 days
    };
    
    if (childId) {
      params.childId = childId;
    }
    
    const response = await apiRequest.get('/child-activities/history', { params });
    console.log(`Found ${response.data.activities.length} completed activities with 4+ stars`);
    
    response.data.activities.forEach((activity: any) => {
      console.log(`- ${activity.activity.name}: ${activity.rating}/5 stars`);
    });
    
    return response.data.activities;
  } catch (error: any) {
    console.error('Error getting activity history:', error.response?.data || error.message);
  }
}

// Example: Update child interests based on activity history
async function updateChildInterests(childId: string) {
  try {
    // Get child's activity history
    const history = await getActivityHistory(childId);
    
    // Find most common categories from completed activities
    const categoryCount: Record<string, number> = {};
    history.forEach((item: any) => {
      const category = item.activity.category;
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });
    
    // Get top 3 categories
    const topCategories = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category);
    
    // Update child's interests
    const response = await apiRequest.patch(`/children/${childId}/interests`, {
      interests: topCategories
    });
    
    console.log('Updated child interests:', response.data.child.interests);
  } catch (error: any) {
    console.error('Error updating interests:', error.response?.data || error.message);
  }
}

// Example: Full workflow
async function runFullExample() {
  console.log('=== Children Profile Management API Examples ===\n');
  
  // 1. Authenticate
  console.log('1. Authenticating user...');
  await authenticateUser();
  
  // 2. Create children
  console.log('\n2. Creating child profiles...');
  const children = await createChildren();
  
  if (!children || children.length === 0) {
    console.log('No children created, exiting...');
    return;
  }
  
  // 3. Link activities to first child
  console.log('\n3. Linking activities to first child...');
  await linkActivitiesToChild(children[0].id);
  
  // 4. Get recommendations
  console.log('\n4. Getting age-appropriate recommendations...');
  await getRecommendations(children[0].id);
  
  // 5. Get children with stats
  console.log('\n5. Getting children with activity stats...');
  await getChildrenWithStats();
  
  // 6. Get calendar data
  console.log('\n6. Getting calendar data for all children...');
  await getCalendarData(children.map(c => c.id));
  
  // 7. Get upcoming activities
  console.log('\n7. Getting upcoming activities...');
  try {
    const upcomingResponse = await apiRequest.get('/child-activities/upcoming');
    console.log(`Found ${upcomingResponse.data.activities.length} upcoming activities`);
  } catch (error: any) {
    console.error('Error getting upcoming activities:', error.response?.data || error.message);
  }
  
  console.log('\n=== Examples completed ===');
}

// Run the examples
if (require.main === module) {
  runFullExample().catch(console.error);
}

export {
  authenticateUser,
  createChildren,
  getChildrenWithStats,
  linkActivitiesToChild,
  getRecommendations,
  getCalendarData,
  completeActivity,
  getActivityHistory,
  updateChildInterests
};