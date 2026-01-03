import { StyleSheet } from 'react-native';

export const COLORS = {
  primary: '#E8638B',
  text: '#222222',
  textSecondary: '#717171',
  background: '#FFFFFF',
  border: '#EBEBEB',
  checkboxUnchecked: '#DDDDDD',
  searchBackground: '#F7F7F7',
};

export const styles = StyleSheet.create({
  // Container
  container: {
    flex: 1,
  },

  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.searchBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text, // Default color for iOS, overridden by theme
    padding: 0,
  },
  searchClearButton: {
    padding: 4,
  },

  // Province Row
  provinceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  provinceCheckbox: {
    marginRight: 12,
  },
  provinceContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  provinceName: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  provinceRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandIcon: {
    marginLeft: 8,
  },

  // City Row
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 40,
    paddingRight: 16,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cityCheckbox: {
    marginRight: 12,
  },
  cityContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cityName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  cityRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Location Row
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 64,
    paddingRight: 16,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  locationCheckbox: {
    marginRight: 12,
  },
  locationContent: {
    flex: 1,
  },
  locationName: {
    fontSize: 15,
    color: COLORS.text,
  },
  locationMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Selection Badge
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
  },
  badgeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  badgeSelected: {
    backgroundColor: '#FFE4E8',
  },
  badgeTextSelected: {
    color: COLORS.primary,
  },

  // Activity count
  activityCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
});
