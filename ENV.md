# Environment Variables Guide

Copy this content to your `.env.local` file and fill in your actual values.

```bash
# =============================================================================
# GEMINI AI (Optional)
# =============================================================================
# Used for AI-powered defect analysis from photos
# Get your API key from: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# =============================================================================
# CLOUDINARY (Required for Image Uploads)
# =============================================================================
# Sign up at: https://cloudinary.com/
# These are required for photo uploads to work

# Cloud name from your Cloudinary dashboard
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name

# API credentials (used in Netlify Functions)
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# =============================================================================
# DATABASE (Required for Cloud Sync)
# =============================================================================
# PostgreSQL connection string
# Recommended provider: Neon.tech (https://neon.tech) - has generous free tier
# Format: postgresql://user:password@host:port/database?sslmode=require

DATABASE_URL=postgresql://user:password@host:5432/bluetag
# Netlify may also use this variable name:
NETLIFY_DATABASE_URL=postgresql://user:password@host:5432/bluetag

# =============================================================================
# DEVELOPMENT SERVER (Optional)
# =============================================================================
# Default is 8080, change if needed
PORT=8080

# Enable debug logging in production (default: false)
VITE_DEBUG=false
```

## Setup Instructions

1. Copy the content above to a new file named `.env.local` in the project root
2. Fill in your actual credentials
3. Never commit `.env.local` to git (it's already in .gitignore)

## Notes

- **Offline-First**: The app works offline, database only needed for multi-device sync
- **Cloudinary**: Required for photo uploads
- **Gemini AI**: Optional - manual descriptions used if not set
- **Debug Mode**: Set `VITE_DEBUG=true` to enable console logging in production (useful for troubleshooting)

