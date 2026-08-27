/**
 * Barrel export for all domain types.
 * Import via: import { CustomerWithRelations, RagResponse, ... } from '@/types';
 */

// Re-export Prisma base model types for convenience
export type {
  Customer,
  CustomerEvidence,
  Order,
  OrderItem,
  OrderStatus,
  OrderStatusHistory,
  Conversation,
  Message,
  RoutingDecision,
  PlatformCatalog,
  VipTierCatalog,
  CategoryCatalog,
  IntentCatalog,
  AgentCatalog,
  ExperimentArmCatalog,
  RetentionStrategyCatalog,
  ConversationStatus,
  EscalationStatus,
  SenderType,
  MessageType,
} from '@prisma/client';

// Prisma-derived relation types
export type {
  CustomerWithRelations,
  CustomerEvidenceRecord,
  CustomerWithDetails,
} from './customer';

export type {
  OrderWithRelations,
  OrderWithHistory,
  OrderItemWithCategory,
  OrderStatusHistoryWithStatus,
} from './order';

export type {
  MessageWithSender,
  ConversationWithRelations,
  ConversationWithMessages,
} from './conversation';

export type {
  InboxFilters,
  WorkspaceMessage,
  ConversationSummary,
  ConversationDetail,
  LinkedOrderContext,
  CustomerContext,
  RagDraft,
  MultiDraftRagDraft,
  SaveAiResponseInput,
} from './workspace';

// RAG-specific composed types
export type {
  TurnContext,
  CustomerDossier,
  EvidenceContext,
  FullCustomerContext,
  SuggestedAction,
  RetentionStrategyCode,
  RetentionStrategy,
  ProposedCompensation,
  RawStrategyDraft,
  RawMultiDraftResponse,
  MultiDraftStrategy,
  MultiDraftResponse,
  RagResponse,
  GroundingViolation,
  GroundingResult,
  StrategyGroundingResult,
  MultiDraftGroundingResult,
  LlmProviderName,
  LlmProviderConfig,
  PromptLogOptions,
} from './rag';
