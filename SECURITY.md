# Authentication & Security Guide

## Current Architecture: Offline-First

BlueTag is designed as an **offline-first** Progressive Web App (PWA). This means:

### How It Works

1. **Local Storage First**: All data is stored locally in IndexedDB (with localStorage fallback)
2. **No Auth Required for Basic Use**: Users can create, edit, and view reports without logging in
3. **Optional Cloud Sync**: When a user logs in via Netlify Identity, reports sync across devices
4. **Backend Protection**: Cloud storage is fully protected - only authenticated users can access their own data

### Security Model

#### Frontend (Browser)
- ✅ No authentication required for offline use
- ✅ Data stored locally in browser (IndexedDB/localStorage)
- ⚠️ Anyone with device access can view local data (standard for offline-first apps)

#### Backend (Netlify Functions)
- ✅ All API endpoints require authentication via Netlify Identity JWT
- ✅ Row-level security: Users can only access their own reports
- ✅ User ID verified from JWT token (not client-provided)

### When to Add Frontend Auth Gate

You may want to require login before app use if:

1. **Company Policy**: Your organization requires authentication for all tools
2. **Audit Trail**: You need to track who created which reports
3. **No Offline**: You don't want users working without sync enabled

### How to Add Auth Gate (Optional)

If you want to require login before any app usage, add this to `App.tsx`:

```typescript
// After Netlify Identity setup (around line 236)
useEffect(() => {
  if (typeof window !== 'undefined' && window.netlifyIdentity) {
    const user = window.netlifyIdentity.currentUser();
    if (user) {
      setCurrentUser(user);
    }

    window.netlifyIdentity.on('init', (user?: NetlifyUser) => {
       if (user) setCurrentUser(user);
    });

    window.netlifyIdentity.on('login', (user?: NetlifyUser) => {
      if (user) setCurrentUser(user);
      window.netlifyIdentity?.close();
    });

    window.netlifyIdentity.on('logout', () => {
      setCurrentUser(null);
      window.location.reload(); 
    });
  }
}, []);

// Add this new useEffect to show login modal if not authenticated
useEffect(() => {
  if (typeof window !== 'undefined' && window.netlifyIdentity) {
    const checkAuth = () => {
      const user = window.netlifyIdentity.currentUser();
      if (!user && !showSplash) {
        // Show login modal after splash screen
        window.netlifyIdentity.open('login');
      }
    };

    // Check after splash screen fades
    const timer = setTimeout(checkAuth, 3500);
    return () => clearTimeout(timer);
  }
}, [showSplash]);
```

Then update the main render to block UI:

```typescript
// In the main App return statement
if (!currentUser && !showSplash) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-200 dark:bg-slate-950 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Please sign in to continue</h1>
        <button 
          onClick={handleLogin}
          className="px-6 py-3 bg-primary text-white rounded-xl font-bold"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
```

## Current Setup (Recommended for Field Use)

The **current configuration is ideal for field workers** because:

- ✅ Works without internet connection
- ✅ No login friction when capturing issues on-site
- ✅ Data syncs automatically when back online
- ✅ Backend is fully protected with authentication

This follows the same model as popular offline-first apps like:
- Apple Notes (works offline, syncs via iCloud when available)
- Google Keep (works offline, syncs when online)
- Evernote (works offline, syncs when online)

## Recommendation

**Keep the current offline-first architecture** unless your specific use case requires frontend authentication. The backend is secure, and the offline-first design is optimal for field work.

If you need audit trails, enable Netlify Identity and encourage (but don't require) users to log in. Their reports will automatically sync when they do.


