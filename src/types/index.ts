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
  Organization,
  OrganizationStatus,
  OrganizationRoleCatalog,
  OrganizationMembershipStatus,
  OrganizationContextPreference,
  OrganizationAuditLog,
} from '@prisma/client';


export type {
  ComputedSessionState,
  UserSessionProjection,
  SessionProjection,
  ActiveSessionContext,
  LoginResult,
  RateLimitStatus,
  RequestMetadata,
} from './authentication';

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
  ChannelConnector,
} from './connector';

export type {
  LazadaOrderStatus,
  LazadaAddressDTO,
  LazadaOrderItemDTO,
  LazadaOrderItemsBatchItem,
  LazadaOrdersItemsGetResponse,
  LazadaOrderDTO,
  LazadaApiResponse,
  LazadaOrdersGetResponse,
  SeedKey,
  SeedProfile,
} from './lazada';

// Synchronization, Prisma Models & Audit History types
export type {
  SyncBatch,
  SyncOperation,
  SyncRunError,
  SyncChange,
  SyncBatchWithRelations,
  SyncBatchWithOperations,
  SyncOperationWithRelations,
  SyncChangeModel,
  SyncRunErrorModel,
  SyncRecordError,
  SyncResult,
  SyncRunLog,
  PreflightSyncResult,
  SyncBatchProgress,
  SyncedOrderFeedItem,
  SyncChangeType,
  SyncChangeEntityType,
  FieldDiff,
  SyncChangeRecord,
  SyncOrderChangeGroup,
  SyncChangeSummary,
  SyncChangeQueryParams,
  PendingSyncChange,
  OrderPreviewStatus,
  OrderPreviewRow,
  OrderPreviewPage,
  OrderPreviewItemRow,
  SyncBatchStatus,
  SyncMode,
  SyncBatchListItem,
  SyncBatchListFilter,
  SyncBatchListResponse,
  SyncOrderChangeType,
  SyncErrorCategory,
  SyncOrderListItem,
  SyncBatchDetail,
  SyncFieldDiff,
  SyncItemDiffGroup,
  SyncOrderDiff,
  SyncBatchDetailProgress,
} from './sync';

export {
  ORGANIZATION_STATUS_CODES,
  ORGANIZATION_ROLE_CODES,
} from './organization';

export type {
  OrganizationStatusCode,
  OrganizationRoleCode,
  OrganizationSummaryPayload,
  OrganizationDetailPayload,
  OrganizationFilters,
  OrganizationSummary,
  OrganizationMember,
  OrganizationConnection,
  OrganizationDetail,
  OrganizationListResult,
  ActiveOrganizationContext,
  MockUserOption,
} from './organization';
