export type InboxFilters = {
  readonly statusCode?: string;
  readonly priority?: string;
  readonly searchQuery?: string;
};

export type WorkspaceMessage = {
  readonly id: number;
  readonly senderCode: string;
  readonly senderName: string;
  readonly isHuman: boolean;
  readonly isAgent: boolean;
  readonly messageType: string;
  readonly text: string | null;
  readonly timestamp: string;
  readonly confidence: number | null;
  readonly groundedFacts: readonly string[];
  readonly ungroundedClaims: readonly string[];
  readonly suggestedAction: string | null;
};

export type ConversationSummary = {
  readonly id: number;
  readonly customerId: number;
  readonly customerIdentifier: string;
  readonly vipTierCode: string;
  readonly vipTierName: string;
  readonly intent: { readonly code: string; readonly name: string } | null;
  readonly priority: string;
  readonly status: { readonly code: string; readonly name: string };
  readonly assignedAgentName: string | null;
  readonly humanApprovalRequired: boolean;
  readonly latestMessage: WorkspaceMessage | null;
  readonly updatedAt: string;
};

export type ConversationDetail = ConversationSummary & {
  readonly messages: readonly WorkspaceMessage[];
};

export type LinkedOrderContext = {
  readonly platformOrderId: string;
  readonly totalValue: number;
  readonly discountAmount: number;
  readonly shippingFee: number;
  readonly currency: string;
  readonly currentStatus: { readonly code: string; readonly name: string };
  readonly items: readonly {
    readonly id: number;
    readonly productName: string;
    readonly quantity: number;
  }[];
  readonly statusHistory: readonly {
    readonly id: number;
    readonly changedAt: string;
    readonly note: string | null;
    readonly status: { readonly code: string; readonly name: string };
  }[];
};

export type CustomerContext = {
  readonly turn: {
    readonly conversationId: number;
    readonly recentMessages: readonly WorkspaceMessage[];
    readonly linkedOrder: LinkedOrderContext | null;
    readonly detectedIntent: { readonly code: string; readonly name: string } | null;
    readonly conversationPriority: string;
    readonly messageCount: number;
  };
  readonly dossier: {
    readonly customer: {
      readonly platformBuyerId: string;
      readonly vipScore: number;
      readonly totalSpend: number;
      readonly orderCount: number;
      readonly avgOrderValue: number;
      readonly daysSinceLastOrder: number | null;
      readonly cancellationRate: number;
      readonly refundRate: number;
      readonly vipTier: { readonly code: string; readonly name: string };
    };
    readonly unresolvedConversationCount: number;
    readonly pastIntents: readonly string[];
    readonly totalConversationCount: number;
  };
  readonly evidence: {
    readonly facts: readonly {
      readonly id: number;
      readonly fact: string;
      readonly evidence: string;
      readonly confidence: number;
      readonly lastObserved: string;
    }[];
    readonly totalFactCount: number;
    readonly highConfidenceFactCount: number;
  };
};

export type RagDraft = {
  readonly response: {
    readonly responseText: string;
    readonly groundedFactsUsed: readonly string[];
    readonly ungroundedClaims: readonly string[];
    readonly confidence: number;
    readonly suggestedAction: 'auto_reply' | 'await_approval' | 'escalate_to_human';
    readonly providerUsed?: string;
  };
  readonly grounding: {
    readonly isValid: boolean;
    readonly groundingPrecision: number;
    readonly totalClaims: number;
    readonly groundedClaims: number;
    readonly violations: readonly {
      readonly type: string;
      readonly description: string;
      readonly severity: 'low' | 'medium' | 'high';
    }[];
  };
};

/** Browser-safe DTO for the Phase 1 multi-draft comparison experience. */
export type MultiDraftRagDraft = {
  readonly response: import('./rag').MultiDraftResponse;
  readonly grounding: import('./rag').MultiDraftGroundingResult;
};

export type SaveAiResponseInput = {
  readonly conversationId: number;
  readonly text: string;
  readonly groundedFactsUsed: readonly string[];
  readonly ungroundedClaims: readonly string[];
  readonly confidence: number;
  readonly suggestedAction: string;
};
