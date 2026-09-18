import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

// Đọc domain ngrok từ biến môi trường .env (Single Source of Truth)
const rawNgrokDomain = process.env.NGROK_DOMAIN;
const ngrokDomain = rawNgrokDomain
  ? rawNgrokDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim()
  : undefined;

const allowedOrigins: string[] = [
  'localhost:3000',
  'localhost:3001',
  'localhost:3002',
  '127.0.0.1:3000',
  '127.0.0.1:3001',
  '127.0.0.1:3002',
  ...(ngrokDomain
    ? [
      ngrokDomain,
      '*.ngrok-free.dev',
      '*.ngrok-free.app',
      '*.ngrok.app',
    ]
    : []),
];

const nextConfig: NextConfig = {
  // Cho phép Next.js dev server phục vụ static chunks/HMR qua domain ngrok
  allowedDevOrigins: allowedOrigins,

  // Cho phép Server Actions gửi request từ domain ngrok
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
