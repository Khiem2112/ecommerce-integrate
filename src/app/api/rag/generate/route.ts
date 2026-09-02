import { NextRequest, NextResponse } from 'next/server';
import { ragGenerateSchema } from '@/forms/ragForm';
import { generateGroundedResponse } from '@/services/rag';
import { createAiDraftService, getAiDraftDetailService } from '@/services/aiDraftService';

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

    // Persist draft to MySQL database for lifecycle tracking
    const createdDraft = await createAiDraftService({
      conversationId,
      triggerMessageId: result.triggerMessage?.id ?? null,
      recommendedStrategyCode: result.response.recommendedStrategyId,
      recommendationReason: result.response.recommendationReason,
      recommendationGroundedFacts: result.response.recommendationGroundedFactsUsed,
      providerUsed: result.response.providerUsed,
      groundingIsValid: result.grounding.isValid,
      groundingPrecision: Object.values(result.grounding.byStrategyId).reduce(
        (min, sg) => Math.min(min, sg?.groundingPrecision ?? 1),
        1.0,
      ),
      groundingViolations: Object.values(result.grounding.byStrategyId).flatMap(
        (sg) => sg?.violations ?? [],
      ),
      strategies: result.response.strategies.map((strategy) => {
        const strategyGrounding = result.grounding.byStrategyId[strategy.id];
        return {
          strategyCode: strategy.id,
          rank: strategy.rank,
          draftText: strategy.draftText,
          confidence: strategy.confidence,
          suggestedAction: strategy.suggestedAction,
          groundedFactsUsed: strategy.groundedFactsUsed,
          ungroundedClaims: strategy.ungroundedClaims,
          proposedCompensation: strategy.proposedCompensation,
          isBestMatch: strategy.isBestMatch,
          groundingIsValid: strategyGrounding?.isValid ?? true,
          groundingPrecision: strategyGrounding?.groundingPrecision ?? 1.0,
          groundingViolations: strategyGrounding?.violations ?? [],
        };
      }),
    });

    // Fetch complete persisted draft DTO to return to client
    const fullDraftDto = await getAiDraftDetailService(createdDraft.id, conversationId);

    return NextResponse.json({
      success: true,
      data: fullDraftDto ?? {
        id: createdDraft.id,
        draftId: createdDraft.id,
        status: 'pending',
        createdAt: new Date().toISOString(),
        response: result.response,
        grounding: result.grounding,
        triggerMessage: result.triggerMessage,
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
