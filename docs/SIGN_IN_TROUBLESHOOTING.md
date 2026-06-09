# Sign In & Favicon Issues - Resolution Guide

## Issues Resolved

### 1. Missing Favicon (404 Error)
**Problem:** Browser requesting `favicon.ico` and getting a 404 error response.

**Solution:** Added an inline SVG favicon via data URI in `src/routes/__root.tsx`

**How it was fixed:**
- Added `rel="icon"` link element with an SVG data URI to the root route's head metadata
- Uses a simple "P!" design in a data URI to avoid creating separate files
- No additional dependencies or assets required

**Code change in `__root.tsx`:**
```tsx
links: [
  { rel: "icon", href: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><text x=%2250%%22 y=%2275%%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 font-size=%2224%22>P!</text></svg>" },
  // ... other links
],
```

### 2. Browser Extension Warnings
**Problem:** `MaxListenersExceededWarning` and `ObjectMultiplex` errors in console

**Root Cause:** These warnings originate from browser extensions (MetaMask, uBlock Origin, etc.) injecting scripts into the page - not from the PromptStar application itself.

**Solution:** No application code changes needed. These are safe to ignore.

**Verification:** The errors come from `contentscript.js` which is a browser extension artifact, not part of the app bundle.

---

## How Authentication Works

### Sign In Flow
1. User enters email and password in `/auth` route
2. Form submission calls `signIn()` server function via `@tanstack/react-start`
3. Backend validates credentials against `users` table using bcrypt
4. If valid, creates a session token in the `sessions` table
5. Sets `promptstar_session` HTTP-only cookie
6. Client invalidates React Query cache and navigates to `/dashboard`

### Database Schema
```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  username VARCHAR NOT NULL,
  password_hash VARCHAR NOT NULL,
  mascot VARCHAR DEFAULT 'nova',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sessions table
CREATE TABLE sessions (
  token VARCHAR PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL
);
```

### Testing the Auth System
A test user is available for local development:
- **Email:** `test@example.com`
- **Password:** `password123`

To create more test users via Node:
```bash
npm run db:migrate  # Ensure schema is up to date
```

---

## Running the App Locally

### Prerequisites
1. Docker Desktop must be running
2. Node.js and npm installed

### Startup Commands
```bash
# Terminal 1: Start PostgreSQL
docker-compose up -d

# Terminal 2: Run dev server
npm run dev
```

The app will be available at `http://localhost:3000/`

### Troubleshooting Startup Issues

**Docker daemon not running:**
```bash
# Start Docker Desktop (macOS)
open -a Docker
```

**Port 5432 already in use:**
```bash
# Kill process on port 5432
lsof -ti:5432 | xargs kill -9

# Or use docker-compose to restart
docker-compose down -v
docker-compose up -d
```

**Database migrations not applied:**
```bash
npm run db:migrate
```

---

## Browser Console Warnings - Expected & Safe

### ⚠️ These can be safely ignored:

1. **`MaxListenersExceededWarning`** → Browser extension issue
2. **`ObjectMultiplex - orphaned data`** → Browser extension communication error  
3. **`Failed to load favicon.ico`** → Now fixed with inline SVG

### ✅ These indicate real issues and should be investigated:

1. TypeScript compilation errors in `npm run build`
2. Database connection errors in the server logs
3. Network errors in the Network tab (not 404s for `favicon.ico`)
4. Uncaught JavaScript errors in the Console tab

---

## Prevention: Keep These Practices Going Forward

1. **Always test sign-in flow** before deploying authentication changes
2. **Run `npm run build`** to catch errors before committing
3. **Check the Network tab** (DevTools) for actual API failures, not just favicon 404s
4. **Disable browser extensions** when debugging network issues
5. **Keep session token expiry logic simple** - 30-day DB expiry + optional cookie persistence

---

## Files Modified

- `src/routes/__root.tsx` - Added favicon link and mascot preload

## Build & Test

```bash
# Build for production
npm run build

# Should output: ✓ built in XXXms
# With no TypeScript errors
```

---

**Last Updated:** June 9, 2026  
**Status:** Favicon issue resolved. Auth system functional. Browser warnings are harmless.
