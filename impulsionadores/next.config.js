/** @type {import('next').NextConfig} */
const isCloudflarePages = process.env.CF_PAGES === '1';

const nextConfig = {
  ...(isCloudflarePages
    ? {
        output: 'export',
        trailingSlash: true,
        images: {
          unoptimized: true,
        },
      }
    : {}),
};

module.exports = nextConfig;
