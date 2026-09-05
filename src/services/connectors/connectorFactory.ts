/**
 * Channel Connector Factory
 * Instantiates and caches connector instances by platform code.
 */

import type { ChannelConnector } from '@/types';
import { LazadaConnector } from './lazada/lazadaConnector';
import { LazadaClient } from './lazada/lazadaClient';

let lazadaConnectorSingleton: LazadaConnector | null = null;

export function getLazadaConnector(customClient?: LazadaClient): LazadaConnector {
  if (customClient) {
    return new LazadaConnector(customClient);
  }
  if (!lazadaConnectorSingleton) {
    lazadaConnectorSingleton = new LazadaConnector();
  }
  return lazadaConnectorSingleton;
}

/**
 * Universal factory to resolve channel connector for a given platform.
 */
export function getChannelConnector(platform: 'lazada' | 'mock' | string = 'lazada'): ChannelConnector {
  const normalized = platform.toLowerCase().trim();

  switch (normalized) {
    case 'lazada':
    case 'mock':
      return getLazadaConnector();
    default:
      // Fallback to default Lazada connector
      return getLazadaConnector();
  }
}
