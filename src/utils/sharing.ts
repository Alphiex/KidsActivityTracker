import { Linking, Alert } from 'react-native';
import { Activity } from '../types';
import { Child } from '../store/slices/childrenSlice';

interface ShareActivityOptions {
  activity: Activity;
  child?: Child;
  status?: 'planned' | 'in_progress' | 'completed';
}

export const shareActivityViaEmail = async ({
  activity,
  child,
  status = 'planned',
}: ShareActivityOptions) => {
  try {
    const subject = child
      ? `Activity for ${child.name}: ${activity.name}`
      : `Check out this activity: ${activity.name}`;

    let body = `Hi,\n\n`;

    if (child) {
      body += `I wanted to share this activity that ${child.name} is ${status === 'planned' ? 'planning to join' : status === 'in_progress' ? 'currently enrolled in' : 'has completed'}:\n\n`;
    } else {
      body += `I found this great activity that might interest you:\n\n`;
    }

    // Activity Name and Organization
    body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    body += `🎯 ${activity.name.toUpperCase()}\n`;
    body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (activity.organization) {
      body += `Organization: ${activity.organization}\n`;
    }

    if (activity.category || activity.subcategory) {
      body += `Category: ${activity.category || ''}${activity.subcategory ? ` - ${activity.subcategory}` : ''}\n`;
    }

    // Registration Status
    if (activity.registrationStatus) {
      const statusEmoji = activity.registrationStatus.toLowerCase() === 'open' ? '✅' :
                          activity.registrationStatus.toLowerCase() === 'waitlist' ? '⏳' : '❌';
      body += `Registration: ${statusEmoji} ${activity.registrationStatus}\n`;
    }

    body += `\n📋 DETAILS\n`;
    body += `────────────────\n`;

    // Description
    if (activity.fullDescription || activity.description) {
      body += `\n${activity.fullDescription || activity.description}\n`;
    }

    body += `\n📅 SCHEDULE\n`;
    body += `────────────────\n`;

    // Dates
    if (activity.dates) {
      body += `Dates: ${activity.dates}\n`;
    } else if (activity.dateRange) {
      const startDate = new Date(activity.dateRange.start).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const endDate = new Date(activity.dateRange.end).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      body += `Dates: ${startDate} - ${endDate}\n`;
    }

    // Time
    if (activity.startTime && activity.endTime) {
      body += `Time: ${activity.startTime} - ${activity.endTime}\n`;
    } else if (activity.schedule) {
      body += `Schedule: ${typeof activity.schedule === 'string' ? activity.schedule : 'See details'}\n`;
    }

    // Sessions
    if (activity.sessions && activity.sessions.length > 0) {
      body += `Sessions: ${activity.sessions.length} total\n`;
      activity.sessions.slice(0, 3).forEach((session, index) => {
        body += `  • Session ${session.sessionNumber || index + 1}: `;
        if (session.date) body += session.date;
        if (session.startTime) body += ` at ${session.startTime}`;
        body += `\n`;
      });
      if (activity.sessions.length > 3) {
        body += `  • ... and ${activity.sessions.length - 3} more sessions\n`;
      }
    }

    body += `\n👥 PARTICIPANT INFO\n`;
    body += `────────────────\n`;

    // Age Range
    if (activity.ageRange) {
      body += `Ages: ${activity.ageRange.min}-${activity.ageRange.max} years\n`;
    }

    // Spots Available
    if (activity.spotsAvailable !== undefined) {
      body += `Available Spots: ${activity.spotsAvailable}`;
      if (activity.totalSpots) {
        body += ` out of ${activity.totalSpots}`;
      }
      body += `\n`;
    }

    // Instructor
    if (activity.instructor) {
      body += `Instructor: ${activity.instructor}\n`;
    }

    body += `\n💰 COST\n`;
    body += `────────────────\n`;

    // Cost
    if (activity.cost !== undefined) {
      body += `Price: $${activity.cost}`;
      if (activity.costIncludesTax === false) {
        body += ` (plus tax)`;
      }
      body += `\n`;
    }

    // Required Extras
    if (activity.requiredExtras && activity.requiredExtras.length > 0) {
      body += `Additional Required Items:\n`;
      activity.requiredExtras.forEach(extra => {
        body += `  • ${extra.name}: ${extra.cost}\n`;
      });
    }

    body += `\n📍 LOCATION\n`;
    body += `────────────────\n`;

    // Location Details
    if (activity.locationName || activity.facility) {
      body += `${activity.locationName || activity.facility}\n`;
    }

    if (activity.location) {
      const locationStr = typeof activity.location === 'string' ?
        activity.location :
        activity.location.address || 'Address not available';
      body += `${locationStr}\n`;

      if (typeof activity.location === 'object' && activity.location.city) {
        body += `${activity.location.city}\n`;
      }
    } else if (activity.address) {
      body += `${activity.address}\n`;
      if (activity.city) body += `${activity.city}\n`;
    }

    // Contact Info
    if (activity.contactInfo) {
      body += `Contact: ${activity.contactInfo}\n`;
    }

    // Prerequisites
    if (activity.prerequisites) {
      body += `\n📚 PREREQUISITES\n`;
      body += `────────────────\n`;
      if (typeof activity.prerequisites === 'string') {
        body += `${activity.prerequisites}\n`;
      } else if (Array.isArray(activity.prerequisites)) {
        activity.prerequisites.forEach(prereq => {
          const prereqName = typeof prereq === 'string' ? prereq : prereq.name;
          body += `  • ${prereqName}\n`;
        });
      }
    }

    // What to Bring
    if (activity.whatToBring) {
      body += `\n🎒 WHAT TO BRING\n`;
      body += `────────────────\n`;
      body += `${activity.whatToBring}\n`;
    }

    body += `\n🔗 REGISTRATION\n`;
    body += `════════════════\n`;

    // Registration Link
    const registrationUrl = activity.directRegistrationUrl || activity.registrationUrl;
    if (registrationUrl) {
      body += `Click here to register:\n${registrationUrl}\n`;
    } else {
      body += `Registration URL not available\n`;
    }

    // Additional Links
    if (activity.detailUrl && activity.detailUrl !== registrationUrl) {
      body += `\nView full details:\n${activity.detailUrl}\n`;
    }

    if (activity.sourceUrl && activity.sourceUrl !== registrationUrl && activity.sourceUrl !== activity.detailUrl) {
      body += `\nMore information:\n${activity.sourceUrl}\n`;
    }

    body += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    body += `Shared from Kids Activity Tracker app\n`;
    body += `Find more great activities for your kids!\n`;

    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    const canOpen = await Linking.canOpenURL(mailto);

    if (canOpen) {
      await Linking.openURL(mailto);
    } else {
      Alert.alert('Error', 'Unable to open email client');
    }
  } catch (error) {
    console.error('Error sharing via email:', error);
    Alert.alert('Error', 'Failed to share activity via email');
  }
};

export const formatActivityForSharing = (activity: Activity, child?: Child): string => {
  let text = `${activity.name}\n`;
  text += `By ${activity.organization}\n`;
  
  if (activity.ageRange) {
    text += `Ages ${activity.ageRange.min}-${activity.ageRange.max}\n`;
  }
  
  if (activity.cost) {
    text += `Cost: $${activity.cost}\n`;
  }
  
  if (activity.location?.address) {
    text += `Location: ${activity.location.address}\n`;
  }
  
  if (child) {
    text += `\nFor: ${child.name}`;
  }
  
  return text;
};