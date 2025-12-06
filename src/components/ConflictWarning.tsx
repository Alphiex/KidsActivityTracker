import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ModernColors } from '../theme/modernTheme';
import { Conflict, TimeSlot } from '../utils/conflictDetection';

interface ConflictWarningProps {
  visible: boolean;
  conflicts: Conflict[];
  newActivityName: string;
  alternativeTimes?: TimeSlot[];
  onProceed: () => void;
  onCancel: () => void;
  onSelectAlternative?: (slot: TimeSlot) => void;
}

const ConflictWarning: React.FC<ConflictWarningProps> = ({
  visible,
  conflicts,
  newActivityName,
  alternativeTimes = [],
  onProceed,
  onCancel,
  onSelectAlternative,
}) => {
  if (!visible || conflicts.length === 0) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon name="alert-circle" size={40} color="#FF6B6B" />
            </View>
            <Text style={styles.title}>Scheduling Conflict</Text>
            <Text style={styles.subtitle}>
              "{newActivityName}" overlaps with {conflicts.length}{' '}
              {conflicts.length === 1 ? 'activity' : 'activities'}
            </Text>
          </View>

          {/* Conflict List */}
          <ScrollView style={styles.conflictList} showsVerticalScrollIndicator={false}>
            {conflicts.map((conflict, index) => (
              <View key={index} style={styles.conflictItem}>
                <View style={styles.conflictIcon}>
                  <Icon name="calendar-clock" size={20} color={ModernColors.textSecondary} />
                </View>
                <View style={styles.conflictDetails}>
                  <Text style={styles.conflictName}>
                    {conflict.existingActivityName}
                  </Text>
                  <Text style={styles.conflictOverlap}>
                    {conflict.overlapDescription}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Alternative Times */}
          {alternativeTimes.length > 0 && onSelectAlternative && (
            <View style={styles.alternativesSection}>
              <Text style={styles.alternativesTitle}>Suggested Times</Text>
              <View style={styles.alternativesList}>
                {alternativeTimes.map((slot, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.alternativeButton}
                    onPress={() => onSelectAlternative(slot)}
                  >
                    <Icon name="clock-outline" size={16} color={ModernColors.primary} />
                    <Text style={styles.alternativeText}>
                      {slot.startTime} - {slot.endTime}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Choose Different Time</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.proceedButton]}
              onPress={onProceed}
            >
              <Text style={styles.proceedButtonText}>Schedule Anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: ModernColors.background,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: ModernColors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: ModernColors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  conflictList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  conflictItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  conflictIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ModernColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  conflictDetails: {
    flex: 1,
  },
  conflictName: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
  },
  conflictOverlap: {
    fontSize: 13,
    color: '#FF6B6B',
    marginTop: 2,
  },
  alternativesSection: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: ModernColors.borderLight,
  },
  alternativesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: ModernColors.textSecondary,
    marginBottom: 12,
  },
  alternativesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  alternativeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ModernColors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ModernColors.primary,
    gap: 6,
  },
  alternativeText: {
    fontSize: 14,
    color: ModernColors.primary,
    fontWeight: '500',
  },
  actions: {
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: ModernColors.surface,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
  },
  proceedButton: {
    backgroundColor: '#FF6B6B',
  },
  proceedButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ConflictWarning;
