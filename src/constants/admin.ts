// Admin configuration constants
export const ADMIN_EMAIL = 'polyglAITool@gmail.com';

// Helper function to check if an email belongs to admin
export const isAdminEmail = (email?: string): boolean => {
  return email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
};
