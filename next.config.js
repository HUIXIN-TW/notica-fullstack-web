/** @type {import('next').NextConfig} */

// Allow framing from Notion and self
const frameAncestors = [
  "'self'",
  "https://www.notion.so",
  "https://notion.so",
  "https://*.notion.site",
];

// Allow framing from localhost in development
if (process.env.NODE_ENV !== "production") {
  frameAncestors.push("http://localhost:4000", "http://127.0.0.1:4000");
}

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: `frame-ancestors ${frameAncestors.join(" ")};`,
  },
];

const nextConfig = {
  output: "standalone",
  webpack: (config) => {
    config.experiments = config.experiments || {};
    config.experiments.layers = true;
    return config;
  },
  // Set security headers for all routes
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // bundle in frontend code that uses process.env.NEXT_PUBLIC_*
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    NOTION_CLIENT_ID: process.env.NOTION_CLIENT_ID,
    APP_ENV: process.env.APP_ENV || "production",
    NEXT_PUBLIC_BUILD_VERSION:
      process.env.NEXT_PUBLIC_BUILD_VERSION || new Date().toISOString(),
  },
};

module.exports = nextConfig;
