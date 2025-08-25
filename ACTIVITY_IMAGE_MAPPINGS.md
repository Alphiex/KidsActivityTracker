# Activity to Image Mappings

## Image Storage Directory
All activity images are stored in: `/Users/mike/Development/KidsActivityTracker/src/assets/images/activities/`

## Complete Activity-to-Image Mappings

Based on the `getActivityImageKey` function in `src/utils/activityHelpers.ts`:

### Swimming & Aquatics
- **Keywords**: `swim`, `aquatic`
- **Image**: `swimming.jpg`

### Skating
- **Keywords**: `skating`, `skate`
- **Image**: `ice_skating.jpg`

### Martial Arts
- **Keywords**: `martial`, `karate`, `taekwondo`, `judo`
- **Image**: `martial_arts.jpg`

### Dance
- **Keywords**: `dance`, `ballet`
- **Image**: `dance.jpg`

### Team Sports
- **Basketball**: `basketball` → `basketball.jpg`
- **Soccer/Football**: `soccer`, `football` → `soccer.jpg`
- **Hockey**: `hockey` → `hockey.jpg`
- **Volleyball**: `volleyball` → `volleyball.jpg`
- **Baseball**: `baseball` → `baseball.jpg`

### Racquet Sports
- **Tennis**: `tennis` → `tennis.jpg`
- **Badminton**: `badminton` → `badminton.jpg`
- **General Racquet**: `racquet` → `racquet_sports.jpg`

### Music
- **Keywords**: `music`, `piano`, `guitar`, `drum`
- **Image**: `music.jpg`

### Arts & Crafts
- **Pottery/Clay**: `pottery`, `clay` → `pottery.jpg`
- **General Arts**: `art`, `paint`, `draw`, `craft` → `arts_crafts.jpg`

### Fitness & Wellness
- **General Fitness**: `fitness`, `gym`, `strength`, `cardio` → `fitness.jpg`
- **Yoga**: `yoga` → `yoga.jpg`
- **Climbing**: `climb` → `climbing.jpg`

### Cooking
- **Keywords**: `cook`, `culinary`
- **Image**: `cooking.jpg`

### Educational
- **STEM/Science**: `stem`, `science`, `technology`, `engineering` → `stem.jpg`
- **Language**: `language` → `language.jpg`

### Outdoor Activities
- **Camps**: `camp` → `summer_camp.jpg`
- **Outdoor/Nature**: `outdoor`, `nature` → `outdoor.jpg`
- **Hiking**: `hiking` → `hiking.jpg`

### Age-Specific
- **Early Years**: `early years`, `toddler`, `preschool` → `early_years.jpg`
- **Youth/Teen**: `youth`, `teen` → `youth_activities.jpg`

### Special Programs
- **Leadership**: `leadership`, `babysit` → `leadership.jpg`
- **Kids Night Out**: `night out` → `kids_night_out.jpg`

### General/Multi-Sport
- **Multi-sport**: `multisport`, `sport` → `sports_general.jpg`
- **Default/Fallback**: Any unmatched → `recreation_center.jpg`

## Available Image Files in activityImageMap

The following images are available and mapped in `src/assets/images/index.ts`:

1. **Swimming & Aquatics**: swimming.jpg, water_safety.jpg, diving.jpg
2. **Team Sports**: basketball.jpg, soccer.jpg, volleyball.jpg, hockey.jpg, baseball.jpg, sports_general.jpg
3. **Racquet Sports**: tennis.jpg, badminton.jpg, racquet_sports.jpg
4. **Dance**: dance.jpg, ballet.jpg, hip_hop_dance.jpg
5. **Arts & Crafts**: arts_crafts.jpg, pottery.jpg, painting.jpg, crafts.jpg
6. **Music**: music.jpg, piano.jpg, guitar.jpg, drums.jpg
7. **Fitness**: fitness.jpg, yoga.jpg, climbing.jpg, gym.jpg
8. **Martial Arts**: martial_arts.jpg, karate.jpg
9. **Educational**: stem.jpg, cooking.jpg, science.jpg, leadership.jpg, language.jpg
10. **Outdoor**: summer_camp.jpg, outdoor.jpg, nature.jpg, playground.jpg, hiking.jpg
11. **Early Years**: early_years.jpg, toddler_play.jpg, preschool.jpg, kids_activities.jpg
12. **Special Programs**: kids_night_out.jpg, youth_activities.jpg
13. **Skating**: ice_skating.jpg, skateboarding.jpg
14. **General**: recreation_center.jpg, community_center.jpg, family_fun.jpg

## Recently Fixed Issues
- **Ice Skating**: Was showing workout image, now fixed with proper ice skating image (62KB)
- **Volleyball**: Was showing dance image, now fixed with proper volleyball image (95KB)
- **Running**: Added new running image (71KB)

All images are embedded in the project (not external URLs) and are kid-oriented.