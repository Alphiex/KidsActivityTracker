# Project Scripts

Utility scripts for development, deployment, and maintenance of Kids Activity Tracker.

## 📁 Directory Structure

```
scripts/
├── README.md (this file)
├── setup/                  # Initial project setup
├── development/            # Development utilities  
│   ├── reload-app.js
│   └── fix-all-project-references.sh
└── deployment/             # Deployment automation
```

## 🔧 Development Scripts

### reload-app.js
Reloads the React Native app during development without rebuilding.

**Usage:**
```bash
node scripts/development/reload-app.js
```

**When to use:**
- After code changes in development
- When app state seems stale
- To refresh without full rebuild

**Note:** Metro bundler must be running.

---

### fix-all-project-references.sh
Fixes project reference issues after major file moves or updates.

**Usage:**
```bash
bash scripts/development/fix-all-project-references.sh
```

**When to use:**
- After reorganizing project structure
- When import paths are broken
- After updating native dependencies
- When Xcode project references are stale

**What it does:**
- Updates iOS project file references
- Fixes CocoaPods paths
- Clears build caches
- Resets Metro bundler cache

---

## 🚀 Deployment Scripts

*Coming soon - deployment automation scripts*

Planned scripts:
- `deploy-ios.sh` - iOS TestFlight deployment
- `deploy-android.sh` - Android Play Store deployment  
- `deploy-server.sh` - Backend deployment to Google Cloud

---

## ⚙️ Setup Scripts

*Coming soon - initial project setup scripts*

Planned scripts:
- `initial-setup.sh` - First-time project setup
- `install-dependencies.sh` - Install all dependencies
- `setup-environment.sh` - Configure environment variables

---

## 📱 iOS-Specific Scripts

iOS build and deployment scripts are in `ios/scripts/`:
- `build-and-archive.sh` - Build and archive iOS app
- `deploy-to-testflight.sh` - Deploy to TestFlight
- `fix-hermes-dsym.sh` - Fix Hermes debugging symbols

See [ios/scripts/README.md](../ios/scripts/README.md) for details.

---

## 🖥️ Server-Specific Scripts

Backend server scripts are in `server/scripts/`:
- `database/` - Database seeds, migrations, fixes
- `deployment/` - Server deployment scripts
- `utilities/` - Maintenance and utility scripts

See [server/scripts/README.md](../server/scripts/README.md) for details.

---

## ⚠️ Important Notes

### Before Running Scripts:

1. **Backup your work**
   ```bash
   git add .
   git commit -m "Backup before running scripts"
   ```

2. **Check script permissions**
   ```bash
   chmod +x scripts/development/*.sh
   ```

3. **Review script contents**
   - Always read scripts before executing
   - Understand what they do
   - Check for hardcoded paths

### Running Scripts Safely:

```bash
# Good - explicit path
bash scripts/development/fix-all-project-references.sh

# Good - from scripts directory
cd scripts/development
bash fix-all-project-references.sh

# Bad - may execute wrong script
./fix-all-project-references.sh
```

### Common Issues:

**"Permission denied"**
```bash
chmod +x scripts/development/scriptname.sh
```

**"Command not found"**
- Check you're in project root
- Use full path to script
- Ensure script has correct shebang (`#!/bin/bash`)

**"No such file or directory"**
- Script may reference old paths
- Update paths in script
- Check file was moved correctly

---

## 🆕 Adding New Scripts

### Guidelines:

1. **Choose correct directory**
   - `setup/` - Initial setup only
   - `development/` - Daily development tasks
   - `deployment/` - Production deployment

2. **Follow naming convention**
   - Use kebab-case: `my-script-name.sh`
   - Make purpose clear: `fix-metro-cache.sh`
   - Add extension: `.sh` or `.js`

3. **Add documentation**
   ```bash
   #!/bin/bash
   # Script: my-new-script.sh
   # Purpose: Does something important
   # Usage: bash scripts/development/my-new-script.sh
   # Author: Your Name
   ```

4. **Update this README**
   - Add script to appropriate section
   - Document usage and purpose
   - Note any requirements

5. **Test thoroughly**
   - Test in clean environment
   - Test error cases
   - Document all outputs

---

## 🔒 Security Considerations

- **Never commit secrets in scripts**
- Use environment variables for sensitive data
- Don't log passwords or tokens
- Be careful with `rm -rf` commands
- Always use quotes around variables: `"$VAR"`

Example:
```bash
# Bad
rm -rf $DIR/*

# Good  
if [ -d "$DIR" ]; then
  rm -rf "$DIR"/*
fi
```

---

## 📚 Related Documentation

- [Development Guide](../docs/guides/DEVELOPMENT_GUIDE.md)
- [Deployment Guide](../docs/guides/DEPLOYMENT.md)
- [iOS Scripts](../ios/scripts/README.md)
- [Server Scripts](../server/scripts/README.md)

---

**Last Updated:** 2025-09-26  
**Maintainer:** Development Team