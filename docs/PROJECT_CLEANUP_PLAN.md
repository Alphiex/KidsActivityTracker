# Kids Activity Tracker - Project Cleanup Plan

## New Directory Structure

```
KidsActivityTracker/
├── src/                      # React Native source code (ALREADY EXISTS)
├── backend/                  # Backend API code (ALREADY EXISTS)
├── ios/                      # iOS native code (ALREADY EXISTS)
├── android/                  # Android native code (ALREADY EXISTS)
├── assets/                   # Images, fonts, etc (ALREADY EXISTS)
├── docs/                     # All documentation (PARTIALLY EXISTS)
│   ├── api/                  # API documentation
│   ├── guides/               # Setup and deployment guides
│   ├── screenshots/          # All screenshots
│   └── architecture/         # Architecture docs
├── scripts/                  # Build and utility scripts (ALREADY EXISTS)
│   ├── data/                 # Data migration scripts
│   ├── build/                # Build scripts
│   └── utils/                # Utility scripts
├── tests/                    # Test files
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── fixtures/             # Test data
├── temp/                     # Temporary files (git-ignored)
└── archive/                  # Old/archived files (git-ignored)
```

## Files to Delete (Temporary/Unused)

### Screenshots and Debug Images (move to docs/screenshots/)
- *.png files in root
- debug-*.png
- nvrc-*.png
- perfectmind-*.png
- results-*.png
- search-*.png
- iframe-*.png
- widget-*.png
- course-*.png
- category-*.png
- after-*.png
- before-*.png
- ready-*.png
- targeted-*.png
- working-*.png

### Backup/Test App Files (delete)
- App.*.tsx (except App.tsx)
- index.*.js (except index.js)

### Temporary JSON Files (delete)
- nvrc_*.json
- nvrc_*.txt
- nvrc_*.html

### Old Scripts in Root (move to scripts/data/)
- add-missing-location.js
- check-*.js
- fix-*.js
- import-*.js
- improve-*.js
- direct-import.js
- upload-to-production.js
- create_icons.js
- proxy-server.js
- simple-proxy.js
- run-enhanced-scraper-cloud.js

### Documentation Files (move to docs/)
- *.md files in root (except README.md)

## Files to Keep in Root
- .env, .env.production
- .gitignore, .eslintrc.js, .prettierrc.js
- .watchmanconfig
- package.json, package-lock.json
- babel.config.js, metro.config.js
- tsconfig.json, jest.config.js
- app.json
- index.js, App.tsx
- README.md
- Gemfile

## Xcode Project Updates

Need to add folder references (not groups) for:
- docs/
- scripts/
- tests/
- temp/ (if needed for visibility)

This will make all project files visible in Xcode even if they're not compiled.