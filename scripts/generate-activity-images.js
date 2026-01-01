#!/usr/bin/env node

/**
 * OpenAI DALL-E 3 Image Generator for KidsActivityTracker
 *
 * Usage: OPENAI_API_KEY=your_key node scripts/generate-activity-images.js
 *        OPENAI_API_KEY=your_key node scripts/generate-activity-images.js --force  (regenerate all)
 *
 * This script generates high-quality, photorealistic images for each activity type
 * using OpenAI's DALL-E 3 model with HD quality and natural style.
 * Images are saved to src/assets/images/activities/{category}/ directories.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is required');
  console.error('Usage: OPENAI_API_KEY=your_key node scripts/generate-activity-images.js');
  process.exit(1);
}

const FORCE_REGENERATE = process.argv.includes('--force');
const BASE_PATH = path.join(__dirname, '..', 'src', 'assets', 'images', 'activities');

// Base prompt additions for photorealistic quality
// Context: This is for a family-friendly iOS/Android app that helps parents find activities for their children
const QUALITY_SUFFIX = `

CONTEXT: This image is for a wholesome, family-friendly mobile app (iOS/Android) that helps parents discover recreational activities and sports programs for their children. The app is used by families to find swimming lessons, sports camps, art classes, and other enriching activities.

STYLE REQUIREMENTS:
- Professional stock photography style, suitable for a family app
- Warm, inviting, and positive atmosphere
- Natural DSLR photograph with soft, natural lighting
- All people have anatomically correct hands with exactly 5 fingers each
- Natural body proportions and realistic physics
- Sharp focus with proper depth of field
- Genuine happy expressions showing children enjoying activities
- High-quality editorial/commercial photography aesthetic
- Bright, colorful, and appealing for a mobile app interface
- Safe, supervised, age-appropriate activities only`;

// Activity types with enhanced photorealistic prompts
const activityPrompts = [
  // Swimming & Aquatics
  {
    category: 'swimming_aquatics',
    images: [
      { name: 'swimming', prompt: `A professional photograph of two happy children (ages 8-10) swimming in a crystal-clear indoor pool. One child is doing freestyle stroke while the other floats on their back smiling. Bright natural light streams through large windows, creating beautiful reflections on the turquoise water. Both children have proper swim goggles pushed up on their foreheads. Shot with a Canon EOS R5, shallow depth of field focusing on the children's joyful faces.${QUALITY_SUFFIX}` },
      { name: 'diving', prompt: `Action photograph of a 10-year-old child mid-dive into an Olympic-style pool, body in perfect streamlined position with arms extended overhead, toes pointed. Captured at 1/2000 shutter speed freezing the moment just before entering the water. Splashes visible from a previous dive. Indoor aquatic center with professional lighting. Shot from poolside angle showing proper diving form.${QUALITY_SUFFIX}` },
      { name: 'water_safety', prompt: `Warm photograph of a diverse group of 5 children (ages 6-8) sitting on the pool edge wearing bright orange life jackets, attentively listening to a friendly female instructor demonstrating floating technique. Indoor pool with large windows, morning light. Children's legs dangling in the water. Educational poster about water safety visible on wall.${QUALITY_SUFFIX}` },
      { name: 'water_polo', prompt: `Dynamic action shot of children (ages 10-12) playing water polo in a pool. One child with arm raised throwing a yellow water polo ball while teammates swim nearby. Water splashing naturally around them. Blue and red swim caps distinguishing teams. Indoor pool with lane dividers visible. Captured mid-action with genuine competitive excitement on their faces.${QUALITY_SUFFIX}` },
      { name: 'synchronized_swimming', prompt: `Artistic photograph of three young girls (ages 9-11) performing synchronized swimming, their legs raised identically above the water surface in a vertical position. Colorful matching swimsuits with sparkles. Underwater lighting creating a magical glow. Indoor pool with judges' table visible in background. Shot from water level to capture the precision of their synchronized movement.${QUALITY_SUFFIX}` },
    ]
  },
  // Team Sports
  {
    category: 'team_sports',
    images: [
      { name: 'basketball', prompt: `Action photograph of a 10-year-old girl mid-jump shot on an indoor basketball court, ball leaving her fingertips toward the hoop. Teammates in matching purple jerseys watching intently. Gymnasium with wooden floors, proper court markings visible. Natural gym lighting from skylights above. Sweat visible, genuine athletic effort and determination on her face.${QUALITY_SUFFIX}` },
      { name: 'soccer', prompt: `Professional sports photograph of children (ages 8-10) playing soccer on a pristine green grass field. A boy in a blue jersey dribbling the ball past a defender, teammates running to support. Golden hour sunlight creating long shadows. Proper soccer cleats, shin guards visible. Background shows soccer goals and parent spectators.${QUALITY_SUFFIX}` },
      { name: 'volleyball', prompt: `Dynamic action shot of a youth volleyball match in a gymnasium. A 12-year-old girl jumping to spike the ball over the net, arm fully extended. Teammates in ready positions. White volleyball caught mid-air. Wooden gym floor, volleyball net properly tensioned. Genuine athletic intensity and focus on players' faces.${QUALITY_SUFFIX}` },
      { name: 'hockey', prompt: `Exciting photograph of children (ages 9-11) playing ice hockey at an indoor rink. A player in a red helmet skating with the puck on their stick, defender approaching. Ice spray from skates, motion blur on skates showing speed. Plexiglass boards visible, proper hockey gear including gloves and pads. Cold breath visible in arena air.${QUALITY_SUFFIX}` },
      { name: 'baseball', prompt: `Classic sports photograph of a 9-year-old at bat in a Little League baseball game, mid-swing connecting with the ball. Catcher and umpire visible behind. Red clay infield, green grass outfield, chain-link backstop. Late afternoon sun casting warm light. Proper batting helmet, baseball uniform with stirrup socks. Crowd of parents on bleachers.${QUALITY_SUFFIX}` },
      { name: 'lacrosse', prompt: `Action photograph of children (ages 10-12) playing lacrosse on a grass field. A boy cradling the ball in his lacrosse stick while running, defender with stick raised. Protective helmets with face cages, gloves, arm pads. Lined field with goals visible. Sunny day with blue sky. Dynamic movement and athletic competition captured.${QUALITY_SUFFIX}` },
      { name: 'rugby', prompt: `Dynamic sports photograph of children (ages 10-12) playing touch rugby on a grass field. A girl running with the ball tucked under her arm, teammates alongside. Proper rugby ball, mouth guards visible. Green field with white lines, goal posts in background. Overcast sky providing even lighting. Mud on jerseys showing active play.${QUALITY_SUFFIX}` },
      { name: 'football', prompt: `Fun action photograph of children (ages 8-10) playing flag football on a grass field. A boy sprinting with the ball, colorful flags at his waist, defenders reaching to pull flags. Yellow and blue team colors. Recreational park setting with trees in background. Autumn afternoon light. Genuine laughter and excitement on faces.${QUALITY_SUFFIX}` },
    ]
  },
  // Individual Sports
  {
    category: 'individual_sports',
    images: [
      { name: 'running', prompt: `Inspiring photograph of three children (ages 9-11) crossing the finish line of a track race, arms raised in celebration. Red running track with white lane lines. The winner's expression showing pure joy and accomplishment. Proper running shoes, athletic wear. Timing clock visible showing race time. Stadium seating with cheering spectators.${QUALITY_SUFFIX}` },
      { name: 'climbing', prompt: `Dramatic photograph of a 10-year-old girl on a colorful indoor climbing wall, reaching confidently for the next hold. Proper climbing harness, chalk on hands, belay rope visible. Multi-colored climbing holds creating a path upward. Instructor below managing the belay. Determination and focus on her face as she looks up at her next move.${QUALITY_SUFFIX}` },
      { name: 'cycling', prompt: `Joyful photograph of three children (ages 8-11) riding bicycles on a paved bike path through a park. Properly fitted helmets, bikes appropriate for their sizes. Dappled sunlight through trees. The lead child looking back with a big smile at friends. Autumn leaves on the path. Natural riding positions, hands properly on handlebars.${QUALITY_SUFFIX}` },
      { name: 'golf', prompt: `Serene photograph of a 10-year-old boy on a golf putting green, focused on lining up a putt. Junior-sized putter, proper golf attire with polo shirt. Manicured green grass, flagstick in hole. Caddie bag visible nearby. Soft morning light creating long shadows. Genuine concentration on his face.${QUALITY_SUFFIX}` },
      { name: 'archery', prompt: `Focused photograph of a 12-year-old girl at an outdoor archery range, drawing back a recurve bow, arrow nocked and aimed at a target. Proper arm guard, finger tab, and chest guard visible. Target with concentric circles 10 meters away. Safety netting behind target. Intense concentration, perfect form and posture.${QUALITY_SUFFIX}` },
      { name: 'fencing', prompt: `Dynamic photograph of two children (ages 11-12) fencing in a bout, one lunging forward with foil extended. Full fencing gear - white jackets, masks, gloves. Indoor fencing studio with strip markings. Electronic scoring box visible. Athletic lunging pose capturing the elegant intensity of the sport.${QUALITY_SUFFIX}` },
    ]
  },
  // Racquet Sports
  {
    category: 'racquet_sports',
    images: [
      { name: 'tennis', prompt: `Professional sports photograph of a 10-year-old girl serving on an outdoor tennis court. Ball tossed in the air, racquet drawn back, on her toes ready to swing. Proper tennis dress, wristbands, tennis shoes. Hard court surface with baseline visible. Blue sky with fluffy clouds. Athletic form capturing the dynamic moment before impact.${QUALITY_SUFFIX}` },
      { name: 'badminton', prompt: `Action photograph of two children (ages 9-11) playing badminton doubles in a gymnasium. One player jumping to smash the shuttlecock, partner in ready position. Proper badminton racquets, white shuttlecock visible mid-air. Indoor court with net properly set up. Wooden gym floor reflecting overhead lights.${QUALITY_SUFFIX}` },
      { name: 'table_tennis', prompt: `Fast-action photograph of a 12-year-old boy playing table tennis, paddle making contact with the ball, intense focus on his face. Proper table tennis paddle grip, white ball caught at moment of impact. Green table, white lines, official net. Indoor recreation room setting. Opponent blurred in background preparing to return.${QUALITY_SUFFIX}` },
      { name: 'squash', prompt: `Dynamic photograph of a 11-year-old playing squash on an indoor court, racquet swinging at the ball near the front wall. Proper squash racquet, protective eyewear. White walls of squash court, red lines visible. Athletic movement frozen mid-swing. Sweat visible, genuine athletic effort.${QUALITY_SUFFIX}` },
      { name: 'pickleball', prompt: `Fun photograph of four children (ages 9-12) playing doubles pickleball on an outdoor court. One player at the net hitting a dink shot, oversized paddle making contact with the wiffle ball. Proper court markings, net at correct height. Sunny day at community recreation area. Laughing and enjoying the game together.${QUALITY_SUFFIX}` },
    ]
  },
  // Martial Arts
  {
    category: 'martial_arts',
    images: [
      { name: 'martial_arts', prompt: `Respectful photograph of a diverse group of 8 children (ages 7-12) in a traditional martial arts dojo, bowing in unison wearing crisp white gis with various colored belts. Wooden dojo floor, Japanese calligraphy on wall. Sensei visible at front. Perfect alignment and discipline, yet warm welcoming atmosphere.${QUALITY_SUFFIX}` },
      { name: 'karate', prompt: `Powerful photograph of a 10-year-old girl executing a perfect front kick in a karate dojo. White gi with green belt tied properly, barefoot on wooden floor. Focused kiai expression on her face. Traditional dojo setting with mirrors, makiwara in background. Clean technique showing proper form and balance.${QUALITY_SUFFIX}` },
      { name: 'taekwondo', prompt: `Dynamic action photograph of a 12-year-old boy performing a high spinning kick in a taekwondo studio. Traditional white dobok with black trim, red belt. Kicking pad held by instructor. Korean flags and certificates on wall. Impressive height and flexibility shown in the kick. Perfect athletic form.${QUALITY_SUFFIX}` },
      { name: 'judo', prompt: `Action photograph of two children (ages 10-11) practicing judo throws on thick blue mats. One child executing a hip throw, the other mid-fall with proper breakfall technique. White judogis with colored belts. Indoor judo dojo with wall padding. Athletic technique and trust visible in their practice.${QUALITY_SUFFIX}` },
      { name: 'boxing', prompt: `Focused photograph of a 12-year-old girl in a boxing gym, practicing combinations on a heavy bag. Proper boxing gloves, hand wraps visible, headgear. Athletic stance, sweat on brow showing effort. Boxing gym setting with other bags visible, motivational posters on walls. Determined expression showing focus and discipline.${QUALITY_SUFFIX}` },
    ]
  },
  // Dance
  {
    category: 'dance',
    images: [
      { name: 'dance', prompt: `Joyful photograph of a diverse group of children (ages 8-11) dancing freely in a bright dance studio. Various colorful dance outfits, mirror wall reflecting their movements. Natural light from large windows. Genuine expressions of happiness and movement. Teacher clapping rhythm in corner. Hardwood dance floor.${QUALITY_SUFFIX}` },
      { name: 'ballet', prompt: `Elegant photograph of young ballet dancers (ages 9-11) at the barre in a professional ballet studio. Pink leotards, pink tights, hair in neat buns. Practicing tendu in perfect unison. Large mirrors, wooden barre, sprung floor. Soft natural light creating a serene atmosphere. Grace and discipline visible in their posture.${QUALITY_SUFFIX}` },
      { name: 'hip_hop_dance', prompt: `Energetic photograph of children (ages 10-12) in a hip hop dance class, mid-routine striking a dynamic pose. Trendy street dance clothing - baggy pants, sneakers, baseball caps. Urban dance studio with graffiti art on walls. Boom box visible. Confident expressions, athletic power moves captured mid-motion.${QUALITY_SUFFIX}` },
      { name: 'jazz_dance', prompt: `Dynamic photograph of young jazz dancers (ages 10-12) performing a choreographed routine. Colorful jazz costumes with sequins, jazz shoes. Arms extended in unison, legs in parallel. Dance studio with mirrored walls. Theatrical expressions, energy and precision in their synchronized movements.${QUALITY_SUFFIX}` },
      { name: 'tap_dance', prompt: `Rhythmic photograph of children (ages 9-11) in a tap dance class, feet captured mid-shuffle on a wooden floor. Black tap shoes catching light, sound almost visible. Classic tap attire. Dance studio setting with barre and mirrors. Joyful expressions as they create rhythm together.${QUALITY_SUFFIX}` },
      { name: 'contemporary', prompt: `Artistic photograph of young contemporary dancers (ages 11-13) performing an expressive piece in a bright studio. Flowing movement, bare feet, simple dance attire in earth tones. One dancer mid-leap, others in connected floor work. Large windows providing natural light. Emotional and graceful expression.${QUALITY_SUFFIX}` },
      { name: 'breakdancing', prompt: `Dynamic photograph of a 12-year-old boy doing a freeze pose in breakdancing class. Athletic wear, sneakers. Urban studio setting with concrete floors, speakers, graffiti art. Other kids watching in a circle. Impressive athletic pose defying gravity. Cool, confident expression.${QUALITY_SUFFIX}` },
    ]
  },
  // Visual Arts
  {
    category: 'visual_arts',
    images: [
      { name: 'arts_crafts', prompt: `Warm photograph of children (ages 7-10) at a craft table working on colorful projects. Construction paper, safety scissors, glue sticks, markers spread across table. Natural classroom light from windows. One child holding up a finished paper craft proudly. Paint smocks protecting clothes. Creative mess and genuine engagement.${QUALITY_SUFFIX}` },
      { name: 'painting', prompt: `Artistic photograph of an 8-year-old girl painting on a canvas at an easel. Palette with various colors, paintbrush in hand making a brushstroke. Paint smudges on her smock and cheek. Bright art studio with other easels visible. Natural north light. Concentrated expression, creative flow evident.${QUALITY_SUFFIX}` },
      { name: 'pottery', prompt: `Tactile photograph of a 10-year-old at a pottery wheel, hands shaping wet clay into a bowl. Clay-covered fingers working the spinning form. Pottery studio with shelves of finished pieces. Apron protecting clothes. Water bucket nearby. Focused concentration, satisfying craftsmanship visible in the emerging form.${QUALITY_SUFFIX}` },
      { name: 'drawing', prompt: `Intimate photograph of a 9-year-old boy drawing with colored pencils at a wooden table. Sketchpad with visible drawing, pencil case with organized colors. Natural window light illuminating his work. Art classroom with student work displayed on walls. Peaceful concentration, pencil making marks on paper.${QUALITY_SUFFIX}` },
      { name: 'sculpture', prompt: `Creative photograph of children (ages 9-12) sculpting with clay at a workshop table. Wire armatures, sculpting tools, clay in various stages of projects. Art studio with examples on shelves. Natural light from skylights. Hands working clay, creative problem-solving visible in their focused faces.${QUALITY_SUFFIX}` },
      { name: 'crafts', prompt: `Colorful photograph of children (ages 7-9) making friendship bracelets with beads and string. Sorted beads in compartmentalized boxes, various colored strings. Bright craft room setting. Finished bracelets on wrists. Concentration and creativity, friends helping each other with knots and patterns.${QUALITY_SUFFIX}` },
    ]
  },
  // Music
  {
    category: 'music',
    images: [
      { name: 'music', prompt: `Harmonious photograph of a children's music class with diverse kids (ages 8-11) playing various instruments. Recorders, xylophones, tambourines, rhythm sticks. Music classroom with staff posters on walls. Teacher conducting. Natural light from windows. Joyful music-making, some counting beats, genuine engagement.${QUALITY_SUFFIX}` },
      { name: 'piano', prompt: `Classic photograph of a 9-year-old girl at an upright piano, fingers on the keys mid-piece. Sheet music on the stand, piano lamp providing warm light. Living room or studio setting. Proper hand position and posture. Concentration and musicality visible in her expression, slight smile as she plays a passage she loves.${QUALITY_SUFFIX}` },
      { name: 'guitar', prompt: `Warm photograph of a 10-year-old boy playing acoustic guitar, fingers forming a chord, other hand strumming. Proper guitar size for a child. Music room with acoustic panels, guitar stand nearby. Sheet music or chord chart visible. Focused on finger placement, genuine learning moment.${QUALITY_SUFFIX}` },
      { name: 'drums', prompt: `Dynamic photograph of a 12-year-old playing a drum kit, sticks caught mid-strike on snare. Full drum set appropriate for youth player. Practice room with sound dampening. Headphones around neck for practicing along with music. Energy and rhythm visible, genuine enthusiasm for drumming.${QUALITY_SUFFIX}` },
      { name: 'violin', prompt: `Elegant photograph of an 11-year-old playing violin, bow drawn across strings, proper chin rest and shoulder rest position. Music stand with sheet music. Practice room or recital hall setting. Proper posture and bow hold. Concentration and musicality, the emotion of the music visible in expression.${QUALITY_SUFFIX}` },
      { name: 'choir', prompt: `Uplifting photograph of a children's choir (ages 8-12) performing, mouths open in song, standing on risers. Matching choir robes or uniform shirts. Music folders held properly. Choir room or concert hall setting. Conductor's hands visible directing. Joyful singing, harmony visible in unified expression.${QUALITY_SUFFIX}` },
      { name: 'band', prompt: `Exciting photograph of a youth band (ages 10-13) practicing together. Drums, bass guitar, electric guitar, keyboard visible. Garage or practice space setting with acoustic panels. Music stands with charts. Coordinated playing, genuine band energy and collaboration.${QUALITY_SUFFIX}` },
    ]
  },
  // Performing Arts
  {
    category: 'performing_arts',
    images: [
      { name: 'theater', prompt: `Theatrical photograph of children (ages 9-12) performing on stage in colorful costumes. Stage lights creating dramatic lighting. Set pieces visible. One child center stage with arms outstretched, others in character positions. Audience visible in shadow. Genuine theatrical emotion and projection.${QUALITY_SUFFIX}` },
      { name: 'drama', prompt: `Expressive photograph of children (ages 10-12) in drama class doing an improvisation exercise. Black box theater space. One child frozen in dramatic pose, others reacting. Drama teacher observing. Stage lighting creating atmosphere. Genuine expression and creative risk-taking visible.${QUALITY_SUFFIX}` },
      { name: 'musical_theatre', prompt: `Dazzling photograph of children (ages 9-12) performing a musical theater number. Colorful Broadway-style costumes, jazz hands pose. Stage with theatrical lighting, simple set pieces. Microphone headsets visible. Big smiles, theatrical energy, coordinated choreography mid-number.${QUALITY_SUFFIX}` },
      { name: 'improv', prompt: `Spontaneous photograph of children (ages 10-13) doing improv comedy games. Simple black shirts, theater space. One child making a funny face/gesture, others laughing. Supportive coach on the side. Genuine laughter and creative spontaneity. Low stage with informal seating.${QUALITY_SUFFIX}` },
      { name: 'circus', prompt: `Exciting photograph of children (ages 9-12) at a youth circus class. One child juggling colorful balls, another on a low balance beam, instructor spotting. Circus arts studio with mats, aerial silks visible in background. Safety equipment. Joy and wonder of learning circus skills.${QUALITY_SUFFIX}` },
    ]
  },
  // Skating & Wheels
  {
    category: 'skating_wheels',
    images: [
      { name: 'ice_skating', prompt: `Graceful photograph of children (ages 8-11) ice skating at an indoor rink. One child gliding on one foot, arms out for balance. Colorful winter clothing, proper figure skates. Ice rink with boards visible, arena lighting. Cold breath visible. Joy of gliding on ice, confident movement.${QUALITY_SUFFIX}` },
      { name: 'figure_skating', prompt: `Elegant photograph of a 10-year-old girl performing a figure skating spin on ice. Sparkly skating dress, white figure skates. Indoor rink with proper lighting. Hair and skirt creating motion blur while face stays sharp. Grace and athleticism of the spin captured beautifully.${QUALITY_SUFFIX}` },
      { name: 'roller_skating', prompt: `Fun photograph of children (ages 9-11) roller skating at an indoor rink. Colorful quad skates, knee pads, wrist guards. Disco lights and neon colors. One child skating backwards, others following in a chain. Classic roller rink atmosphere with wooden floor. Genuine fun and laughter.${QUALITY_SUFFIX}` },
      { name: 'inline_skating', prompt: `Active photograph of children (ages 10-12) inline skating on a paved trail. Proper inline skates, helmets, knee and elbow pads. Park setting with trees. One child in athletic skating stance, others following. Sunny day, motion showing speed. Safety gear and confident skating.${QUALITY_SUFFIX}` },
      { name: 'skateboarding', prompt: `Cool photograph of a 12-year-old doing an ollie at a skate park. Proper skateboard, helmet, knee pads. Concrete skate park with ramps and rails. Board leaving the ground, bent knees showing proper technique. Confident expression, skate culture aesthetic.${QUALITY_SUFFIX}` },
      { name: 'scooter', prompt: `Energetic photograph of children (ages 8-10) riding kick scooters at a skate park. Proper helmets, knee pads. One child mid-jump off a small ramp. Concrete park with various features. Sunny day. Joy and freedom of scooting, friends cheering each other on.${QUALITY_SUFFIX}` },
      { name: 'bmx', prompt: `Action photograph of a 12-year-old on a BMX bike at a pump track, airborne over a roller. Full BMX gear - helmet, gloves, pads. Dirt track with berms and jumps. Athletic posture on bike. Excitement and skill of BMX riding captured mid-air.${QUALITY_SUFFIX}` },
    ]
  },
  // Gymnastics & Movement
  {
    category: 'gymnastics_movement',
    images: [
      { name: 'gymnastics', prompt: `Athletic photograph of a 10-year-old girl on the balance beam, executing a graceful pose with one leg extended behind. Proper gymnastics leotard, hair in ponytail. Professional gym with equipment visible. Chalk on hands. Focus and balance, years of training evident in her confident posture.${QUALITY_SUFFIX}` },
      { name: 'tumbling', prompt: `Dynamic photograph of a child (age 9) mid-cartwheel on a gymnastics floor, body in perfect line. Tumbling mats, spotting blocks nearby. Gymnastics facility with foam pit visible. Colorful leotard. Athletic precision of the cartwheel, coach watching in background.${QUALITY_SUFFIX}` },
      { name: 'trampoline', prompt: `Joyful photograph of children (ages 8-11) at an indoor trampoline park, one child mid-bounce reaching toward the ceiling. Trampoline park with connected trampolines, foam pit. Grip socks, casual athletic wear. Pure joy of bouncing high, big smiles, arms outstretched.${QUALITY_SUFFIX}` },
      { name: 'parkour', prompt: `Dynamic photograph of children (ages 11-13) at an indoor parkour gym, one child mid-vault over a foam obstacle. Padded equipment, crash mats. Athletic clothing, proper shoes. Coach demonstrating technique. Urban movement skills, confidence and controlled athleticism.${QUALITY_SUFFIX}` },
      { name: 'cheerleading', prompt: `Spirited photograph of a youth cheer team (ages 9-12) mid-routine, performing a pyramid formation. Matching cheer uniforms with team colors, pom poms. Gymnasium setting, practice mats. Biggest smiles, team coordination, athletic spirit and energy.${QUALITY_SUFFIX}` },
    ]
  },
  // Camps
  {
    category: 'camps',
    images: [
      { name: 'summer_camp', prompt: `Nostalgic photograph of children (ages 8-12) at summer camp gathered around a counselor by rustic cabins. Camp t-shirts, shorts, sneakers. Pine trees in background, sunny day. Friendship bracelets, camp lanyards. Genuine camaraderie, the magic of summer camp friendships.${QUALITY_SUFFIX}` },
      { name: 'day_camp', prompt: `Active photograph of children (ages 7-10) at day camp playing group games on a grass field. Matching camp shirts, sneakers. Recreation facility with playground visible. Counselors organizing activities. Sunny summer day, kids running and laughing together.${QUALITY_SUFFIX}` },
      { name: 'adventure_camp', prompt: `Exciting photograph of children (ages 10-13) at adventure camp on a ropes course. Proper harnesses, helmets. High ropes element through trees. One child crossing a log bridge, counselor belaying. Forest setting, dappled sunlight. Challenge and achievement, supportive environment.${QUALITY_SUFFIX}` },
    ]
  },
  // STEM & Education
  {
    category: 'stem_education',
    images: [
      { name: 'stem', prompt: `Engaging photograph of children (ages 9-12) in a STEM classroom building with robotics kits. LEGO Mindstorms or VEX parts on tables. Lab coats optional. Bright modern classroom with technology. One child programming on laptop, another assembling. Curiosity and problem-solving visible.${QUALITY_SUFFIX}` },
      { name: 'science', prompt: `Exciting photograph of children (ages 10-12) doing a chemistry experiment in a science lab. Safety goggles, lab coats. Beakers with colorful liquids, baking soda volcano fizzing. Proper lab setup with safety equipment. Amazement at the reaction, hands-on learning joy.${QUALITY_SUFFIX}` },
      { name: 'coding', prompt: `Modern photograph of children (ages 9-11) at computers learning to code. Colorful code on screens (Scratch or similar). Tech classroom or computer lab. Headphones, mice, proper posture. One child pointing at screen explaining to another. Problem-solving collaboration.${QUALITY_SUFFIX}` },
      { name: 'robotics', prompt: `Innovative photograph of children (ages 10-13) at a robotics competition, their robot on a competition mat performing tasks. Team t-shirts, engineering notebooks. Competition venue with other teams visible. Pride and excitement watching their creation work.${QUALITY_SUFFIX}` },
      { name: 'reading', prompt: `Cozy photograph of children (ages 7-10) in a library reading corner, each absorbed in a book. Colorful book covers, bean bag chairs, bookshelves. Natural light from windows. Quiet concentration, transported to other worlds through books.${QUALITY_SUFFIX}` },
    ]
  },
  // Fitness & Wellness
  {
    category: 'fitness_wellness',
    images: [
      { name: 'fitness', prompt: `Energetic photograph of children (ages 9-12) in a kids fitness class doing jumping jacks. Athletic wear, sneakers. Fitness studio with mirrors, colorful mats. Instructor leading at front. Big movements, healthy energy, fun group exercise atmosphere.${QUALITY_SUFFIX}` },
      { name: 'yoga', prompt: `Peaceful photograph of children (ages 8-11) doing yoga poses on colorful mats. Tree pose, arms reaching up. Bright yoga studio with plants, natural light. Instructor demonstrating. Calm focus, balance, mindfulness practice in a welcoming space.${QUALITY_SUFFIX}` },
      { name: 'pilates', prompt: `Controlled photograph of children (ages 10-12) on pilates reformers, doing leg exercises. Kids pilates studio with proper equipment. Instructor guiding form. Athletic wear. Core strength and body awareness, proper technique visible.${QUALITY_SUFFIX}` },
      { name: 'zumba', prompt: `Vibrant photograph of children (ages 8-11) in a kids Zumba class, dancing with big arm movements. Colorful athletic wear, sneakers. Dance fitness studio with speakers, neon lights. Instructor at front with microphone. Pure joy of dancing, cardio fun.${QUALITY_SUFFIX}` },
      { name: 'meditation', prompt: `Serene photograph of children (ages 9-12) sitting cross-legged on cushions, eyes closed in meditation. Calm studio space with soft lighting, plants. Singing bowl nearby. Peaceful expressions, learning mindfulness and calm. Gentle instructor in background.${QUALITY_SUFFIX}` },
      { name: 'gym', prompt: `Active photograph of children (ages 10-12) in a school gym class, doing circuit training. Various stations - jump rope, cones, agility ladder. Gym teacher with whistle. Athletic wear, sneakers. Energy and movement, proper exercise form.${QUALITY_SUFFIX}` },
    ]
  },
  // Outdoor & Adventure
  {
    category: 'outdoor_adventure',
    images: [
      { name: 'outdoor', prompt: `Beautiful photograph of children (ages 8-11) exploring a meadow, examining wildflowers and insects. Casual outdoor clothing, sneakers. Golden hour sunlight, tall grass. One child with magnifying glass. Wonder and discovery, connection with nature.${QUALITY_SUFFIX}` },
      { name: 'hiking', prompt: `Adventurous photograph of children (ages 9-12) hiking on a forest trail, small backpacks, hiking boots. Trail winding through trees, dappled sunlight. One child pointing at something interesting ahead. Hiking sticks, water bottles. Outdoor exploration and adventure.${QUALITY_SUFFIX}` },
      { name: 'camping', prompt: `Magical photograph of children (ages 9-12) at a campsite, roasting marshmallows over a campfire. Tent in background, evening light. Camp chairs, flashlights. Perfect golden marshmallows on sticks. Campfire glow on faces, outdoor adventure bonding.${QUALITY_SUFFIX}` },
      { name: 'nature', prompt: `Wonder-filled photograph of children (ages 7-10) on a nature walk, one holding a caterpillar on a leaf to show friends. Forest path, naturalist guide with them. Field guides, collection boxes. Curiosity and respect for nature, educational discovery.${QUALITY_SUFFIX}` },
      { name: 'kayaking', prompt: `Adventurous photograph of children (ages 10-13) kayaking on a calm lake. Proper life jackets, paddles, sit-on-top kayaks suitable for youth. Mountain or forest backdrop. Instructor in nearby kayak. Water adventure, proper paddling technique, safe fun.${QUALITY_SUFFIX}` },
      { name: 'fishing', prompt: `Patient photograph of children (ages 8-11) fishing from a wooden dock on a peaceful lake. Fishing rods properly held, tackle box nearby. Life jackets. Early morning light, mist on water. Anticipation of a bite, peaceful outdoor activity.${QUALITY_SUFFIX}` },
      { name: 'skiing', prompt: `Thrilling photograph of children (ages 9-12) skiing down a gentle slope at a ski resort. Proper ski gear - helmets, goggles, ski suits. Snow-covered mountain backdrop. Snowplow or parallel stance appropriate to skill. Joy of skiing, winter adventure.${QUALITY_SUFFIX}` },
    ]
  },
  // Culinary Arts
  {
    category: 'culinary_arts',
    images: [
      { name: 'cooking', prompt: `Delicious photograph of children (ages 9-12) in a kids cooking class, preparing healthy food. Chef hats, aprons, kid-safe knives. Kitchen classroom with ingredients. One child stirring a pot, another chopping vegetables on cutting board. Learning culinary skills, teamwork in the kitchen.${QUALITY_SUFFIX}` },
      { name: 'baking', prompt: `Sweet photograph of children (ages 8-10) baking cookies, one rolling dough while another uses cookie cutters. Flour on hands and counter, aprons. Home-style kitchen or baking class. Mixing bowls, measuring cups. Joy of baking, anticipation of treats.${QUALITY_SUFFIX}` },
      { name: 'cake_decorating', prompt: `Creative photograph of children (ages 9-12) decorating cakes with colorful frosting. Piping bags, sprinkles, fondant. Baking studio with finished cakes on display. Aprons with frosting smudges. Artistic concentration, edible art creation.${QUALITY_SUFFIX}` },
    ]
  },
  // Language & Culture
  {
    category: 'language_culture',
    images: [
      { name: 'language', prompt: `Engaging photograph of diverse children (ages 8-11) in a language class, practicing conversation in pairs. Flashcards with vocabulary, language posters on walls. Bright classroom setting. Children gesturing as they speak, genuine communication practice.${QUALITY_SUFFIX}` },
      { name: 'french', prompt: `Charming photograph of children (ages 9-11) in French class, gathered around a table with French-themed items - croissants, Eiffel Tower model, French flag. Practicing phrases, textbooks open. Classroom with French travel posters. Cultural immersion learning.${QUALITY_SUFFIX}` },
      { name: 'spanish', prompt: `Lively photograph of children (ages 8-11) in Spanish class doing a vocabulary game. Colorful classroom with Spanish language posters, Mexican papel picado decorations. Children animated in conversation, learning through play. Cultural appreciation visible.${QUALITY_SUFFIX}` },
      { name: 'sign_language', prompt: `Inclusive photograph of children (ages 9-12) learning sign language, practicing finger spelling with each other. ASL alphabet poster on wall. Diverse group including a deaf child teaching hearing peers. Communication and connection across abilities.${QUALITY_SUFFIX}` },
    ]
  },
  // Special Needs Programs
  {
    category: 'special_needs',
    images: [
      { name: 'recreation_center', prompt: `Inclusive photograph of diverse children with varying abilities (ages 8-12) participating in adaptive games at a recreation center. Accessible equipment, supportive staff. Bright community center space. Wheelchair-using child high-fiving standing peers. Joy and inclusion, everyone participating.${QUALITY_SUFFIX}` },
      { name: 'community_center', prompt: `Welcoming photograph of diverse children (ages 7-11) at a community center program, doing an inclusive art project together. Accessible tables, adaptive tools available. Community space with local artwork. Supportive environment, everyone's contribution valued.${QUALITY_SUFFIX}` },
      { name: 'adaptive_sports', prompt: `Empowering photograph of children with various abilities (ages 9-13) playing adaptive basketball. Wheelchairs, standing players together. Modified rules, inclusive equipment. Gymnasium with encouraging coaches. Competition and teamwork, athletic spirit for all abilities.${QUALITY_SUFFIX}` },
    ]
  },
  // Multi-Sport
  {
    category: 'multi_sport',
    images: [
      { name: 'sports_general', prompt: `Dynamic photograph of children (ages 8-12) at a multi-sport camp, various activities happening simultaneously. Soccer balls, basketballs, cones visible. Outdoor sports field, sunny day. Rotation of activities, kids trying different sports. Athletic variety, finding new passions.${QUALITY_SUFFIX}` },
      { name: 'multi_sport', prompt: `Active photograph of children (ages 9-11) in a gymnasium multi-sport class, transitioning between activity stations. Different equipment at each station - hockey sticks, volleyball, frisbees. Energetic atmosphere, learning multiple sports fundamentals.${QUALITY_SUFFIX}` },
    ]
  },
  // Life Skills & Leadership
  {
    category: 'life_skills',
    images: [
      { name: 'leadership', prompt: `Empowering photograph of children (ages 11-13) in a leadership workshop, one standing presenting to the group. Flip chart with brainstorming notes. Conference room or classroom. Others listening attentively, some taking notes. Building confidence and communication skills.${QUALITY_SUFFIX}` },
      { name: 'babysitting', prompt: `Responsible photograph of teenagers (ages 13-15) in a babysitting certification class, practicing infant CPR on training mannequins. First aid supplies, certification materials. Classroom setting with instructor. Learning vital skills, preparing for responsibility.${QUALITY_SUFFIX}` },
      { name: 'first_aid', prompt: `Educational photograph of children (ages 10-12) in a first aid course, one practicing bandaging a classmate's arm with a triangular bandage. First aid kits open, Red Cross materials. Classroom setting. Learning life-saving skills, helping others.${QUALITY_SUFFIX}` },
    ]
  },
  // Early Development
  {
    category: 'early_development',
    images: [
      { name: 'early_years', prompt: `Adorable photograph of toddlers (ages 2-4) in a playgroup, exploring a colorful play area. Soft blocks, sensory toys, play kitchen. Bright early childhood center. Caregivers nearby. Discovery and social development, parallel and interactive play.${QUALITY_SUFFIX}` },
      { name: 'toddler_play', prompt: `Heartwarming photograph of toddlers (ages 2-3) building with large soft blocks, stacking and experimenting. Bright playroom with child-safe furniture. Caregiver sitting nearby engaging. Colorful toys, soft flooring. Learning through play, motor skill development.${QUALITY_SUFFIX}` },
      { name: 'preschool', prompt: `Cheerful photograph of preschoolers (ages 3-5) at circle time, sitting on a colorful rug, hands raised to answer teacher's question. Alphabet and number posters, cubbies with names. Engaged learning, classroom community building.${QUALITY_SUFFIX}` },
      { name: 'kids_activities', prompt: `Lively photograph of young children (ages 4-6) doing various stations in a classroom - art corner, building blocks, dress-up area. Busy, organized activity. Teachers facilitating. Learning centers promoting development through play.${QUALITY_SUFFIX}` },
      { name: 'sensory_play', prompt: `Fascinating photograph of toddlers (ages 2-4) at a sensory table filled with colored rice and scooping toys. Hands in the materials, exploring textures. Early childhood classroom. Sensory bins, water table nearby. Tactile learning and exploration.${QUALITY_SUFFIX}` },
    ]
  },
  // Other
  {
    category: 'other',
    images: [
      { name: 'family_fun', prompt: `Joyful photograph of a diverse family with children (ages 6-10) playing together in a park. Flying a kite, playing catch. Sunny day, green grass, picnic blanket visible. Multi-generational family time. Genuine laughter and connection, weekend family outing.${QUALITY_SUFFIX}` },
      { name: 'kids_night_out', prompt: `Exciting photograph of children (ages 7-11) at a kids night out event at a recreation center. Games, pizza, movies setup. Glow sticks, casual fun clothes. Supervised fun, parents dropping off. Independence and social time with peers.${QUALITY_SUFFIX}` },
      { name: 'youth_activities', prompt: `Engaging photograph of teenagers (ages 13-15) at a youth center, playing foosball and board games. Casual hangout space with couches, game tables. Youth workers present. Social development, positive peer relationships in safe space.${QUALITY_SUFFIX}` },
    ]
  }
];

async function generateImage(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1792x1024',  // Landscape HD for DALL-E 3
      quality: 'hd',
      style: 'natural'  // More photorealistic
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.error) {
            reject(new Error(response.error.message || JSON.stringify(response.error)));
          } else if (response.data && response.data[0]) {
            // GPT-Image can return url or b64_json
            if (response.data[0].url) {
              resolve({ type: 'url', data: response.data[0].url });
            } else if (response.data[0].b64_json) {
              resolve({ type: 'base64', data: response.data[0].b64_json });
            } else {
              reject(new Error('No image data in response: ' + JSON.stringify(response)));
            }
          } else {
            reject(new Error('No image data in response: ' + JSON.stringify(response)));
          }
        } catch (e) {
          reject(new Error('Parse error: ' + e.message + ' Body: ' + body.substring(0, 500)));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function downloadImage(url, filePath) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : require('http');

    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Follow redirect
        downloadImage(res.headers.location, filePath).then(resolve).catch(reject);
      } else if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
      } else {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          fs.writeFileSync(filePath, Buffer.concat(chunks));
          resolve();
        });
        res.on('error', reject);
      }
    }).on('error', reject);
  });
}

async function main() {
  console.log('OpenAI DALL-E 3 Image Generator for KidsActivityTracker');
  console.log('='.repeat(55));
  if (FORCE_REGENERATE) {
    console.log('MODE: Force regenerating all images\n');
  } else {
    console.log('MODE: Skipping existing images (use --force to regenerate)\n');
  }

  let totalImages = 0;
  let generatedImages = 0;
  let skippedImages = 0;
  let failedImages = [];

  // Count total images
  for (const category of activityPrompts) {
    totalImages += category.images.length;
  }
  console.log(`Total images to process: ${totalImages}\n`);

  for (const category of activityPrompts) {
    const categoryPath = path.join(BASE_PATH, category.category);

    // Ensure directory exists
    if (!fs.existsSync(categoryPath)) {
      fs.mkdirSync(categoryPath, { recursive: true });
    }

    console.log(`\n📁 ${category.category}`);

    for (const image of category.images) {
      const imagePath = path.join(categoryPath, `${image.name}.png`);

      // Skip if image already exists (unless force mode)
      if (fs.existsSync(imagePath) && !FORCE_REGENERATE) {
        console.log(`  ⏭️  ${image.name}.png (exists, skipping)`);
        skippedImages++;
        continue;
      }

      try {
        console.log(`  🎨 Generating ${image.name}.png...`);
        const result = await generateImage(image.prompt);

        if (result.type === 'url') {
          console.log(`  📥 Downloading...`);
          await downloadImage(result.data, imagePath);
        } else {
          // Base64
          console.log(`  💾 Saving...`);
          const buffer = Buffer.from(result.data, 'base64');
          fs.writeFileSync(imagePath, buffer);
        }

        console.log(`  ✅ ${image.name}.png saved`);
        generatedImages++;

        // Rate limiting - wait 2 seconds between requests for API limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.log(`  ❌ ${image.name}.png failed: ${error.message}`);
        failedImages.push({ category: category.category, name: image.name, error: error.message });

        // Wait a bit longer on errors (might be rate limiting)
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  console.log('\n' + '='.repeat(55));
  console.log(`Generated: ${generatedImages} new images`);
  console.log(`Skipped: ${skippedImages} existing images`);
  console.log(`Total: ${generatedImages + skippedImages}/${totalImages}`);

  if (failedImages.length > 0) {
    console.log(`\n❌ Failed images (${failedImages.length}):`);
    failedImages.forEach(f => console.log(`  - ${f.category}/${f.name}: ${f.error}`));
    console.log('\nRe-run the script to retry failed images.');
  } else {
    console.log('\n✅ All images generated successfully!');
  }
}

main().catch(console.error);
