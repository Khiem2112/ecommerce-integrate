-- Migration: Add Shop Connection Management, Authorization Attempts, and Audit Log
-- Also refactors app_user with isAdmin column

-- 1. Alter app_user to add isAdmin
ALTER TABLE `app_user` ADD COLUMN `isAdmin` BOOLEAN NOT NULL DEFAULT false;

-- 2. Alter platform_connection with lifecycle fields
ALTER TABLE `platform_connection`
  ADD COLUMN `displayLabel` VARCHAR(191) NULL,
  ADD COLUMN `status` ENUM('connected', 'reconnect_required', 'disconnecting', 'reassigning', 'disconnected') NOT NULL DEFAULT 'reconnect_required',
  ADD COLUMN `integrations` JSON NULL,
  ADD COLUMN `lastVerifiedAt` DATETIME(3) NULL,
  ADD COLUMN `lastFailureCode` VARCHAR(100) NULL,
  ADD COLUMN `disconnectedAt` DATETIME(3) NULL,
  ADD COLUMN `version` INT NOT NULL DEFAULT 1;

CREATE INDEX `platform_connection_status_idx` ON `platform_connection`(`status`);

-- 3. Backfill existing records: set displayLabel = shopName, status = 'reconnect_required', version = 1
UPDATE `platform_connection`
SET `displayLabel` = `shopName`,
    `status` = 'reconnect_required',
    `version` = 1
WHERE `isActive` = true;

-- 4. Create platform_authorization_attempt table
CREATE TABLE `platform_authorization_attempt` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `organizationId` INTEGER NOT NULL,
  `platformId` INTEGER NOT NULL,
  `connectionId` INTEGER NULL,
  `actorUserId` INTEGER NOT NULL,
  `status` ENUM('authorizing', 'validating', 'failed', 'cancelled', 'completed') NOT NULL DEFAULT 'authorizing',
  `idempotencyKey` VARCHAR(191) NULL,
  `stateNonceHash` VARCHAR(255) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `redirectUri` TEXT NULL,
  `failureCode` VARCHAR(100) NULL,
  `failureReason` TEXT NULL,
  `completedAt` DATETIME(3) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `platform_authorization_attempt_idempotencyKey_key`(`idempotencyKey`),
  INDEX `platform_authorization_attempt_organizationId_idx`(`organizationId`),
  INDEX `platform_authorization_attempt_platformId_idx`(`platformId`),
  INDEX `platform_authorization_attempt_connectionId_idx`(`connectionId`),
  INDEX `platform_authorization_attempt_actorUserId_idx`(`actorUserId`),
  INDEX `platform_authorization_attempt_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `platform_authorization_attempt_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `platform_authorization_attempt_platformId_fkey` FOREIGN KEY (`platformId`) REFERENCES `platform_catalog`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `platform_authorization_attempt_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `platform_connection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `platform_authorization_attempt_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `app_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. Create platform_connection_audit_log table (append-only)
CREATE TABLE `platform_connection_audit_log` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `connectionId` INTEGER NULL,
  `authorizationAttemptId` INTEGER NULL,
  `actorUserId` INTEGER NULL,
  `organizationIdBefore` INTEGER NULL,
  `organizationIdAfter` INTEGER NULL,
  `action` VARCHAR(100) NOT NULL,
  `fromStatus` ENUM('connected', 'reconnect_required', 'disconnecting', 'reassigning', 'disconnected') NULL,
  `toStatus` ENUM('connected', 'reconnect_required', 'disconnecting', 'reassigning', 'disconnected') NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `platform_connection_audit_log_connectionId_createdAt_idx`(`connectionId`, `createdAt`),
  INDEX `platform_connection_audit_log_authorizationAttemptId_createdAt_idx`(`authorizationAttemptId`, `createdAt`),
  INDEX `platform_connection_audit_log_actorUserId_idx`(`actorUserId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `platform_connection_audit_log_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `platform_connection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `platform_connection_audit_log_authorizationAttemptId_fkey` FOREIGN KEY (`authorizationAttemptId`) REFERENCES `platform_authorization_attempt`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `platform_connection_audit_log_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `app_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
