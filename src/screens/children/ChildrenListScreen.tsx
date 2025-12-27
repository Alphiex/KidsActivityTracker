import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchChildren,
  selectAllChildren,
  selectChildrenLoading,
  selectChildrenError,
} from '../../store/slices/childrenSlice';
import { ChildCard } from '../../components/children';
import Icon from 'react-native-vector-icons/MaterialIcons';
import useSubscription from '../../hooks/useSubscription';
import UpgradePromptModal from '../../components/UpgradePromptModal';

type ChildrenStackParamList = {
  ChildrenList: undefined;
  AddEditChild: { childId?: string };
  ChildProfile: { childId: string };
};

type NavigationProp = StackNavigationProp<ChildrenStackParamList, 'ChildrenList'>;

const ChildrenListScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const children = useAppSelector(selectAllChildren);
  const loading = useAppSelector(selectChildrenLoading);
  const error = useAppSelector(selectChildrenError);

  const {
    checkAndShowUpgrade,
    showUpgradeModal,
    upgradeFeature,
    hideUpgradeModal,
    limits,
    childrenRemaining,
  } = useSubscription();

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    dispatch(fetchChildren());
  }, [dispatch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchChildren());
    setRefreshing(false);
  };

  const handleAddChild = () => {
    // Check subscription limit before allowing add
    if (checkAndShowUpgrade('children')) {
      navigation.navigate('AddEditChild', {});
    }
  };

  const handleChildPress = (childId: string) => {
    navigation.navigate('ChildProfile', { childId });
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="child-care" size={80} color="#ccc" />
      <Text style={styles.emptyTitle}>No Children Added</Text>
      <Text style={styles.emptySubtitle}>
        Add your children to get personalized activity recommendations
      </Text>
      <TouchableOpacity style={styles.addButton} onPress={handleAddChild}>
        <Text style={styles.addButtonText}>Add Your First Child</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && !refreshing && children.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error-outline" size={60} color="#ff5252" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => dispatch(fetchChildren())}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Children</Text>
          {limits.maxChildren < 99 && (
            <Text style={styles.headerSubtitle}>
              {children.length} of {limits.maxChildren} profiles
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={handleAddChild} style={styles.headerButton}>
          <Icon name="add" size={28} color="#2196F3" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={children}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChildCard
            child={item}
            onPress={() => handleChildPress(item.id)}
            style={styles.childCard}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          children.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2196F3']}
          />
        }
      />

      {/* Upgrade Modal */}
      <UpgradePromptModal
        visible={showUpgradeModal}
        feature={upgradeFeature || 'children'}
        onClose={hideUpgradeModal}
        currentCount={children.length}
        limit={limits.maxChildren}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  headerButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
  },
  emptyListContent: {
    flex: 1,
  },
  childCard: {
    marginBottom: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  addButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ChildrenListScreen;