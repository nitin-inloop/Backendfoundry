/**
 * Theme constants shared by the root layout (server) and <ThemeToggle> (client).
 * Kept out of the "use client" module so the layout receives the real string, not a client reference.
 */
export const THEME_STORAGE_KEY = "bf-theme";

/** Inline, render-blocking: sets `.dark` on <html> before first paint to avoid a light flash. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
