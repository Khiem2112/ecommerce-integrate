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
  AiDraftResponse,
  AiDraftStrategy,
} from '@prisma/client';

// Common cross-layer utility types
export type {
  ActionResponse,
  DbClient,
} from './common';

export type {
  CustomerWithRelations,
  CustomerEvidenceRecord,
  CustomerFullDetail,
  CustomerFilterParams,
  CustomerListResponse,
  CustomerLookupOptions,
  CustomerUpdateInput,
} from './customer';

export type {
  OrderWithRelations,
  OrderWithHistory,
  OrderItemWithCategory,
  OrderStatusHistoryWithStatus,
  OrderFilterParams,
  PaginationMeta,
  OrderListResponse,
  OrderLookupOptions,
} from './order';

export type {
  MessageWithSender,
  ConversationWithRelations,
  ConversationWithMessages,
  InboxConversationRecord,
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

// AI Draft Prisma-derived relation types & domain DTOs
export type {
  AiDraftResponseWithRelations,
  AiDraftStrategyRecord,
  AiDraftResponseForHistory,
  AiDraftStatus,
  AiDraftOutdatedReason,
  AiDraftTriggerMessageDto,
  AiDraftStrategyDto,
  AiDraftDetailDto,
  AiDraftSummaryDto,
  CreateAiDraftInput,
  CreateAiDraftStrategyInput,
  ApplyAiDraftInput,
  RejectAiDraftInput,
} from './aiDraft';

// Channel Connector & Integration types
export type {
  PlatformCode,
  ExternalOrderItem,
  ExternalCustomer,
  ExternalOrder,
  ExternalOrderPage,
  FetchOrdersParams,
  ConnectionHealth,
  IntegrationSummary,
  SyncRecordError,
  SyncResult,
  SyncRunLog,
  ChannelConnector,
} from './connector';

export type {
  LazadaOrderStatus,
  LazadaAddressDTO,
  LazadaOrderItemDTO,
  LazadaOrderDTO,
  LazadaApiResponse,
  LazadaOrdersGetResponse,
  SeedKey,
  SeedProfile,
} from './lazada';

