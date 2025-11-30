
// Firebase service stripped for local-only / Netlify deployment
// This removes dependencies on API Keys that were causing crashes.

// If you decide to add a backend later, re-integrate the SDK here.
export const auth = null;
export const db = null;

export const loginWithGoogle = async () => {
  console.warn("Google Login is disabled in this version.");
  return null;
};

export const logoutUser = async () => {
  console.warn("Logout is disabled.");
  return;
};
