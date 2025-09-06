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
    
    body += `**${activity.name}**\n`;
    body += `Organization: ${activity.organization}\n`;
    
    if (activity.description) {
      body += `\nDescription: ${activity.description}\n`;
    }
    
    if (activity.ageRange) {
      body += `Age Range: ${activity.ageRange.min}-${activity.ageRange.max} years\n`;
    }
    
    if (activity.cost) {
      body += `Cost: $${activity.cost}\n`;
    }
    
    if (activity.dateRange) {
      const startDate = new Date(activity.dateRange.start).toLocaleDateString();
      const endDate = new Date(activity.dateRange.end).toLocaleDateString();
      body += `Dates: ${startDate} - ${endDate}\n`;
    }
    
    if (activity.location) {
      body += `\nLocation: ${activity.location.address || 'Address not available'}\n`;
      if (activity.location.city) {
        body += `City: ${activity.location.city}\n`;
      }
    }
    
    if (activity.registrationUrl) {
      body += `\nRegistration: ${activity.registrationUrl}\n`;
    }
    
    if (activity.sourceUrl) {
      body += `\nMore info: ${activity.sourceUrl}\n`;
    }
    
    body += `\n\nShared from Kids Activity Tracker app`;
    
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