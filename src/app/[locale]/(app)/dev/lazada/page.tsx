import { Metadata } from 'next';
import { LazadaDevPlayground } from '@/components/dev/LazadaDevPlayground';

export const metadata: Metadata = {
  title: 'Lazada Dev Playground & Metadata Explorer | OmniCart',
  description: 'Tra cứu siêu dữ liệu Categories, Brands và kiểm thử API Lazada Open Platform.',
};

export default function LazadaDevPage() {
  return <LazadaDevPlayground />;
}
