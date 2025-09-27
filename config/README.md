# Configuration Files

All project configuration files for build tools, linters, and development environment.

## 📄 Files

- `.env.example` - Environment variables template
- `.eslintrc.js` - ESLint linting configuration
- `.prettierrc.js` - Prettier code formatting rules
- `babel.config.js` - Babel transpiler configuration
- `metro.config.js` - Metro bundler configuration
- `jest.config.js` - Jest testing framework configuration
- `tsconfig.json` - TypeScript compiler configuration

## ⚙️ Environment Variables

Copy `.env.example` to `.env` in project root:

```bash
cp config/.env.example .env
```

Required variables:
- `API_BASE_URL` - Backend API URL (default: production)
- `JWT_SECRET` - Authentication secret (server only)

See `.env.example` for full list with descriptions.

## 🔧 Modifying Configurations

**Important**: Config files are symlinked from project root for tool compatibility.

### When Editing:
1. Edit the file in `config/` directory
2. Changes automatically reflect in root via symlink
3. Commit changes to `config/` directory only

### Symlinked Files:
```
Root → Config Directory
.eslintrc.js → config/.eslintrc.js
.prettierrc.js → config/.prettierrc.js
babel.config.js → config/babel.config.js
metro.config.js → config/metro.config.js
jest.config.js → config/jest.config.js
tsconfig.json → config/tsconfig.json
```

## 🔍 Configuration Details

### ESLint (.eslintrc.js)
Enforces code quality and style guidelines.

```bash
npm run lint          # Check for issues
npm run lint -- --fix # Auto-fix issues
```

### Prettier (.prettierrc.js)
Automatic code formatting.

```bash
npm run format  # Format all files
```

### Babel (babel.config.js)
Transpiles modern JavaScript/TypeScript for React Native.

### Metro (metro.config.js)
Bundles JavaScript for React Native apps. Configured to use project root.

### Jest (jest.config.js)
Testing framework configuration.

```bash
npm test        # Run tests
npm test -- --watch  # Watch mode
```

### TypeScript (tsconfig.json)
TypeScript compiler options and path mappings.

```bash
npx tsc --noEmit  # Type-check without compilation
```

## 🚨 Common Issues

### "Cannot find config file"
- Ensure symlinks exist in root directory
- On Windows, may need admin rights for symlinks
- Alternative: Copy files to root (not recommended)

### Metro bundler issues
- Clear cache: `npm start -- --reset-cache`
- Check `projectRoot` in metro.config.js points to `..`

### TypeScript errors
- Run `npm install` to update dependencies
- Check `tsconfig.json` paths match actual structure

## 📝 Adding New Config Files

1. Create file in `config/` directory
2. If tool requires root location, create symlink:
   ```bash
   ln -s config/newfile.config.js newfile.config.js
   ```
3. Update this README
4. Add to `.gitignore` if needed (archive directory ignores symlinks)

## 🔒 Security Notes

- **Never commit `.env` files** (use `.env.example`)
- Keep secrets in environment variables
- Use different configs for dev/staging/production
- Server configs are in `server/config/`

## 📚 Related Documentation

- [Development Guide](../docs/guides/DEVELOPMENT_GUIDE.md)
- [Project Structure](../README.md)
- [Server Configuration](../server/README.md)