# Screen Development Rules and Guidelines

## 🚨 CRITICAL RULE: No Duplicate Screens

**Before creating ANY new screen, you MUST:**
1. Search existing screens for similar functionality
2. Check navigation files for existing implementations  
3. Review this document for screen inventory
4. Consider extending existing screens instead of creating new ones

## Pre-Development Checklist

### ✅ Before Creating a New Screen

1. **Search for Existing Screens**
   ```bash
   # Search for similar screen names
   find src/screens -name "*[KeywordOfYourScreen]*" -type f
   
   # Search for similar functionality in existing screens
   grep -r "your-functionality-keyword" src/screens/
   ```

2. **Check Navigation Usage**
   ```bash
   # Check if similar screens exist in navigation
   grep -r "YourScreenKeyword" src/navigation/
   ```

3. **Review Documentation**
   - Check `SCREEN_ANALYSIS_AND_CONSOLIDATION.md` for existing screen inventory
   - Review this rules document

4. **Consider Alternatives**
   - Can you extend an existing screen with props/configuration?
   - Can you create a shared component instead of a full screen?
   - Can you modify an existing screen to handle your use case?

### ✅ Screen Naming Convention

Use these standardized suffixes ONLY when absolutely necessary:

- **NO SUFFIX**: Default implementation (preferred)
- **Enhanced**: Only when significantly more features than basic version
- **Simple**: Only for simplified versions of complex screens (avoid if possible)

**❌ FORBIDDEN Suffixes:**
- `New` - Temporary suffix that indicates incomplete consolidation
- `Test` - Should never be in production code
- `Backup` - Use git for backups, not filename suffixes
- `Old` - Delete old versions, don't rename them
- `V2`, `V3` - Use proper versioning through git commits

### ✅ File Organization Rules

```
src/screens/
├── auth/                 # Authentication screens only
├── children/             # Child management screens only  
├── preferences/          # User preference screens only
├── activities/           # Activity detail screens only
└── [functional-name].tsx # All other screens (no subfolders unless >5 related screens)

src/components/           # Reusable UI components
├── activities/           # Activity-specific components
├── [functional-area]/    # Functional groupings
└── [component-name].tsx  # General components
```

## Screen Creation Guidelines

### When to Create a New Screen
- **Unique navigation destination** with distinct URL/route
- **Completely different user workflow** that can't be handled with props
- **Significantly different layout** that would require major conditional rendering

### When NOT to Create a New Screen  
- **Slight variations** in data display → Use props and conditional rendering
- **Different data sources** for same layout → Pass data as props
- **Minor feature additions** → Extend existing screen
- **Testing purposes** → Use feature flags or separate test environment

### Preferred Alternatives to New Screens

1. **Props-Based Variation**
   ```typescript
   // Good: Single screen with variations
   <ActivityListScreen 
     source="favorites" 
     title="My Favorites"
     showCapacityAlerts={true}
   />
   
   // Bad: Separate FavoritesScreen
   ```

2. **Higher-Order Components**
   ```typescript
   // Good: Wrap existing screen with additional functionality  
   export const EnhancedActivityScreen = withLocationTracking(ActivityScreen);
   
   // Bad: Duplicate entire screen with location tracking
   ```

3. **Composition Pattern**
   ```typescript
   // Good: Compose screens from reusable parts
   const ActivityDetailScreen = () => (
     <ScreenLayout>
       <ActivityHeader />
       <ActivityContent enhanced={true} />
       <ActionButtons showRegister showShare />
     </ScreenLayout>
   );
   ```

## Code Review Requirements

### For New Screens
All new screen PRs must include:
- [ ] Justification for why existing screens cannot be extended
- [ ] Evidence of searching for existing similar functionality  
- [ ] Navigation integration plan
- [ ] Testing plan
- [ ] Documentation updates

### For Screen Modifications
- [ ] Check impact on other screens using the same components
- [ ] Update navigation if routes change
- [ ] Test all affected user flows
- [ ] Update documentation if functionality changes

## Maintenance Rules

### Monthly Cleanup (First Friday of Each Month)
1. **Audit Unused Screens**
   ```bash
   # Find screens not imported in navigation
   comm -23 <(find src/screens -name "*.tsx" -exec basename {} \; | sort) \
            <(grep -h "import.*Screen" src/navigation/*.tsx | sed 's/.*from.*\///g' | sed 's/[\'\";]//g' | sort)
   ```

2. **Check for New Duplicates**
   ```bash
   # Look for potential duplicate names
   find src/screens -name "*.tsx" | xargs basename -a | sort | uniq -d
   ```

3. **Validate Navigation Links**
   - Ensure all imported screens are actually used in navigation
   - Remove any dead imports

### Immediate Actions for Rule Violations

**If you find duplicate functionality:**
1. Immediately create a consolidation plan
2. Add it to the project backlog
3. Notify the team about the duplication
4. Implement consolidation within 2 sprints

## Emergency Exceptions

### When Rules May Be Temporarily Bypassed
- **Critical production bug** requiring immediate hotfix
- **Client demo deadline** with insufficient time for proper consolidation  
- **Third-party integration** requiring specific screen structure

### Exception Process
1. **Document the exception** in code comments with date and reason
2. **Create technical debt ticket** for proper consolidation
3. **Set maximum 4-week deadline** for cleanup
4. **Add `// TODO: CONSOLIDATE - [Ticket-ID]` comment** in the duplicate file

## Success Metrics

### Project Health Indicators
- **Zero screens** with `Simple`, `New`, `Test`, `Backup` suffixes
- **Maximum 1 screen** per functional area (exceptions documented)
- **100% navigation coverage** (all imported screens are used)
- **Zero dead imports** in navigation files

### Quarterly Review
- Audit all screens for consolidation opportunities
- Update this rules document based on lessons learned
- Review and update naming conventions
- Clean up any technical debt from emergency exceptions

## Current Screen Inventory (Updated: 2025-08-28)

### ✅ Consolidated Screens (Follow These Patterns)
- `FavoritesScreen.tsx` - Single consolidated favorites screen
- `ActivityDetailScreenEnhanced.tsx` - Single activity detail screen
- `SplashScreen.tsx` - Single splash screen

### 🎯 Well-Organized Screen Groups
- `auth/` - 3 screens: Login, Register, ForgotPassword
- `children/` - 4 screens: List, Add/Edit, Profile, History  
- `preferences/` - 6 screens: Category, Age, Location, Budget, Schedule, View
- `activities/` - 1 screen: ActivityDetailScreenEnhanced

### 📊 Single-Purpose Screens (Good Examples)
- `DashboardScreen.tsx` - App home screen
- `SearchScreen.tsx` - Activity search
- `ProfileScreen.tsx` - User profile
- `SettingsScreen.tsx` - App settings

## Tools and Scripts

### Quick Commands for Developers

```bash
# Check for duplicate screen patterns before creating new screens
alias check-screens="find src/screens -name '*.tsx' | grep -E '(Simple|New|Enhanced|Test)' && echo 'WARNING: Found potential duplicates!'"

# Count screens by category  
alias screen-count="find src/screens -name '*.tsx' -not -path '*/.*' | wc -l && echo 'Total screens'"

# Find unused screens
alias find-unused="comm -23 <(find src/screens -name '*.tsx' -exec basename {} \; | sort) <(grep -h 'import.*Screen' src/navigation/*.tsx | sed 's/.*\///g' | sed 's/['\''\";//]//g' | sort)"
```

---

**Remember**: Every screen you don't create is technical debt you don't have to pay back. Always prefer extending and composing over duplicating and creating.