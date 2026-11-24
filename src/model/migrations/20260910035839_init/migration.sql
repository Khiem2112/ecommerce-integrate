-- CreateTable
CREATE TABLE `platform_catalog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `platform_catalog_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_connection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `platformId` INTEGER NOT NULL,
    `externalShopId` VARCHAR(191) NULL,
    `shopName` VARCHAR(191) NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `platform_connection_platformId_key`(`platformId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vip_tier_catalog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `minScore` DOUBLE NOT NULL DEFAULT 0,
    `maxScore` DOUBLE NOT NULL DEFAULT 100,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `vip_tier_catalog_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `category_catalog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `parentId` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `category_catalog_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `intent_catalog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `intent_catalog_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agent_catalog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `promptTemplate` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `agent_catalog_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experiment_arm_catalog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `experiment_arm_catalog_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `retention_strategy_catalog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `strategyType` VARCHAR(191) NOT NULL,
    `tone` VARCHAR(191) NOT NULL,
    `retentionFocus` TEXT NOT NULL,
    `selectionGuidance` TEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `retention_strategy_catalog_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_status` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isFinal` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `order_status_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation_status` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isFinal` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `conversation_status_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `escalation_status` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `escalation_status_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sender_type` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isHuman` BOOLEAN NOT NULL DEFAULT true,
    `isAgent` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sender_type_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `connectionId` INTEGER NOT NULL,
    `platformId` INTEGER NOT NULL,
    `platformBuyerId` VARCHAR(191) NOT NULL,
    `vipTierId` INTEGER NOT NULL,
    `vipScore` DOUBLE NOT NULL DEFAULT 0,
    `totalSpend` DOUBLE NOT NULL DEFAULT 0,
    `orderCount` INTEGER NOT NULL DEFAULT 0,
    `avgOrderValue` DOUBLE NOT NULL DEFAULT 0,
    `daysSinceLastOrder` INTEGER NULL,
    `cancellationRate` DOUBLE NOT NULL DEFAULT 0,
    `refundRate` DOUBLE NOT NULL DEFAULT 0,
    `repeatPurchaseInterval` DOUBLE NULL,
    `preferredLanguage` VARCHAR(191) NULL,
    `frequentCategories` JSON NULL,
    `voucherSensitivity` DOUBLE NOT NULL DEFAULT 0,
    `consentStatus` VARCHAR(191) NOT NULL DEFAULT 'granted',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `customer_platformId_idx`(`platformId`),
    UNIQUE INDEX `customer_connectionId_platformBuyerId_key`(`connectionId`, `platformBuyerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_evidence` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customerId` INTEGER NOT NULL,
    `fact` TEXT NOT NULL,
    `evidence` TEXT NOT NULL,
    `confidence` DOUBLE NOT NULL,
    `lastObserved` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `connectionId` INTEGER NOT NULL,
    `platformId` INTEGER NOT NULL,
    `platformOrderId` VARCHAR(191) NOT NULL,
    `customerId` INTEGER NOT NULL,
    `currentStatusId` INTEGER NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `fulfilledAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `totalValue` DOUBLE NOT NULL,
    `discountAmount` DOUBLE NOT NULL DEFAULT 0,
    `shippingFee` DOUBLE NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'VND',
    `cancelReturnInitiator` VARCHAR(191) NULL,
    `cancellationReason` TEXT NULL,

    INDEX `order_platformId_idx`(`platformId`),
    UNIQUE INDEX `order_connectionId_platformOrderId_key`(`connectionId`, `platformOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_status_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `statusId` INTEGER NOT NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `changedBy` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `externalItemId` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NULL,
    `productName` VARCHAR(191) NOT NULL,
    `categoryId` INTEGER NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DOUBLE NOT NULL,
    `discount` DOUBLE NOT NULL DEFAULT 0,
    `refundAmount` DOUBLE NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `order_item_orderId_externalItemId_key`(`orderId`, `externalItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `platformId` INTEGER NOT NULL,
    `platformSessionId` VARCHAR(191) NULL,
    `customerId` INTEGER NOT NULL,
    `orderId` INTEGER NULL,
    `intentId` INTEGER NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'normal',
    `assignedAgentId` INTEGER NULL,
    `humanApprovalRequired` BOOLEAN NOT NULL DEFAULT false,
    `statusId` INTEGER NOT NULL,
    `escalationStatusId` INTEGER NULL,
    `experimentArmId` INTEGER NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conversationId` INTEGER NOT NULL,
    `platformMessageId` VARCHAR(191) NULL,
    `senderTypeId` INTEGER NOT NULL,
    `messageType` ENUM('TEXT', 'IMAGE', 'ITEM', 'ORDER', 'VOUCHER', 'VIDEO', 'EMOJI', 'SYSTEM') NOT NULL DEFAULT 'TEXT',
    `text` TEXT NULL,
    `mediaUrl` VARCHAR(191) NULL,
    `referenceId` VARCHAR(191) NULL,
    `groundedFacts` JSON NULL,
    `ungroundedClaims` JSON NULL,
    `confidence` DOUBLE NULL,
    `suggestedAction` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `responseLatencyMs` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `message_conversationId_senderTypeId_timestamp_id_idx`(`conversationId`, `senderTypeId`, `timestamp`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_draft_response` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conversationId` INTEGER NOT NULL,
    `triggerMessageId` INTEGER NULL,
    `appliedMessageId` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `rejectionReason` VARCHAR(191) NULL,
    `recommendedStrategyCode` VARCHAR(191) NOT NULL,
    `selectedStrategyCode` VARCHAR(191) NULL,
    `customDraftText` TEXT NULL,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectedById` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `recommendationReason` TEXT NULL,
    `recommendationGroundedFacts` JSON NULL,
    `providerUsed` VARCHAR(191) NULL,
    `groundingIsValid` BOOLEAN NOT NULL DEFAULT true,
    `groundingPrecision` DOUBLE NOT NULL DEFAULT 1.0,
    `groundingViolations` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_draft_response_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    INDEX `ai_draft_response_conversationId_status_idx`(`conversationId`, `status`),
    INDEX `ai_draft_response_conversationId_triggerMessageId_createdAt_idx`(`conversationId`, `triggerMessageId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_draft_strategy` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `draftResponseId` INTEGER NOT NULL,
    `strategyCode` VARCHAR(191) NOT NULL,
    `rank` INTEGER NOT NULL,
    `draftText` TEXT NOT NULL,
    `confidence` DOUBLE NOT NULL,
    `suggestedAction` VARCHAR(191) NOT NULL,
    `groundedFactsUsed` JSON NOT NULL,
    `ungroundedClaims` JSON NOT NULL,
    `proposedCompensation` JSON NULL,
    `isBestMatch` BOOLEAN NOT NULL DEFAULT false,
    `groundingIsValid` BOOLEAN NOT NULL DEFAULT true,
    `groundingPrecision` DOUBLE NOT NULL DEFAULT 1.0,
    `groundingViolations` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_draft_strategy_draftResponseId_idx`(`draftResponseId`),
    UNIQUE INDEX `ai_draft_strategy_draftResponseId_strategyCode_key`(`draftResponseId`, `strategyCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `routing_decision` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conversationId` INTEGER NOT NULL,
    `detectedIntent` VARCHAR(191) NOT NULL,
    `assignedAgent` VARCHAR(191) NOT NULL,
    `priority` VARCHAR(191) NOT NULL,
    `customerValue` VARCHAR(191) NOT NULL,
    `humanApproval` BOOLEAN NOT NULL,
    `reasons` JSON NULL,
    `wasOverridden` BOOLEAN NOT NULL DEFAULT false,
    `overrideReason` TEXT NULL,
    `decidedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_batch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `batchCode` VARCHAR(191) NOT NULL,
    `connectionId` INTEGER NOT NULL,
    `platformId` INTEGER NOT NULL,
    `operationType` VARCHAR(191) NOT NULL DEFAULT 'apply',
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `scope` JSON NULL,
    `totalOrders` INTEGER NOT NULL DEFAULT 0,
    `createdCount` INTEGER NOT NULL DEFAULT 0,
    `updatedCount` INTEGER NOT NULL DEFAULT 0,
    `unchangedCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `durationMs` INTEGER NULL,
    `sourcePreviewBatchId` INTEGER NULL,
    `errorMessage` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sync_batch_batchCode_key`(`batchCode`),
    INDEX `sync_batch_connectionId_createdAt_idx`(`connectionId`, `createdAt`),
    INDEX `sync_batch_platformId_createdAt_idx`(`platformId`, `createdAt`),
    INDEX `sync_batch_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_operation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `batchId` INTEGER NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `parentEntityType` VARCHAR(191) NULL,
    `parentEntityId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `totalCount` INTEGER NOT NULL DEFAULT 0,
    `processedCount` INTEGER NOT NULL DEFAULT 0,
    `successCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `errorMessage` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sync_operation_batchId_entityType_idx`(`batchId`, `entityType`),
    INDEX `sync_operation_batchId_parentEntityType_parentEntityId_idx`(`batchId`, `parentEntityType`, `parentEntityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_run_error` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `batchId` INTEGER NOT NULL,
    `operationId` INTEGER NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NULL,
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` TEXT NOT NULL,
    `errorDetails` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sync_run_error_batchId_idx`(`batchId`),
    INDEX `sync_run_error_operationId_idx`(`operationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_change` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `operationId` INTEGER NOT NULL,
    `changeType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `internalId` INTEGER NULL,
    `changes` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sync_change_operationId_idx`(`operationId`),
    INDEX `sync_change_entityId_idx`(`entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `platform_connection` ADD CONSTRAINT `platform_connection_platformId_fkey` FOREIGN KEY (`platformId`) REFERENCES `platform_catalog`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `category_catalog` ADD CONSTRAINT `category_catalog_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `category_catalog`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer` ADD CONSTRAINT `customer_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `platform_connection`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer` ADD CONSTRAINT `customer_platformId_fkey` FOREIGN KEY (`platformId`) REFERENCES `platform_catalog`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer` ADD CONSTRAINT `customer_vipTierId_fkey` FOREIGN KEY (`vipTierId`) REFERENCES `vip_tier_catalog`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_evidence` ADD CONSTRAINT `customer_evidence_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `order_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `platform_connection`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `order_platformId_fkey` FOREIGN KEY (`platformId`) REFERENCES `platform_catalog`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `order_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `order_currentStatusId_fkey` FOREIGN KEY (`currentStatusId`) REFERENCES `order_status`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `order_status`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item` ADD CONSTRAINT `order_item_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item` ADD CONSTRAINT `order_item_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `category_catalog`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation` ADD CONSTRAINT `conversation_platformId_fkey` FOREIGN KEY (`platformId`) REFERENCES `platform_catalog`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation` ADD CONSTRAINT `conversation_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation` ADD CONSTRAINT `conversation_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation` ADD CONSTRAINT `conversation_intentId_fkey` FOREIGN KEY (`intentId`) REFERENCES `intent_catalog`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation` ADD CONSTRAINT `conversation_assignedAgentId_fkey` FOREIGN KEY (`assignedAgentId`) REFERENCES `agent_catalog`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation` ADD CONSTRAINT `conversation_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `conversation_status`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation` ADD CONSTRAINT `conversation_escalationStatusId_fkey` FOREIGN KEY (`escalationStatusId`) REFERENCES `escalation_status`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation` ADD CONSTRAINT `conversation_experimentArmId_fkey` FOREIGN KEY (`experimentArmId`) REFERENCES `experiment_arm_catalog`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message` ADD CONSTRAINT `message_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `conversation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message` ADD CONSTRAINT `message_senderTypeId_fkey` FOREIGN KEY (`senderTypeId`) REFERENCES `sender_type`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_draft_response` ADD CONSTRAINT `ai_draft_response_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `conversation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_draft_response` ADD CONSTRAINT `ai_draft_response_triggerMessageId_fkey` FOREIGN KEY (`triggerMessageId`) REFERENCES `message`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_draft_response` ADD CONSTRAINT `ai_draft_response_appliedMessageId_fkey` FOREIGN KEY (`appliedMessageId`) REFERENCES `message`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_draft_strategy` ADD CONSTRAINT `ai_draft_strategy_draftResponseId_fkey` FOREIGN KEY (`draftResponseId`) REFERENCES `ai_draft_response`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routing_decision` ADD CONSTRAINT `routing_decision_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `conversation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_batch` ADD CONSTRAINT `sync_batch_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `platform_connection`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_batch` ADD CONSTRAINT `sync_batch_platformId_fkey` FOREIGN KEY (`platformId`) REFERENCES `platform_catalog`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_batch` ADD CONSTRAINT `sync_batch_sourcePreviewBatchId_fkey` FOREIGN KEY (`sourcePreviewBatchId`) REFERENCES `sync_batch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_operation` ADD CONSTRAINT `sync_operation_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `sync_batch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_run_error` ADD CONSTRAINT `sync_run_error_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `sync_batch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_run_error` ADD CONSTRAINT `sync_run_error_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `sync_operation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_change` ADD CONSTRAINT `sync_change_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `sync_operation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
