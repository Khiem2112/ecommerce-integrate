import { NextRequest, NextResponse } from 'next/server';
import { completeShopAuthorizationService } from '@/services/shopAuthorizationService';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> },
): Promise<NextResponse> {
  const { platform } = await context.params;
  const searchParams = request.nextUrl.searchParams;

  const code = searchParams.get('code') ?? undefined;
  const state = searchParams.get('state') ?? undefined;
  const error = searchParams.get('error') ?? undefined;
  const errorDescription =
    searchParams.get('error_description') ?? searchParams.get('message') ?? undefined;
  const shop = searchParams.get('shop') ?? undefined;

  const result = await completeShopAuthorizationService({
    platformCode: platform.toLowerCase(),
    code,
    state,
    error,
    errorDescription,
    shop,
  });

  const baseUrl = request.nextUrl.origin;
  const redirectUrl = new URL('/shops', baseUrl);

  if (result.attemptId) {
    redirectUrl.searchParams.set('attempt', String(result.attemptId));
  }
  redirectUrl.searchParams.set('status', result.status);

  if (!result.success && result.error) {
    redirectUrl.searchParams.set('error', result.error);
  }

  return NextResponse.redirect(redirectUrl);
}
