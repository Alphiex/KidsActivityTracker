# Activity Image Improvement Plan

## Current State

### Existing Images (56 images in `/src/assets/images/activities/`)

| Category | Images Available |
|----------|-----------------|
| Swimming | swimming, water_safety, diving |
| Team Sports | basketball, soccer, hockey, volleyball, baseball, sports_general |
| Racquet Sports | tennis, badminton, racquet_sports |
| Dance | dance, ballet, hip_hop_dance, cheerleading |
| Visual Arts | arts_crafts, pottery, painting, crafts, theater |
| Music | music, piano, guitar, drums |
| Fitness | fitness, yoga, climbing, gym, running, gymnastics |
| Martial Arts | martial_arts, karate |
| Educational | stem, cooking, science, leadership, language, reading |
| Outdoor | summer_camp, outdoor, nature, playground, hiking, skiing |
| Early Years | early_years, toddler_play, preschool, kids_activities |
| Skating | ice_skating, skateboarding |
| General | recreation_center, community_center, family_fun, kids_night_out, youth_activities |

### Database Activity Types (by activity count)

| Activity Type | Count | Image Coverage |
|---------------|-------|----------------|
| Swimming & Aquatics | 46,536 | Good (swimming, diving, water_safety) |
| Other Activity | 15,888 | Generic (recreation_center) |
| Early Development | 15,097 | Good (early_years, toddler_play, preschool) |
| Visual Arts | 9,043 | Partial (missing drawing, sculpture, photography) |
| Skating & Wheels | 7,182 | Partial (missing figure skating, cycling, scooter) |
| Team Sports | 5,475 | Good (most covered) |
| Racquet Sports | 5,169 | Partial (missing pickleball, squash, table tennis) |
| Music | 5,020 | Partial (missing violin, choir, band) |
| Fitness & Wellness | 4,758 | Partial (missing pilates, zumba, meditation) |
| Camps | 4,483 | Limited (only summer_camp) |
| Dance | 3,188 | Partial (missing contemporary, tap, jazz, ballroom) |
| Martial Arts | 1,478 | Partial (missing taekwondo, judo, boxing) |
| Gymnastics & Movement | 1,193 | Partial (missing parkour, trampoline) |
| STEM & Education | 1,036 | Limited (generic stem, missing robotics, coding) |
| Life Skills & Leadership | 681 | Limited (generic leadership) |
| Culinary Arts | 328 | Good (cooking) |
| Outdoor & Adventure | 266 | Partial (missing kayaking, sailing, fishing) |
| Performing Arts | 222 | Limited (only theater) |
| Individual Sports | 164 | Poor (missing archery, golf, fencing) |
| Language & Culture | 128 | Limited (generic language) |
| Multi-Sport | 20 | Generic (sports_general) |
| Special Needs Programs | 0 | None |

---

## Priority 1: High-Volume Activities Missing Images

These subtypes have high activity counts but use generic fallback images:

### Swimming & Aquatics (46,536 activities)
- [ ] **water_polo.jpg** - Kids playing water polo
- [ ] **synchronized_swimming.jpg** - Artistic/synchronized swimming
- [ ] **aqua_fitness.jpg** - Kids water aerobics class
- [ ] **competitive_swimming.jpg** - Racing/competitive lanes

### Skating & Wheels (7,182 activities)
- [ ] **figure_skating.jpg** - Kids figure skating (different from general skating)
- [ ] **speed_skating.jpg** - Speed skating on ice
- [ ] **roller_skating.jpg** - Roller skating (different from skateboarding)
- [ ] **inline_skating.jpg** - Inline/rollerblading
- [ ] **cycling.jpg** - Kids on bicycles
- [ ] **bmx.jpg** - BMX biking
- [ ] **scooter.jpg** - Kids on scooters

### Racquet Sports (5,169 activities)
- [ ] **pickleball.jpg** - Kids playing pickleball (very popular now)
- [ ] **table_tennis.jpg** - Ping pong/table tennis
- [ ] **squash.jpg** - Squash court/players

### Music (5,020 activities)
- [ ] **violin.jpg** - Child playing violin
- [ ] **choir.jpg** - Children's choir/singing group
- [ ] **band.jpg** - Kids band/orchestra
- [ ] **ukulele.jpg** - Child with ukulele

### Fitness & Wellness (4,758 activities)
- [ ] **zumba.jpg** - Kids zumba/dance fitness class
- [ ] **meditation.jpg** - Kids meditation/mindfulness
- [ ] **pilates.jpg** - Kids pilates (different from yoga)
- [ ] **crossfit_kids.jpg** - Kids CrossFit/functional fitness

---

## Priority 2: Camp Variations (4,483 activities)

Currently only `summer_camp.jpg` exists. Need variety:

- [ ] **winter_camp.jpg** - Winter/ski camp activities
- [ ] **sports_camp.jpg** - Sports-focused camp
- [ ] **arts_camp.jpg** - Art-focused camp
- [ ] **stem_camp.jpg** - Tech/science/robotics camp
- [ ] **adventure_camp.jpg** - Outdoor adventure camp
- [ ] **dance_camp.jpg** - Dance-focused camp
- [ ] **day_camp.jpg** - General day camp (different vibe from overnight)
- [ ] **march_break_camp.jpg** - Spring break activities

---

## Priority 3: Dance Styles (3,188 activities)

Need more dance variety:

- [ ] **contemporary_dance.jpg** - Contemporary/modern dance
- [ ] **tap_dance.jpg** - Tap dancing
- [ ] **jazz_dance.jpg** - Jazz dance
- [ ] **ballroom_dance.jpg** - Ballroom/partner dance
- [ ] **irish_dance.jpg** - Irish/Celtic dance
- [ ] **breakdancing.jpg** - Breaking/breakdance
- [ ] **bollywood.jpg** - Bollywood dance
- [ ] **salsa.jpg** - Latin/salsa dance

---

## Priority 4: Martial Arts Styles (1,478 activities)

Need specific martial arts:

- [ ] **taekwondo.jpg** - Taekwondo (different uniform/kicks)
- [ ] **judo.jpg** - Judo (throws/grappling)
- [ ] **boxing.jpg** - Youth boxing
- [ ] **kickboxing.jpg** - Kickboxing class
- [ ] **jiu_jitsu.jpg** - Brazilian Jiu-Jitsu
- [ ] **kung_fu.jpg** - Kung Fu

---

## Priority 5: Gymnastics & Movement (1,193 activities)

- [ ] **parkour.jpg** - Kids parkour/freerunning
- [ ] **trampoline.jpg** - Trampoline jumping
- [ ] **acrobatics.jpg** - Acrobatic moves
- [ ] **ninja_training.jpg** - Ninja warrior/obstacle course

---

## Priority 6: STEM & Education (1,036 activities)

Need specific tech images:

- [ ] **robotics.jpg** - Kids building robots
- [ ] **coding.jpg** - Kids at computers coding
- [ ] **lego.jpg** - LEGO building/engineering
- [ ] **minecraft.jpg** - Minecraft education
- [ ] **3d_printing.jpg** - 3D printing
- [ ] **electronics.jpg** - Kids with circuits/electronics
- [ ] **chemistry.jpg** - Kids doing chemistry experiments

---

## Priority 7: Visual Arts (9,043 activities)

Need more specific art types:

- [ ] **drawing.jpg** - Kids drawing/sketching
- [ ] **sculpture.jpg** - Kids sculpting
- [ ] **photography.jpg** - Kids with cameras
- [ ] **digital_art.jpg** - Digital art/tablets
- [ ] **jewelry_making.jpg** - Jewelry/beading
- [ ] **fashion_design.jpg** - Fashion/sewing
- [ ] **printmaking.jpg** - Printmaking

---

## Priority 8: Outdoor & Adventure (266 activities)

- [ ] **kayaking.jpg** - Kids kayaking
- [ ] **canoeing.jpg** - Kids canoeing
- [ ] **sailing.jpg** - Youth sailing
- [ ] **fishing.jpg** - Kids fishing
- [ ] **camping_tent.jpg** - Camping (different from summer camp)
- [ ] **bird_watching.jpg** - Nature/birding
- [ ] **gardening.jpg** - Kids gardening

---

## Priority 9: Performing Arts (222 activities)

- [ ] **acting.jpg** - Kids acting/drama class
- [ ] **circus_arts.jpg** - Circus skills
- [ ] **magic.jpg** - Magic tricks
- [ ] **film_making.jpg** - Kids with cameras/film
- [ ] **puppetry.jpg** - Puppet shows
- [ ] **musical_theatre.jpg** - Musical theater

---

## Priority 10: Individual Sports (164 activities)

- [ ] **archery.jpg** - Kids archery
- [ ] **golf.jpg** - Youth golf
- [ ] **fencing.jpg** - Kids fencing
- [ ] **bowling.jpg** - Kids bowling
- [ ] **track_field.jpg** - Track and field

---

## Priority 11: Team Sports (additional)

- [ ] **cricket.jpg** - Cricket
- [ ] **lacrosse.jpg** - Lacrosse
- [ ] **rugby.jpg** - Rugby
- [ ] **floor_hockey.jpg** - Indoor floor hockey
- [ ] **ultimate_frisbee.jpg** - Ultimate frisbee
- [ ] **flag_football.jpg** - Flag football

---

## Priority 12: Life Skills & Leadership (681 activities)

- [ ] **first_aid.jpg** - CPR/first aid training
- [ ] **babysitting.jpg** - Babysitting course
- [ ] **public_speaking.jpg** - Public speaking/debate
- [ ] **volunteer.jpg** - Volunteering

---

## Priority 13: Language & Culture (128 activities)

- [ ] **sign_language.jpg** - Sign language class
- [ ] **cultural_activities.jpg** - Cultural celebration/activities

---

## Image Requirements

### Technical Specifications
- **Format**: JPG (optimized for mobile)
- **Dimensions**: 1200x800px minimum (landscape orientation preferred)
- **File Size**: Under 150KB after optimization
- **Quality**: High resolution, well-lit, professional

### Content Guidelines
- **Must show children** (ages 5-14 visually)
- **Diverse representation** - different ethnicities, genders, abilities
- **Active engagement** - kids participating, not just posing
- **Safe activities** - proper equipment, supervision implied
- **Modern/current** - contemporary clothing, equipment
- **No faces clearly identifiable** (for licensing simplicity) OR properly licensed stock

### Licensing Options
1. **Stock Photos** (Recommended):
   - Unsplash (free, commercial use)
   - Pexels (free, commercial use)
   - Shutterstock/Adobe Stock (paid, higher quality)

2. **AI Generated** (Alternative):
   - Can create custom images
   - Ensure age-appropriate content
   - Verify no identifiable faces

---

## Implementation Steps

### Phase 1: Immediate (High Impact)
1. Download Priority 1 images (high-volume missing)
2. Update `activityImageMap` in `/src/assets/images/index.ts`
3. Update `getActivityImageKey()` in `/src/utils/activityHelpers.ts`
4. Test on sample activities

### Phase 2: Camp & Dance
1. Download Priority 2-3 images
2. Update mappings
3. Verify correct matching

### Phase 3: Sports & Arts
1. Download Priority 4-7 images
2. Update mappings
3. Full regression test

### Phase 4: Remaining
1. Download Priority 8-13 images
2. Final updates
3. Comprehensive testing

---

## Total Image Count

| Priority | Images | Status |
|----------|--------|--------|
| Priority 1 | 19 | Pending |
| Priority 2 | 8 | Pending |
| Priority 3 | 8 | Pending |
| Priority 4 | 6 | Pending |
| Priority 5 | 4 | Pending |
| Priority 6 | 7 | Pending |
| Priority 7 | 7 | Pending |
| Priority 8 | 7 | Pending |
| Priority 9 | 6 | Pending |
| Priority 10 | 5 | Pending |
| Priority 11 | 6 | Pending |
| Priority 12 | 4 | Pending |
| Priority 13 | 2 | Pending |
| **TOTAL** | **89** | Pending |

Current: 56 images
After plan: 145 images (159% increase in coverage)

---

## Search Terms for Downloading

Use these search terms on stock photo sites:

```
# Priority 1 examples
"kids water polo pool"
"children figure skating"
"kids playing pickleball"
"children violin lesson"
"kids zumba fitness class"

# Priority 2 examples
"winter ski camp children"
"sports day camp kids"
"art camp painting children"
"robotics camp kids"

# General tips
- Add "children" or "kids" to all searches
- Add "class" or "lesson" for instruction-based activities
- Use "youth" for older age activities
- Include activity-specific equipment terms
```

---

## Success Criteria

1. **Coverage**: Every ActivitySubtype has a relevant image
2. **Quality**: All images are high-quality, kid-friendly
3. **Diversity**: Images represent diverse children
4. **Relevance**: Users can visually identify the activity type
5. **Performance**: All images optimized for mobile (< 150KB each)
