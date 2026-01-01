import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Activity } from '../../types';
import { Colors, Theme } from '../../theme';
import { formatActivityPrice } from '../../utils/formatters';
import { getActivityImageByKey } from '../../assets/images';
import { getActivityImageKey } from '../../utils/activityHelpers';

interface MapActivityCardProps {
  activity: Activity;
  onPress: () => void;
  onClose?: () => void;
  showCloseButton?: boolean;
}

const MapActivityCard: React.FC<MapActivityCardProps> = ({
  activity,
  onPress,
  onClose,
  showCloseButton = false,
}) => {
  const getImageKeyAndType = () => {
    const activityType = Array.isArray(activity.activityType)
      ? (typeof activity.activityType[0] === 'string' ? activity.activityType[0] : (activity.activityType[0] as any)?.name)
      : (activity.activityType as any)?.name;
    const category = activity.category || activityType || '';
    return {
      key: getActivityImageKey(category, activity.subcategory, activity.name),
      type: activityType,
    };
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.95}>
      {showCloseButton && onClose && (
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Icon name="close" size={18} color="#666" />
        </TouchableOpacity>
      )}
      
      <View style={styles.imageContainer}>
        <Image
          source={(() => {
            const { key, type } = getImageKeyAndType();
            return getActivityImageByKey(key, type);
          })()}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>{formatActivityPrice(activity.cost)}</Text>
        </View>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{activity.name}</Text>
        
        <View style={styles.infoRow}>
          <Icon name="map-marker" size={14} color={Colors.primary} />
          <Text style={styles.infoText} numberOfLines={1}>
            {typeof activity.location === 'string' 
              ? activity.location 
              : activity.location?.name || activity.locationName || 'Location TBD'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Icon name="account-child" size={14} color={Colors.primary} />
          <Text style={styles.infoText}>
            {(() => {
              const min = activity.ageRange?.min ?? 0;
              const max = activity.ageRange?.max ?? 18;
              if (min <= 1 && max >= 90) return 'All ages';
              if (min === max) return `Age ${min}`;
              if (max >= 90) return `Ages ${min}+`;
              return `Ages ${min}-${max}`;
            })()}
          </Text>
        </View>

        {activity.spotsAvailable !== undefined && activity.spotsAvailable !== null && (
          <View style={[
            styles.spotsBadge,
            activity.spotsAvailable === 0 && styles.spotsBadgeFull,
            activity.spotsAvailable <= 3 && activity.spotsAvailable > 0 && styles.spotsBadgeLimited,
          ]}>
            <Text style={[
              styles.spotsText,
              activity.spotsAvailable === 0 && styles.spotsTextFull,
              activity.spotsAvailable <= 3 && activity.spotsAvailable > 0 && styles.spotsTextLimited,
            ]}>
              {activity.spotsAvailable === 0 ? 'FULL' : `${activity.spotsAvailable} spots left`}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.chevronContainer}>
        <Icon name="chevron-right" size={24} color="#CCC" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    ...Theme.shadows.md,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: 100,
    height: 120,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  priceTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#717171',
    marginLeft: 6,
    flex: 1,
  },
  spotsBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: Colors.success + '20',
    marginTop: 4,
  },
  spotsBadgeFull: {
    backgroundColor: Colors.error + '20',
  },
  spotsBadgeLimited: {
    backgroundColor: Colors.warning + '20',
  },
  spotsText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.success,
  },
  spotsTextFull: {
    color: Colors.error,
  },
  spotsTextLimited: {
    color: Colors.warning,
  },
  chevronContainer: {
    justifyContent: 'center',
    paddingRight: 12,
  },
});

export default MapActivityCard;
