import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSessionContextService } from '@/services/authentication/authSessionService';
import { buildFullContext } from '@/services/rag';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getAuthenticatedSessionContextService();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const organizationId = session.activeOrganization?.organizationId;
    if (organizationId == null) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const rawId = searchParams.get('conversationId');

    if (!rawId) {
      return NextResponse.json(
        { success: false, error: 'Missing required query parameter "conversationId"' },
        { status: 400 },
      );
    }

    const conversationId = parseInt(rawId, 10);
    if (isNaN(conversationId) || conversationId <= 0) {
      return NextResponse.json(
        { success: false, error: '"conversationId" must be a positive integer' },
        { status: 400 },
      );
    }

    const context = await buildFullContext(conversationId, organizationId);
    if (!context) {
      return NextResponse.json(
        { success: false, error: `Conversation ${conversationId} not found` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: context,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
