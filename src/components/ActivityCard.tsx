import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { Activity } from '../types';
import { useStore } from '../store';
import FavoritesService from '../services/favoritesService';
import { Colors, Theme } from '../theme';
import { getPrimaryActivityImage } from '../assets/images';

const { width } = Dimensions.get('window');

interface ActivityCardProps {
  activity: Activity;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity }) => {
  const { favoriteActivities, toggleFavorite } = useStore();
  const favoritesService = FavoritesService.getInstance();
  const [isFavorite, setIsFavorite] = useState(false);
  const [hasCapacityAlert, setHasCapacityAlert] = useState(false);

  useEffect(() => {
    setIsFavorite(favoritesService.isFavorite(activity.id));
    const alerts = favoritesService.getCapacityAlertsForActivity(activity.id);
    setHasCapacityAlert(alerts.length > 0);
  }, [activity.id]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getActivityIcon = (type: string) => {
    const iconMap: { [key: string]: string } = {
      camps: 'tent',
      sports: 'basketball',
      arts: 'palette',
      swimming: 'swim',
      education: 'school',
      general: 'star',
    };
    return iconMap[type] || 'star';
  };

  const getCapacityColor = (spotsLeft?: number) => {
    if (!spotsLeft) return Colors.success;
    if (spotsLeft <= 1) return '#FF5252';
    if (spotsLeft <= 3) return '#FF9800';
    return Colors.success;
  };

  return (
    <View style={styles.card}>
      <View style={styles.imageContainer}>
        <Image 
          source={getPrimaryActivityImage(activity.activityType || [])} 
          style={styles.image} 
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.imageGradient}
        />
        <View style={styles.imageOverlay}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceText}>${activity.cost}</Text>
            <Text style={styles.priceLabel}>per child</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => {
            favoritesService.toggleFavorite(activity);
            setIsFavorite(!isFavorite);
            toggleFavorite(activity.id);
          }}
          style={styles.favoriteButton}
        >
          <Icon
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={24}
            color={isFavorite ? '#FF6B6B' : '#666'}
          />
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {activity.name}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Icon name="map-marker" size={16} color={Colors.primary} />
          <Text style={styles.infoText} numberOfLines={1}>
            {typeof activity.location === 'string' 
              ? activity.location 
              : activity.location?.name || activity.locationName || 'Location TBD'}
          </Text>
        </View>

        {activity.dateRange && (
          <View style={styles.infoRow}>
            <Icon name="calendar-range" size={16} color={Colors.primary} />
            <Text style={styles.infoText}>
              {formatDate(activity.dateRange.start)} - {formatDate(activity.dateRange.end)}
            </Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Icon name="account-child" size={16} color={Colors.primary} />
          <Text style={styles.infoText}>
            Ages {activity.ageRange.min} - {activity.ageRange.max} years
          </Text>
        </View>

        <View style={styles.bottomSection}>
          <View style={styles.spotsContainer}>
            {activity.spotsAvailable === 0 ? (
              <View style={styles.fullBadge}>
                <Text style={styles.fullText}>FULL</Text>
              </View>
            ) : activity.spotsAvailable <= 3 ? (
              <View style={[styles.limitedBadge, { backgroundColor: getCapacityColor(activity.spotsAvailable) + '20' }]}>
                <Icon name="alert-circle" size={14} color={getCapacityColor(activity.spotsAvailable)} />
                <Text style={[styles.limitedText, { color: getCapacityColor(activity.spotsAvailable) }]}>
                  Only {activity.spotsAvailable} {activity.spotsAvailable === 1 ? 'spot' : 'spots'} left!
                </Text>
                {hasCapacityAlert && (
                  <Icon name="bell-ring" size={14} color={getCapacityColor(activity.spotsAvailable)} style={{ marginLeft: 4 }} />
                )}
              </View>
            ) : activity.spotsAvailable <= 5 ? (
              <View style={styles.limitedBadge}>
                <Icon name="alert-circle" size={14} color={Colors.warning} />
                <Text style={styles.limitedText}>
                  Only {activity.spotsAvailable} spots left!
                </Text>
              </View>
            ) : (
              <View style={styles.availableBadge}>
                <Icon name="check-circle" size={14} color={Colors.success} />
                <Text style={styles.availableText}>
                  {activity.spotsAvailable} spots available
                </Text>
              </View>
            )}
          </View>

          <View style={styles.activityIcons}>
            {activity.activityType.slice(0, 3).map((type) => (
              <View 
                key={type} 
                style={[
                  styles.activityIcon,
                  { backgroundColor: (Colors.activities[type] || Colors.primary) + '20' }
                ]}
              >
                <Icon 
                  name={getActivityIcon(type)} 
                  size={20} 
                  color={Colors.activities[type] || Colors.primary} 
                />
              </View>
            ))}
          </View>
        </View>
      </View>
      
      {/* New: Quick Action Buttons */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickActionButton}>
          <Icon name="share-variant" size={20} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionButton}>
          <Icon name="calendar-plus" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginBottom: Theme.spacing.md,
    ...Theme.shadows.md,
    overflow: 'hidden',
    elevation: 4,
  },
  imageContainer: {
    position: 'relative',
    height: 200,
    backgroundColor: '#f5f5f5',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Theme.spacing.md,
  },
  priceContainer: {
    alignItems: 'flex-start',
  },
  priceText: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  priceLabel: {
    fontSize: 14,
    color: Colors.white,
    opacity: 0.9,
  },
  favoriteButton: {
    position: 'absolute',
    top: Theme.spacing.sm,
    right: Theme.spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: Theme.borderRadius.round,
    padding: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  content: {
    padding: Theme.spacing.md,
  },
  header: {
    marginBottom: Theme.spacing.sm,
  },
  title: {
    ...Theme.typography.h5,
    color: Colors.text.primary,
    marginBottom: Theme.spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
  },
  infoText: {
    ...Theme.typography.bodySmall,
    color: Colors.text.secondary,
    marginLeft: Theme.spacing.sm,
    flex: 1,
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Theme.spacing.md,
  },
  spotsContainer: {
    flex: 1,
  },
  fullBadge: {
    backgroundColor: Colors.error + '20',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  fullText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.error,
  },
  limitedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  limitedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.warning,
    marginLeft: 4,
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '20',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  availableText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.success,
    marginLeft: 4,
  },
  activityIcons: {
    flexDirection: 'row',
    marginLeft: Theme.spacing.sm,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: Theme.borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Theme.spacing.xs,
  },
  quickActions: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickActionButton: {
    padding: 8,
    marginHorizontal: 2,
  },
});

export default ActivityCard;