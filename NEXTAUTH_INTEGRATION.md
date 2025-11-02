# NextAuth + WordPress JWT Integration Guide

## Overview
This implementation integrates NextAuth.js (for Google OAuth) with your existing headless WordPress JWT authentication system.

## What Was Updated

### 1. UserContext.js
**Location:** `/app/contexts/UserContext.js`

**Key Changes:**
- Added `useSession` and `signOut` from `next-auth/react`
- Modified `initializeUser()` to handle both NextAuth sessions and traditional JWT tokens
- Updated `logout()` to sign out from NextAuth
- Added `authFetch()` helper for authenticated API requests
- Added `isAuthenticated` flag to the context value

**How it works:**
1. When a user logs in with Google, NextAuth creates a session
2. The session contains a WordPress JWT (`wpJwt`) obtained during the sign-in callback
3. UserContext detects the NextAuth session and stores the JWT in cookies
4. For traditional logins, it continues to work as before

### 2. SocialAuthButtons.js
**Location:** `/app/components/SocialAuthButtons.js`

**Key Changes:**
- Updated `callbackUrl` to redirect to `/` (home page) after successful login
- Prevents form submission with `e.preventDefault()`
- Handles errors gracefully

### 3. NextAuth Configuration
**Location:** `/app/auth/options.js`

**How the JWT Exchange Works:**
1. User clicks "Sign in with Google"
2. Google OAuth flow completes
3. In the `signIn` callback, we send the user's email to your WordPress backend
4. WordPress returns a JWT token
5. The JWT is stored in the NextAuth session via the `jwt` and `session` callbacks
6. UserContext picks up the JWT from the session

## Environment Variables Required

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3232  # or your production URL
NEXTAUTH_SECRET=your-secret-here    # Generate with: openssl rand -base64 32

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# WordPress Backend
NEXT_PUBLIC_WORDPRESS_URL=your-wordpress-url
```

## Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" > "Credentials"
3. Add these Authorized Redirect URIs:
   - Local: `http://localhost:3232/api/auth/callback/google`
   - Production: `https://next-lista.vercel.app/api/auth/callback/google`

## WordPress Backend Requirements

Your WordPress backend needs to:
1. Have the JWT Authentication plugin installed
2. Accept POST requests to `/wp-json/jwt-auth/v1/token`
3. Accept the following payload:
   ```json
   {
     "email": "user@example.com",
     "username": "user",
     "password": "google-id-token"
   }
   ```
4. Return a response like:
   ```json
   {
     "token": "jwt-token-here",
     "user": {
       "id": 1,
       "name": "User Name",
       "email": "user@example.com"
     }
   }
   ```

## Using the Updated UserContext

```javascript
import { useUserContext } from "@/contexts/UserContext";

function MyComponent() {
  const { userData, token, loading, isAuthenticated, logout, authFetch } = useUserContext();

  // Check if user is authenticated
  if (isAuthenticated) {
    console.log("User is logged in:", userData);
  }

  // Make authenticated API requests
  const fetchData = async () => {
    try {
      const data = await authFetch("/custom/v1/my-endpoint");
      console.log(data);
    } catch (error) {
      console.error("API error:", error);
    }
  };

  // Logout
  const handleLogout = async () => {
    await logout();
    // User will be logged out from both NextAuth and your app
  };
}
```

## Debugging

To see what's happening during authentication:
1. Open your browser's console
2. Look for these log messages:
   - "Initiating Google sign in..."
   - "SignIn Result:"
   - "Initializing user from NextAuth session"
   - "User initialization error:" (if there's an issue)

## Troubleshooting

### Issue: User not authenticated after Google login
**Solution:** Check that:
1. Your WordPress backend is returning a valid JWT
2. The `NEXT_PUBLIC_WORDPRESS_URL` environment variable is correct
3. The WordPress JWT endpoint is accessible

### Issue: Redirect loop
**Solution:** Clear your browser cookies and try again

### Issue: "Session expired" error
**Solution:** The WordPress JWT might have expired. Logout and login again.

## Next Steps

1. Test the Google login flow in development
2. Deploy to production and test there
3. Add error notifications to show users when login fails
4. Consider adding Facebook login (currently commented out)
5. Add user profile management features
