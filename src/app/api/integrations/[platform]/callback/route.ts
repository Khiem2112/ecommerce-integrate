import { NextRequest, NextResponse } from 'next/server';
import { completeShopAuthorizationService } from '@/services/shopAuthorizationService';

async function handleCallback(
  request: NextRequest,
  platform: string,
  method: 'GET' | 'POST',
): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;

  let code = searchParams.get('code') ?? undefined;
  let state = searchParams.get('state') ?? undefined;
  let error = searchParams.get('error') ?? undefined;
  let errorDescription =
    searchParams.get('error_description') ?? searchParams.get('message') ?? undefined;
  let shop = searchParams.get('shop') ?? undefined;

  // On POST: extract parameters from request body if not present in query string
  if (method === 'POST' && !code && !state) {
    try {
      const contentType = request.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const body = (await request.json()) as Record<string, unknown>;
        code = typeof body.code === 'string' ? body.code : code;
        state = typeof body.state === 'string' ? body.state : state;
        error = typeof body.error === 'string' ? body.error : error;
        errorDescription =
          typeof body.error_description === 'string'
            ? body.error_description
            : typeof body.message === 'string'
              ? body.message
              : errorDescription;
        shop = typeof body.shop === 'string' ? body.shop : shop;
      } else if (
        contentType.includes('application/x-www-form-urlencoded') ||
        contentType.includes('multipart/form-data')
      ) {
        const formData = await request.formData();
        code = (formData.get('code') as string) ?? code;
        state = (formData.get('state') as string) ?? state;
        error = (formData.get('error') as string) ?? error;
        errorDescription =
          ((formData.get('error_description') ?? formData.get('message')) as string) ??
          errorDescription;
        shop = (formData.get('shop') as string) ?? shop;
      }
    } catch {
      // Ignore body parsing failures on console probe/health check
    }
  }

  // Health check / verification probe from provider consoles (e.g. Lazada "Test Callback URL" button)
  // When a console pings without OAuth code/state/error, respond with 200 OK
  if (!code && !state && !error) {
    return NextResponse.json(
      {
        code: '0',
        success: true,
        message: `${platform.toUpperCase()} callback endpoint verified`,
        timestamp: Date.now(),
      },
      { status: 200 },
    );
  }

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> },
): Promise<NextResponse> {
  const { platform } = await context.params;
  return handleCallback(request, platform, 'GET');
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> },
): Promise<NextResponse> {
  const { platform } = await context.params;
  return handleCallback(request, platform, 'POST');
}

export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200 });
}
