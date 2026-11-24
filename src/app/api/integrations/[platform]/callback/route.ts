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

  const payload = result.success
    ? {
        type: 'OMNICART_SHOP_AUTH_SUCCESS',
        connectionId: result.connectionId,
        attemptId: result.attemptId,
        platformCode: platform,
        externalShopId: result.externalShopId ?? '',
        shopName: result.shopName ?? '',
        tokenExpiresAt: result.tokenExpiresAt ?? '',
      }
    : {
        type: 'OMNICART_SHOP_AUTH_ERROR',
        attemptId: result.attemptId,
        platformCode: platform,
        error: result.error ?? 'Authorization failed',
      };

  const html = `<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <title>${result.success ? 'Xác thực thành công' : 'Xác thực thất bại'}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f3f0ee; color: #141413; text-align: center; }
      .card { background: white; padding: 24px 32px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 400px; }
      h3 { margin-top: 0; color: #141413; }
      p { margin-bottom: 0; color: #696969; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h3>${result.success ? 'Xác thực thành công' : 'Xác thực thất bại'}</h3>
      <p>${result.success ? 'Đang hoàn tất và đóng cửa sổ...' : (result.error ?? 'Không thể kết nối. Đang đóng cửa sổ...')}</p>
    </div>
    <script>
      (function() {
        var payload = ${JSON.stringify(payload)};
        var redirectUrl = ${JSON.stringify(redirectUrl.toString())};
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage(payload, window.location.origin);
          } catch (e) {
            console.error('Failed to postMessage to opener:', e);
          }
          setTimeout(function() { window.close(); }, ${result.success ? 250 : 1500});
        } else {
          window.location.href = redirectUrl;
        }
      })();
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
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
