# Calendar Enhancement Plan

## Overview

This plan outlines 8 major calendar enhancements to transform the calendar into a full-featured family activity management system.

---

## Feature 1: Shared Children Calendar Overlay (Priority: HIGH)

### Current State
- Shared children metadata is fetched (`getSharedChildren()`)
- Shared children appear in the filter legend with colors
- **BUG: Shared children activities are NOT fetched** - `activities: []` is hardcoded

### Implementation

#### 1.1 Backend API Enhancement
**File:** `server/src/routes/children.ts`

```typescript
// New endpoint: GET /api/children/shared/activities
router.get('/shared/activities', authMiddleware, async (req, res) => {
  const { startDate, endDate } = req.query;
  const userId = req.user.id;

  // Get all children shared with this user
  const sharedRelationships = await prisma.childSharing.findMany({
    where: { sharedWithId: userId, status: 'accepted' },
    include: { child: true }
  });

  // Get scheduled activities for all shared children
  const sharedChildIds = sharedRelationships.map(r => r.childId);
  const activities = await prisma.childActivity.findMany({
    where: {
      childId: { in: sharedChildIds },
      scheduledDate: { gte: startDate, lte: endDate }
    },
    include: { activity: true, child: true }
  });

  return res.json(activities);
});
```

#### 1.2 Frontend Service Update
**File:** `src/services/childrenService.ts`

```typescript
async getSharedChildrenActivities(
  startDate: Date,
  endDate: Date
): Promise<ChildActivity[]> {
  const response = await apiClient.get('/api/children/shared/activities', {
    params: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  });
  return response.data;
}
```

#### 1.3 Calendar Integration
**File:** `src/screens/CalendarScreenModernFixed.tsx`

Update `loadData()` function:

```typescript
// After fetching shared children metadata
const sharedActivities = await childrenService.getSharedChildrenActivities(
  startDate,
  endDate
);

// Process shared children WITH their activities
const processedShared = shared.map((sharedChild, index) => ({
  ...sharedChild,
  color: CHILD_COLORS[(myChildren.length + index) % CHILD_COLORS.length],
  isVisible: showSharedChildren,
  isShared: true,
  sharedBy: sharedChild.ownerName,
  activities: sharedActivities.filter(a => a.childId === sharedChild.childId),
}));
```

#### 1.4 Visual Distinction for Shared Activities
- Add dashed border or different opacity for shared children's activities
- Show "(Shared by [Parent Name])" badge on activity cards
- Different dot style on calendar (outline vs filled)

### Tasks
- [ ] Create `/api/children/shared/activities` endpoint
- [ ] Add `getSharedChildrenActivities()` to childrenService
- [ ] Update `loadData()` to fetch shared activities
- [ ] Add visual distinction for shared activities
- [ ] Test overlay with multiple shared parents

---

## Feature 2: Quick Add Activity from Calendar (Priority: HIGH)

### Description
Allow users to tap a date and quickly add/schedule an activity for that date.

### Implementation

#### 2.1 Add FAB (Floating Action Button)
**File:** `src/screens/CalendarScreenModernFixed.tsx`

```typescript
// Add FAB at bottom right
<TouchableOpacity
  style={styles.fab}
  onPress={() => handleQuickAdd(selectedDate)}
>
  <Icon name="plus" size={28} color="#fff" />
</TouchableOpacity>

const handleQuickAdd = (date: string) => {
  navigation.navigate('ActivitySearch', {
    preselectedDate: date,
    mode: 'schedule',
  });
};
```

#### 2.2 Long-Press on Date
```typescript
<Calendar
  onDayLongPress={(day) => {
    setSelectedDate(day.dateString);
    showQuickAddOptions(day.dateString);
  }}
/>

const showQuickAddOptions = (date: string) => {
  Alert.alert(
    format(parseISO(date), 'EEEE, MMMM d'),
    'What would you like to do?',
    [
      { text: 'Add Activity', onPress: () => handleQuickAdd(date) },
      { text: 'View Day', onPress: () => setViewMode('day') },
      { text: 'Cancel', style: 'cancel' },
    ]
  );
};
```

#### 2.3 Activity Search Screen Enhancement
**File:** `src/screens/SearchResultsScreen.tsx`

Add mode to pre-select date when scheduling:
```typescript
const { preselectedDate, mode } = route.params || {};

// When activity selected, auto-populate date
const handleActivitySelect = (activity) => {
  if (mode === 'schedule') {
    navigation.navigate('ScheduleActivity', {
      activity,
      preselectedDate,
    });
  }
};
```

### Tasks
- [ ] Add FAB component to calendar screen
- [ ] Implement long-press handler on calendar dates
- [ ] Create quick add options alert/modal
- [ ] Update SearchResults to accept preselectedDate
- [ ] Create/update ScheduleActivity screen with date pre-population
- [ ] Add child selector in quick-add flow

---

## Feature 3: Drag & Drop Rescheduling (Priority: MEDIUM)

### Description
Allow users to drag activities to different dates to reschedule them.

### Implementation

#### 3.1 Install Drag-Drop Library
```bash
npm install react-native-draggable-flatlist
```

#### 3.2 Week View Drag Implementation
**File:** `src/screens/CalendarScreenModernFixed.tsx`

```typescript
import DraggableFlatList from 'react-native-draggable-flatlist';

// In Week View - make activity blocks draggable
const renderWeekActivity = ({ item, drag, isActive }) => (
  <TouchableOpacity
    onLongPress={drag}
    style={[
      styles.weekActivityBlock,
      isActive && styles.dragging,
    ]}
  >
    <Text>{item.activity.name}</Text>
  </TouchableOpacity>
);

// Handle drop on new date
const handleDrop = async (activity, newDate) => {
  Alert.alert(
    'Reschedule Activity',
    `Move "${activity.activity.name}" to ${format(newDate, 'MMM d')}?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reschedule',
        onPress: () => rescheduleActivity(activity.id, newDate),
      },
    ]
  );
};

const rescheduleActivity = async (activityId, newDate) => {
  await childrenService.updateScheduledActivity(activityId, {
    scheduledDate: newDate,
  });
  loadData(); // Refresh calendar
};
```

#### 3.3 Backend Endpoint
**File:** `server/src/routes/children.ts`

```typescript
// PATCH /api/children/activities/:id/reschedule
router.patch('/activities/:id/reschedule', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { scheduledDate, startTime, endTime } = req.body;

  const updated = await prisma.childActivity.update({
    where: { id },
    data: { scheduledDate: new Date(scheduledDate), startTime, endTime },
  });

  return res.json(updated);
});
```

### Tasks
- [ ] Install react-native-draggable-flatlist
- [ ] Implement draggable activity blocks in Week view
- [ ] Add drop zones for each day column
- [ ] Create reschedule confirmation dialog
- [ ] Add backend PATCH endpoint for rescheduling
- [ ] Add `updateScheduledActivity()` to service
- [ ] Handle time slot changes during drag
- [ ] Add undo capability

---

## Feature 4: Native Calendar Sync (Priority: MEDIUM)

### Description
Two-way sync with device's native calendar (iOS Calendar app).

### Implementation

#### 4.1 Install Calendar Library
```bash
npm install react-native-calendar-events
cd ios && pod install
```

#### 4.2 Calendar Sync Service
**File:** `src/services/calendarSyncService.ts`

```typescript
import RNCalendarEvents from 'react-native-calendar-events';

class CalendarSyncService {
  private calendarId: string | null = null;

  async requestPermissions(): Promise<boolean> {
    const status = await RNCalendarEvents.requestPermissions();
    return status === 'authorized';
  }

  async getOrCreateCalendar(): Promise<string> {
    const calendars = await RNCalendarEvents.findCalendars();
    const existing = calendars.find(c => c.title === 'Kids Activities');

    if (existing) {
      this.calendarId = existing.id;
      return existing.id;
    }

    // Create dedicated calendar
    const newCalendar = await RNCalendarEvents.saveCalendar({
      title: 'Kids Activities',
      color: '#4ECDC4',
      entityType: 'event',
      source: { name: 'Kids Activity Tracker', type: 'local' },
    });

    this.calendarId = newCalendar;
    return newCalendar;
  }

  async syncActivityToCalendar(activity: ChildActivity): Promise<string> {
    const calendarId = await this.getOrCreateCalendar();

    const eventId = await RNCalendarEvents.saveEvent(activity.activity.name, {
      calendarId,
      startDate: this.buildDateTime(activity.scheduledDate, activity.startTime),
      endDate: this.buildDateTime(activity.scheduledDate, activity.endTime),
      location: activity.activity.location,
      notes: `Child: ${activity.childName}\n${activity.activity.description}`,
      alarms: [{ date: -60 }], // 1 hour before
    });

    // Store mapping for future syncs
    await this.storeEventMapping(activity.id, eventId);
    return eventId;
  }

  async syncAllActivities(activities: ChildActivity[]): Promise<void> {
    for (const activity of activities) {
      await this.syncActivityToCalendar(activity);
    }
  }

  async removeFromCalendar(activityId: string): Promise<void> {
    const eventId = await this.getEventMapping(activityId);
    if (eventId) {
      await RNCalendarEvents.removeEvent(eventId);
    }
  }
}

export default new CalendarSyncService();
```

#### 4.3 Settings Screen Toggle
**File:** `src/screens/SettingsScreen.tsx`

```typescript
<SettingRow
  title="Sync to iOS Calendar"
  description="Automatically add activities to your calendar"
  value={settings.calendarSync}
  onToggle={handleCalendarSyncToggle}
/>

const handleCalendarSyncToggle = async (enabled: boolean) => {
  if (enabled) {
    const hasPermission = await calendarSyncService.requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please enable calendar access in Settings');
      return;
    }
    await calendarSyncService.syncAllActivities(allActivities);
  }
  updateSettings({ calendarSync: enabled });
};
```

### Tasks
- [ ] Install react-native-calendar-events
- [ ] Add calendar permissions to Info.plist
- [ ] Create CalendarSyncService
- [ ] Add sync toggle to Settings screen
- [ ] Implement auto-sync on activity add/update/delete
- [ ] Store activity-to-event ID mappings
- [ ] Handle sync conflicts
- [ ] Add sync status indicator

---

## Feature 5: Activity Reminders & Notifications (Priority: HIGH)

### Description
Schedule push notifications for upcoming activities.

### Implementation

#### 5.1 Notification Service
**File:** `src/services/notificationService.ts`

```typescript
import notifee, {
  TriggerType,
  TimestampTrigger,
  AndroidImportance
} from '@notifee/react-native';

class NotificationService {
  async requestPermissions(): Promise<boolean> {
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= 1;
  }

  async createChannel(): Promise<void> {
    await notifee.createChannel({
      id: 'activity-reminders',
      name: 'Activity Reminders',
      importance: AndroidImportance.HIGH,
    });
  }

  async scheduleActivityReminder(
    activity: ChildActivity,
    childName: string,
    minutesBefore: number = 60
  ): Promise<string> {
    const activityTime = this.buildDateTime(
      activity.scheduledDate,
      activity.startTime
    );

    const triggerTime = new Date(activityTime.getTime() - minutesBefore * 60000);

    // Don't schedule if in the past
    if (triggerTime <= new Date()) return '';

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: triggerTime.getTime(),
    };

    const notificationId = await notifee.createTriggerNotification(
      {
        id: `reminder-${activity.id}`,
        title: `${childName}'s activity starting soon!`,
        body: `${activity.activity.name} starts in ${minutesBefore} minutes`,
        data: { activityId: activity.id, childId: activity.childId },
        ios: {
          sound: 'default',
          categoryId: 'activity-reminder',
        },
        android: {
          channelId: 'activity-reminders',
          pressAction: { id: 'default' },
        },
      },
      trigger
    );

    return notificationId;
  }

  async cancelReminder(activityId: string): Promise<void> {
    await notifee.cancelNotification(`reminder-${activityId}`);
  }

  async scheduleAllReminders(
    activities: ChildActivity[],
    childrenMap: Map<string, string>
  ): Promise<void> {
    for (const activity of activities) {
      const childName = childrenMap.get(activity.childId) || 'Your child';
      await this.scheduleActivityReminder(activity, childName);
    }
  }
}

export default new NotificationService();
```

#### 5.2 Reminder Options UI
**File:** `src/components/ReminderSelector.tsx`

```typescript
const REMINDER_OPTIONS = [
  { label: 'At time of event', value: 0 },
  { label: '15 minutes before', value: 15 },
  { label: '30 minutes before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '1 day before', value: 1440 },
];

const ReminderSelector = ({ value, onChange }) => (
  <View style={styles.container}>
    <Text style={styles.label}>Remind me</Text>
    {REMINDER_OPTIONS.map(option => (
      <TouchableOpacity
        key={option.value}
        style={[styles.option, value === option.value && styles.selected]}
        onPress={() => onChange(option.value)}
      >
        <Text>{option.label}</Text>
        {value === option.value && <Icon name="check" />}
      </TouchableOpacity>
    ))}
  </View>
);
```

#### 5.3 Integration in Activity Scheduling
When scheduling an activity, allow setting reminder:
```typescript
// In ScheduleActivityScreen
const [reminderMinutes, setReminderMinutes] = useState(60);

const handleSchedule = async () => {
  const scheduled = await childrenService.scheduleActivity(childId, activityId, {
    scheduledDate,
    startTime,
    endTime,
    reminderMinutes,
  });

  if (reminderMinutes > 0) {
    await notificationService.scheduleActivityReminder(
      scheduled,
      childName,
      reminderMinutes
    );
  }
};
```

### Tasks
- [ ] Initialize Notifee in App.tsx
- [ ] Create NotificationService
- [ ] Add notification permissions request
- [ ] Create ReminderSelector component
- [ ] Integrate reminders in activity scheduling flow
- [ ] Store reminder preferences per activity
- [ ] Handle notification tap (deep link to activity)
- [ ] Add Settings screen for default reminder preferences
- [ ] Schedule reminders on app launch for upcoming activities

---

## Feature 6: Conflict Detection (Priority: MEDIUM)

### Description
Warn users when scheduling overlapping activities for the same child.

### Implementation

#### 6.1 Conflict Detection Utility
**File:** `src/utils/conflictDetection.ts`

```typescript
interface TimeSlot {
  date: string;
  startTime: string;
  endTime: string;
}

interface Conflict {
  existingActivity: ChildActivity;
  overlapType: 'full' | 'partial-start' | 'partial-end' | 'contains';
  overlapMinutes: number;
}

export const detectConflicts = (
  newSlot: TimeSlot,
  childId: string,
  existingActivities: ChildActivity[]
): Conflict[] => {
  const conflicts: Conflict[] = [];

  const childActivities = existingActivities.filter(
    a => a.childId === childId &&
    format(a.scheduledDate, 'yyyy-MM-dd') === newSlot.date
  );

  for (const existing of childActivities) {
    const overlap = calculateOverlap(
      newSlot.startTime,
      newSlot.endTime,
      existing.startTime,
      existing.endTime
    );

    if (overlap.minutes > 0) {
      conflicts.push({
        existingActivity: existing,
        overlapType: overlap.type,
        overlapMinutes: overlap.minutes,
      });
    }
  }

  return conflicts;
};

const calculateOverlap = (
  newStart: string,
  newEnd: string,
  existStart: string,
  existEnd: string
): { type: string; minutes: number } => {
  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const ns = toMinutes(newStart);
  const ne = toMinutes(newEnd);
  const es = toMinutes(existStart);
  const ee = toMinutes(existEnd);

  // No overlap
  if (ne <= es || ns >= ee) {
    return { type: 'none', minutes: 0 };
  }

  // Full overlap (new contains existing or existing contains new)
  if (ns <= es && ne >= ee) {
    return { type: 'contains', minutes: ee - es };
  }
  if (es <= ns && ee >= ne) {
    return { type: 'full', minutes: ne - ns };
  }

  // Partial overlap
  if (ns < es) {
    return { type: 'partial-end', minutes: ne - es };
  }
  return { type: 'partial-start', minutes: ee - ns };
};
```

#### 6.2 Conflict Warning UI
**File:** `src/components/ConflictWarning.tsx`

```typescript
const ConflictWarning = ({ conflicts, onProceed, onCancel }) => (
  <Modal visible={conflicts.length > 0} transparent>
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <Icon name="alert-circle" size={48} color="#FF6B6B" />
        <Text style={styles.title}>Scheduling Conflict</Text>
        <Text style={styles.subtitle}>
          This overlaps with {conflicts.length} existing activity:
        </Text>

        {conflicts.map(conflict => (
          <View key={conflict.existingActivity.id} style={styles.conflictItem}>
            <Text style={styles.activityName}>
              {conflict.existingActivity.activity.name}
            </Text>
            <Text style={styles.overlapInfo}>
              {conflict.overlapMinutes} minute overlap
            </Text>
          </View>
        ))}

        <View style={styles.buttons}>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text>Choose Different Time</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onProceed} style={styles.proceedButton}>
            <Text>Schedule Anyway</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);
```

#### 6.3 Integration in Scheduling Flow
```typescript
const handleSchedule = async () => {
  const conflicts = detectConflicts(
    { date: scheduledDate, startTime, endTime },
    selectedChildId,
    allChildActivities
  );

  if (conflicts.length > 0) {
    setShowConflictWarning(true);
    setPendingConflicts(conflicts);
    return;
  }

  await proceedWithScheduling();
};
```

### Tasks
- [ ] Create conflict detection utility
- [ ] Create ConflictWarning component
- [ ] Integrate conflict check before scheduling
- [ ] Show visual indicators on calendar for conflicts
- [ ] Add option to auto-resolve (shift times)
- [ ] Consider travel time between locations

---

## Feature 7: Bulk Operations (Priority: LOW)

### Description
Select and manage multiple activities at once.

### Implementation

#### 7.1 Selection Mode
**File:** `src/screens/CalendarScreenModernFixed.tsx`

```typescript
const [selectionMode, setSelectionMode] = useState(false);
const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());

const toggleActivitySelection = (activityId: string) => {
  const newSelection = new Set(selectedActivities);
  if (newSelection.has(activityId)) {
    newSelection.delete(activityId);
  } else {
    newSelection.add(activityId);
  }
  setSelectedActivities(newSelection);
};

// Long press to enter selection mode
const handleActivityLongPress = (activity: ChildActivity) => {
  if (!selectionMode) {
    setSelectionMode(true);
  }
  toggleActivitySelection(activity.id);
};
```

#### 7.2 Bulk Actions Toolbar
```typescript
{selectionMode && (
  <View style={styles.bulkToolbar}>
    <Text>{selectedActivities.size} selected</Text>
    <TouchableOpacity onPress={handleBulkDelete}>
      <Icon name="trash-outline" />
    </TouchableOpacity>
    <TouchableOpacity onPress={handleBulkExport}>
      <Icon name="share-outline" />
    </TouchableOpacity>
    <TouchableOpacity onPress={handleBulkReschedule}>
      <Icon name="calendar-outline" />
    </TouchableOpacity>
    <TouchableOpacity onPress={() => {
      setSelectionMode(false);
      setSelectedActivities(new Set());
    }}>
      <Icon name="close" />
    </TouchableOpacity>
  </View>
)}
```

#### 7.3 Bulk Operations
```typescript
const handleBulkDelete = () => {
  Alert.alert(
    'Delete Activities',
    `Remove ${selectedActivities.size} activities?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await Promise.all(
            Array.from(selectedActivities).map(id =>
              childrenService.removeScheduledActivity(id)
            )
          );
          setSelectionMode(false);
          setSelectedActivities(new Set());
          loadData();
        },
      },
    ]
  );
};

const handleBulkReschedule = () => {
  // Open date picker, apply new date to all selected
  setShowBulkDatePicker(true);
};
```

### Tasks
- [ ] Add selection mode state
- [ ] Implement long-press to enter selection mode
- [ ] Create bulk actions toolbar
- [ ] Implement bulk delete
- [ ] Implement bulk export (combined ICS file)
- [ ] Implement bulk reschedule
- [ ] Add select all / deselect all
- [ ] Visual selection indicators on activities

---

## Feature 8: Print/Share Calendar View (Priority: LOW)

### Description
Export calendar view as an image or PDF to share.

### Implementation

#### 8.1 Install Dependencies
```bash
npm install react-native-view-shot react-native-share
```

#### 8.2 Share Calendar View
**File:** `src/screens/CalendarScreenModernFixed.tsx`

```typescript
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';

const calendarRef = useRef<ViewShot>(null);

const handleShareCalendar = async () => {
  try {
    const uri = await calendarRef.current?.capture();
    if (uri) {
      await Share.open({
        url: uri,
        type: 'image/png',
        title: `Calendar - ${format(parseISO(selectedDate), 'MMMM yyyy')}`,
      });
    }
  } catch (error) {
    console.error('Error sharing calendar:', error);
  }
};

// Wrap calendar in ViewShot
<ViewShot ref={calendarRef} options={{ format: 'png', quality: 0.9 }}>
  {renderCalendarView()}
</ViewShot>
```

#### 8.3 Print-Friendly View
```typescript
const handlePrintCalendar = async () => {
  // Generate print-optimized view
  setIsPrintMode(true);

  setTimeout(async () => {
    const uri = await calendarRef.current?.capture();
    setIsPrintMode(false);

    // Use system print dialog
    if (uri) {
      await Share.open({
        url: uri,
        type: 'image/png',
        showAppsToView: true,
      });
    }
  }, 100);
};

// Print mode styles (cleaner, no interactive elements)
const printStyles = isPrintMode ? {
  backgroundColor: '#fff',
  hideButtons: true,
  showAllDetails: true,
} : {};
```

### Tasks
- [ ] Install react-native-view-shot and react-native-share
- [ ] Add ViewShot wrapper around calendar
- [ ] Create share button in header
- [ ] Implement print-friendly view mode
- [ ] Add week/month summary export
- [ ] Generate PDF option (using react-native-pdf-lib if needed)

---

## Implementation Order

### Phase 1 (High Priority) - Weeks 1-2
1. **Feature 1**: Shared Children Calendar Overlay (fix the bug, fetch activities)
2. **Feature 5**: Activity Reminders & Notifications
3. **Feature 2**: Quick Add Activity from Calendar

### Phase 2 (Medium Priority) - Weeks 3-4
4. **Feature 6**: Conflict Detection
5. **Feature 4**: Native Calendar Sync
6. **Feature 3**: Drag & Drop Rescheduling

### Phase 3 (Low Priority) - Week 5
7. **Feature 7**: Bulk Operations
8. **Feature 8**: Print/Share Calendar View

---

## Technical Dependencies

| Feature | New Dependencies |
|---------|------------------|
| Drag & Drop | react-native-draggable-flatlist |
| Calendar Sync | react-native-calendar-events |
| Notifications | @notifee/react-native (already installed) |
| Share View | react-native-view-shot, react-native-share |

---

## Database Schema Updates

```sql
-- Add reminder preferences to child_activities table
ALTER TABLE child_activities
ADD COLUMN reminder_minutes INTEGER DEFAULT 60;

-- Add notification tracking
CREATE TABLE activity_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_activity_id UUID REFERENCES child_activities(id),
  notification_id VARCHAR(255),
  scheduled_for TIMESTAMP,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add calendar sync tracking
CREATE TABLE calendar_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_activity_id UUID REFERENCES child_activities(id),
  calendar_event_id VARCHAR(255),
  calendar_type VARCHAR(50), -- 'ios', 'google'
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints Summary

| Endpoint | Method | Feature | Description |
|----------|--------|---------|-------------|
| `/api/children/shared/activities` | GET | 1 | Get shared children's activities |
| `/api/children/activities/:id/reschedule` | PATCH | 3 | Reschedule an activity |
| `/api/children/activities/:id/reminder` | PUT | 5 | Set reminder preferences |
| `/api/children/activities/bulk` | DELETE | 7 | Bulk delete activities |
| `/api/children/activities/bulk/reschedule` | PATCH | 7 | Bulk reschedule activities |

---

## Success Metrics

- [ ] Shared children activities display correctly on calendar
- [ ] Users can add activities directly from calendar view
- [ ] Drag and drop works smoothly in week view
- [ ] Activities sync to iOS Calendar without duplicates
- [ ] Notifications fire at correct times
- [ ] Conflict warnings prevent double-booking
- [ ] Bulk operations work on 10+ activities
- [ ] Calendar screenshots share successfully
