/**
 * Child Fixtures
 * Extended child data for testing various scenarios
 */

// Calculate age from date of birth
const calculateAge = (dateOfBirth: Date): number => {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
};

export const toddlerChild = {
  id: 'child-toddler-1',
  userId: 'user-1',
  name: 'Baby Emma',
  dateOfBirth: new Date('2022-03-15'), // ~2 years old
  interests: ['music', 'play'],
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  get age() {
    return calculateAge(this.dateOfBirth);
  },
};

export const preschoolChild = {
  id: 'child-preschool-1',
  userId: 'user-1',
  name: 'Sophie',
  dateOfBirth: new Date('2020-06-20'), // ~4 years old
  interests: ['art', 'dancing', 'swimming'],
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  get age() {
    return calculateAge(this.dateOfBirth);
  },
};

export const elementaryChild = {
  id: 'child-elementary-1',
  userId: 'user-1',
  name: 'Liam',
  dateOfBirth: new Date('2016-09-10'), // ~8 years old
  interests: ['soccer', 'coding', 'science'],
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  get age() {
    return calculateAge(this.dateOfBirth);
  },
};

export const tweenChild = {
  id: 'child-tween-1',
  userId: 'user-1',
  name: 'Maya',
  dateOfBirth: new Date('2013-01-25'), // ~11 years old
  interests: ['basketball', 'reading', 'drama'],
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  get age() {
    return calculateAge(this.dateOfBirth);
  },
};

export const teenChild = {
  id: 'child-teen-1',
  userId: 'user-1',
  name: 'Alex',
  dateOfBirth: new Date('2009-11-30'), // ~15 years old
  interests: ['programming', 'music', 'volleyball'],
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  get age() {
    return calculateAge(this.dateOfBirth);
  },
};

// Child with activities
export const childWithActivities = {
  id: 'child-with-activities-1',
  userId: 'user-1',
  name: 'Jordan',
  dateOfBirth: new Date('2017-05-15'), // ~7 years old
  interests: ['swimming', 'art', 'soccer'],
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  activities: [
    {
      id: 'child-activity-1',
      childId: 'child-with-activities-1',
      activityId: 'activity-swim-1',
      status: 'enrolled',
      enrolledAt: new Date('2024-01-15T00:00:00.000Z'),
    },
    {
      id: 'child-activity-2',
      childId: 'child-with-activities-1',
      activityId: 'activity-art-1',
      status: 'enrolled',
      enrolledAt: new Date('2024-01-20T00:00:00.000Z'),
    },
  ],
};

// Child from different user
export const otherUserChild = {
  id: 'child-other-user-1',
  userId: 'user-2',
  name: 'Other Child',
  dateOfBirth: new Date('2018-08-10'),
  interests: ['music'],
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

// All test children
export const allChildren = [
  toddlerChild,
  preschoolChild,
  elementaryChild,
  tweenChild,
  teenChild,
  childWithActivities,
  otherUserChild,
];

// Children by age group
export const infantsAndToddlers = allChildren.filter((c) => {
  const age = calculateAge(c.dateOfBirth);
  return age >= 0 && age <= 3;
});

export const preschoolers = allChildren.filter((c) => {
  const age = calculateAge(c.dateOfBirth);
  return age >= 3 && age <= 5;
});

export const schoolAge = allChildren.filter((c) => {
  const age = calculateAge(c.dateOfBirth);
  return age >= 6 && age <= 12;
});

export const teenagers = allChildren.filter((c) => {
  const age = calculateAge(c.dateOfBirth);
  return age >= 13 && age <= 17;
});

// User 1's children only
export const user1Children = allChildren.filter((c) => c.userId === 'user-1');
