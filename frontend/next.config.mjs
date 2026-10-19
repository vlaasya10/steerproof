/** @type {import('next').NextConfig} */
if (process.env.VERCEL) {
  const api = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost");
  if (api.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(api.hostname)) {
    throw new Error("Set NEXT_PUBLIC_API_URL to your public HTTPS backend URL before deploying");
  }
}
const nextConfig = {
  reactStrictMode: false,
  // Lets a dev server or a verification build run beside a live `next start` without clobbering .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
