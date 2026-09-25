import path, { dirname } from "path";
import { fileURLToPath } from "url";

import pkg from "@sentry/nextjs";
const { withSentryConfig } = pkg;
import withBundleAnalyzer from "@next/bundle-analyzer";

// ===== VALIDATION INTELLIGENTE DES VARIABLES D'ENVIRONNEMENT =====
const validateEnv = () => {
  const NODE_ENV = process.env.NODE_ENV || "development";
  const IS_CI =
    process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
  const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build";

  console.log(`🔍 Environment Detection:
    - NODE_ENV: ${NODE_ENV}
    - IS_CI: ${IS_CI}
    - IS_BUILD_PHASE: ${IS_BUILD_PHASE}
  `);

  const BUILD_TIME_VARS = [
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
    "NEXT_PUBLIC_CLOUDINARY_API_KEY",
    "NEXT_PUBLIC_SENTRY_DSN",
    "NEXT_PUBLIC_ENABLE_SW",
  ];

  const RUNTIME_VARS = [
    "API_URL",
    "DB_URI",
    "NEXTAUTH_URL",
    "NEXTAUTH_SECRET",
    "CLOUDINARY_API_SECRET",
    "RESEND_API_KEY",
    "SENTRY_URL",
    "SENTRY_PROJECT",
    "SENTRY_ORG",
    "SENTRY_AUTH_TOKEN",
    "SENTRY_IGNORE_API_RESOLUTION_ERROR",
    "DEFAULT_PRODUCTS_PER_PAGE",
    "MAX_PRODUCTS_PER_PAGE",
    "QUERY_TIMEOUT",
    "CACHE_MAX_AGE_CATEGORIES",
    "CACHE_MAX_AGE_PRODUCTS",
  ];

  const ALWAYS_REQUIRED = ["NODE_ENV"];

  let requiredVars = [];

  if (NODE_ENV === "development") {
    requiredVars = [...ALWAYS_REQUIRED];
    console.log("🔧 Dev mode: Basic validation only");
  } else if (IS_CI && NODE_ENV === "production") {
    requiredVars = [...ALWAYS_REQUIRED, ...BUILD_TIME_VARS];
    console.log("🏗️ CI Build mode: Validating BUILD_TIME_VARS");
  } else if (NODE_ENV === "production" && !IS_CI) {
    requiredVars = [...ALWAYS_REQUIRED, ...RUNTIME_VARS, ...BUILD_TIME_VARS];
    console.log("🚀 Production runtime: Validating ALL variables");
  }

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    const context = IS_CI ? "CI Build" : NODE_ENV;
    console.warn(
      `⚠️ [${context}] Missing environment variables: ${missingVars.join(", ")}`,
    );

    if (NODE_ENV === "production" && !IS_CI) {
      throw new Error(
        `❌ Production runtime failed: Missing critical environment variables: ${missingVars.join(
          ", ",
        )}`,
      );
    }
  } else {
    const context = IS_CI ? "CI Build" : NODE_ENV;
    console.log(
      `✅ [${context}] All required environment variables are present`,
    );
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 🚀 EXÉCUTER LA VALIDATION
// validateEnv();

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  analyzerMode: "static",
  openAnalyzer: false,
});

const nextConfig = {
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,

  serverExternalPackages: ["mongoose"],

  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
        pathname: "**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn", "log"],
          }
        : false,
  },

  staticPageGenerationTimeout: 180,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(self https://upload-widget.cloudinary.com), microphone=(self https://upload-widget.cloudinary.com), geolocation=(), interest-cohort=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
          },
          {
            key: "Content-Security-Policy",
            value: `
            default-src 'self';
            script-src 'self' 'unsafe-eval' 'unsafe-inline' https://upload-widget.cloudinary.com;
            style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;
            img-src 'self' blob: data: https://res.cloudinary.com https://bs-2-plus-client-better.vercel.app;
            font-src 'self' data: https://cdnjs.cloudflare.com;
            connect-src 'self' https://res.cloudinary.com https://api.cloudinary.com https://upload-widget.cloudinary.com ${process.env.NODE_ENV === "production" ? "https://*.sentry.io https://sentry.io" : ""};
            media-src 'self' https://res.cloudinary.com;
            object-src 'none';
            frame-src 'self' https://upload-widget.cloudinary.com;
            frame-ancestors 'self';
            base-uri 'self';
            form-action 'self';
            manifest-src 'self';
            worker-src 'self';
            upgrade-insecure-requests;
          `
              .replace(/\s{2,}/g, " ")
              .trim(),
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-XSS-Protection",
            value: "0",
          },
        ],
      },

      {
        source: "/api/homepage",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=7200",
          },
          {
            key: "CDN-Cache-Control",
            value: "max-age=7200",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Vary",
            value: "Accept-Encoding",
          },
        ],
      },

      {
        source: "/api/(products|category|paymentPlatform)/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, stale-while-revalidate=600",
          },
          {
            key: "CDN-Cache-Control",
            value: "max-age=600",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Vary",
            value: "Accept-Encoding",
          },
        ],
      },

      {
        source: "/api/auth/:path*",
        headers: [
          {
            key: "Cache-Control",
            value:
              "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
          {
            key: "Surrogate-Control",
            value: "no-store",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet",
          },
          {
            key: "X-Download-Options",
            value: "noopen",
          },
        ],
      },

      {
        source: "/api/(address|cart|orders|emails)/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
          {
            key: "X-Download-Options",
            value: "noopen",
          },
        ],
      },

      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },

      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=7200",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Accept-Ranges",
            value: "bytes",
          },
        ],
      },

      {
        source:
          "/(favicon.ico|icon-*.png|apple-touch-icon.png|robots.txt|sitemap.xml)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=43200",
          },
        ],
      },

      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },

      {
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
        ],
      },

      {
        source: "/(404|500|error)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, must-revalidate",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },

      {
        source:
          "/(login|register|forgot-password|reset-password|cart|shipping|payment|confirmation)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, must-revalidate",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: "/404",
        destination: "/",
        permanent: false,
      },
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
    ];
  },

  serverRuntimeConfig: {
    PROJECT_ROOT: __dirname,
  },

  webpack: (config, { dev, isServer }) => {
    if (!dev) {
      config.optimization.moduleIds = "deterministic";

      if (!isServer) {
        config.optimization.splitChunks = {
          chunks: "all",
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: "vendor",
              priority: 10,
              reuseExistingChunk: true,
            },
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
          },
        };
      }

      config.cache = {
        type: "filesystem",
        cacheDirectory: path.resolve(__dirname, ".next/cache/webpack"),
      };

      config.infrastructureLogging = {
        level: "error",
      };
    }

    return config;
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development",
    },
  },
};

const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG || "benew",
  project: process.env.SENTRY_PROJECT || "buyitnow",
  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: true,

  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,

  widenClientFileUpload: true,
  transpileClientSDK: true,
  hideSourceMaps: true,

  dryRun:
    process.env.NODE_ENV !== "production" || !process.env.SENTRY_AUTH_TOKEN,

  debug: false,

  include: ".next",
  ignore: ["node_modules", ".next/cache"],
};

export default withSentryConfig(
  bundleAnalyzer(nextConfig),
  sentryWebpackPluginOptions,
);
