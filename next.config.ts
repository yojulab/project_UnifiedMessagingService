import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // mongoose / AWS SDK 는 서버 번들에서 제외하고 node_modules 에서 직접 로드한다.
  serverExternalPackages: ['mongoose', '@aws-sdk/client-sesv2'],
  poweredByHeader: false,
};

export default nextConfig;
