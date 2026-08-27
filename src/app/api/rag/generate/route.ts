import { NextRequest, NextResponse } from 'next/server';
import { ragGenerateSchema } from '@/forms/ragForm';
import { generateGroundedResponse } from '@/services/rag';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parseResult = ragGenerateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          issues: parseResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { conversationId } = parseResult.data;
    const result = await generateGroundedResponse(conversationId);

    return NextResponse.json({
      success: true,
      data: {
        response: result.response,
        grounding: result.grounding,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const isNotFound = message.includes('not found');

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: isNotFound ? 404 : 500 },
    );
  }
}
