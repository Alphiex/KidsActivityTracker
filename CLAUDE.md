# Claude Development Rules for KidsActivityTracker

## iOS Simulator Configuration

### IMPORTANT: Always Use iOS 18.6 Simulator
- **Issue**: iOS 18.4 simulator has known network connectivity issues that cause "Network Error" when making API calls
- **Solution**: Always use iOS 18.6 simulator (iPhone 16 Pro) for development and testing

### Running the App
When asked to run the app on iOS simulator, ALWAYS use one of these methods:

1. **Preferred Method**: Run the custom script
   ```bash
   ./scripts/development/run-ios-18-6.sh
   ```

2. **Alternative Method**: Use the UDID directly
   ```bash
   npx react-native run-ios --udid="A8661E75-FE3E-483F-8F13-AC87110E8EE2"
   ```

3. **Never use**:
   - ❌ `npx react-native run-ios` (without specifying simulator - may default to 18.4)
   - ❌ `npx react-native run-ios --simulator="iPhone 16 Pro"` (may pick wrong iOS version)

### Available iOS 18.6 Simulators
- iPhone 16 Pro: `A8661E75-FE3E-483F-8F13-AC87110E8EE2` (PRIMARY)
- iPhone 16 Pro Max: `9F3BA117-5391-4064-9FAF-8A7CA82CE93C`
- iPhone 16: `6558E69E-75D4-4088-B42B-DBD7F5FDFAFA`
- iPhone 16 Plus: `86E8B2CB-2E1B-4621-9A20-78549BDFB0F9`

## Code Quality Rules

### Before Committing Code
Always run these commands to ensure code quality:
```bash
npm run lint        # Check for linting issues
npm run typecheck   # Check for TypeScript errors
```

### Activity Time Display
- Activities from the API have `startTime` and `endTime` fields at the root level
- Format: "9:30 am - 12:00 pm"
- Always check for these fields when displaying activity information

## API Configuration
- API endpoint: `https://kids-activity-api-205843686007.us-central1.run.app`
- Database: PostgreSQL on Google Cloud SQL

## Development Workflow
1. Start Metro bundler: `npx react-native start --reset-cache`
2. Run iOS app: `./scripts/development/run-ios-18-6.sh`
3. If network issues occur, restart Metro and rebuild
4. For physical device testing, use Xcode or `npx react-native run-ios --device`
5. Deploy API: `./scripts/deployment/deploy-api.sh`

## Project Structure
```
/
├── src/                    # React Native source code
│   ├── components/         # Reusable UI components
│   ├── screens/            # Screen components
│   ├── services/           # API and business logic
│   ├── store/              # Redux store and slices
│   ├── theme/              # Styling and theming
│   └── utils/              # Utility functions
├── ios/                    # iOS native code
├── android/                # Android native code
├── server/                 # Backend API server
├── scripts/                # Build and deployment scripts
│   ├── development/        # Dev scripts (run-ios-18-6.sh)
│   └── deployment/         # Deploy scripts (deploy-api.sh)
├── docs/                   # Documentation
│   └── planning/           # Feature planning docs
├── config/                 # Configuration files
├── __tests__/              # Test files
└── assets/                 # Static assets
```