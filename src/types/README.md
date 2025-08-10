# Type Definitions

There are currently two Activity type definitions that may be conflicting:

1. `/src/types/index.ts` - Original Activity interface with Schedule and Location as objects
2. `/src/types/activity.ts` - Enhanced Activity interface with string fields

The navigation is failing because of type mismatches between these definitions.

Current usage:
- Most screens import from `/types` (index.ts)
- Navigation types import from `/types/activity`
- This creates a mismatch when passing activities between screens