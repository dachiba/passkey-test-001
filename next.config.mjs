const allowedOriginsEnv = process.env.ALLOWED_DEV_ORIGINS ?? '';
const allowedDevOrigins = Array.from(
  new Set(
    allowedOriginsEnv
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .flatMap((origin) => {
        if (!origin.includes('://')) {
          return [origin];
        }
        try {
          const url = new URL(origin);
          return [url.host, url.hostname];
        } catch (error) {
          console.warn('[next.config] ALLOWED_DEV_ORIGINS の解析に失敗しました', origin, error);
          return [origin];
        }
      })
      .filter(Boolean),
  ),
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
};

export default nextConfig;
