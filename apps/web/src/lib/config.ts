const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:4000";
const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim() ?? "";

export const config = {
  apiBaseUrl,
  adminEmail,
};
