import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ViewStyle,
} from 'react-native';
import { Child } from '../../store/slices/childrenSlice';
import childrenService from '../../services/childrenService';
import ChildAvatar from './ChildAvatar';

interface ChildCardProps {
  child: Child;
  onPress: () => void;
  style?: ViewStyle;
}

const ChildCard: React.FC<ChildCardProps> = ({ child, onPress, style }) => {
  const age = childrenService.calculateAge(child.dateOfBirth);
  const ageGroup = childrenService.getAgeGroup(age);

  return (
    <TouchableOpacity style={[styles.container, style]} onPress={onPress}>
      <View style={styles.content}>
        <ChildAvatar
          name={child.name}
          avatarUrl={child.avatar}
          size={60}
        />
        <View style={styles.info}>
          <Text style={styles.name}>{child.name}</Text>
          <Text style={styles.age}>
            {age} years old • {ageGroup}
          </Text>
          {child.interests && child.interests.length > 0 && (
            <View style={styles.interestsContainer}>
              {child.interests.slice(0, 3).map((interest, index) => (
                <View key={index} style={styles.interestBadge}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
              {child.interests.length > 3 && (
                <Text style={styles.moreInterests}>
                  +{child.interests.length - 3} more
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  age: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  interestBadge: {
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  interestText: {
    fontSize: 12,
    color: '#2196F3',
  },
  moreInterests: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default ChildCard;