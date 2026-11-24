-- Local identity directory, Organization tenant boundary, catalog seed data, and connection backfill.
CREATE TABLE `app_user` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `subjectId` VARCHAR(191) NOT NULL,
  `displayName` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `avatarUrl` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `app_user_subjectId_key`(`subjectId`),
  UNIQUE INDEX `app_user_email_key`(`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `organization_status` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `isFinal` BOOLEAN NOT NULL DEFAULT false,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `organization_status_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `organization_role_catalog` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `organization_role_catalog_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `organization_membership_status` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `organization_membership_status_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `organization` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `displayName` VARCHAR(120) NOT NULL,
  `slug` VARCHAR(63) NOT NULL,
  `logoUrl` VARCHAR(191) NULL,
  `timezone` VARCHAR(64) NOT NULL,
  `baseCurrency` VARCHAR(3) NOT NULL,
  `legalName` VARCHAR(191) NULL,
  `taxId` VARCHAR(191) NULL,
  `countryCode` VARCHAR(2) NULL,
  `legalAddress` TEXT NULL,
  `statusId` INTEGER NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `createIdempotencyKey` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `organization_slug_key`(`slug`),
  UNIQUE INDEX `organization_createIdempotencyKey_key`(`createIdempotencyKey`),
  INDEX `organization_statusId_idx`(`statusId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `organization_member` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `organizationId` INTEGER NOT NULL,
  `userId` INTEGER NOT NULL,
  `roleId` INTEGER NOT NULL,
  `membershipStatusId` INTEGER NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `organization_member_organizationId_userId_key`(`organizationId`, `userId`),
  INDEX `organization_member_userId_idx`(`userId`),
  INDEX `organization_member_roleId_idx`(`roleId`),
  INDEX `organization_member_membershipStatusId_idx`(`membershipStatusId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `organization_context_preference` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `organizationId` INTEGER NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `organization_context_preference_userId_key`(`userId`),
  INDEX `organization_context_preference_organizationId_idx`(`organizationId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `organization_slug_history` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `organizationId` INTEGER NOT NULL,
  `slug` VARCHAR(63) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `organization_slug_history_slug_key`(`slug`),
  INDEX `organization_slug_history_organizationId_idx`(`organizationId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `organization_audit_log` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `organizationId` INTEGER NOT NULL,
  `actorUserId` INTEGER NULL,
  `action` VARCHAR(100) NOT NULL,
  `targetType` VARCHAR(100) NOT NULL,
  `targetId` VARCHAR(191) NULL,
  `beforeSnapshot` JSON NULL,
  `afterSnapshot` JSON NULL,
  `correlationId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `organization_audit_log_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
  INDEX `organization_audit_log_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `organization_status` (`code`, `name`, `isFinal`, `sortOrder`) VALUES
  ('active', 'Active', false, 10), ('suspended', 'Suspended', false, 20),
  ('archived', 'Archived', false, 30), ('pending_deletion', 'Pending deletion', false, 40),
  ('deleted', 'Deleted', true, 50);
INSERT INTO `organization_role_catalog` (`code`, `name`, `sortOrder`) VALUES
  ('owner', 'Owner', 10), ('admin', 'Admin', 20), ('operations_manager', 'Operations manager', 30),
  ('integration_operator', 'Integration operator', 40), ('data_steward', 'Data steward', 50), ('viewer', 'Viewer', 60);
INSERT INTO `organization_membership_status` (`code`, `name`, `sortOrder`) VALUES
  ('invited', 'Invited', 10), ('active', 'Active', 20), ('removed', 'Removed', 30);
INSERT INTO `app_user` (`subjectId`, `displayName`, `email`) VALUES
  ('mock-owner-001', 'Nguyen Minh Anh', 'minh.anh@example.test'),
  ('mock-admin-002', 'Tran Gia Bao', 'gia.bao@example.test'),
  ('mock-operator-003', 'Le Thu Ha', 'thu.ha@example.test'),
  ('mock-viewer-004', 'Pham Quoc Huy', 'quoc.huy@example.test');
INSERT INTO `organization` (`displayName`, `slug`, `timezone`, `baseCurrency`, `statusId`)
  SELECT 'OmniCart Demo', 'omnicart-demo', 'Asia/Ho_Chi_Minh', 'VND', `id` FROM `organization_status` WHERE `code` = 'active';
INSERT INTO `organization_member` (`organizationId`, `userId`, `roleId`, `membershipStatusId`)
  SELECT o.`id`, u.`id`, r.`id`, s.`id` FROM `organization` o
  JOIN `app_user` u ON u.`subjectId` = 'mock-owner-001'
  JOIN `organization_role_catalog` r ON r.`code` = 'owner'
  JOIN `organization_membership_status` s ON s.`code` = 'active'
  WHERE o.`slug` = 'omnicart-demo';
INSERT INTO `organization_context_preference` (`userId`, `organizationId`)
  SELECT u.`id`, o.`id` FROM `app_user` u JOIN `organization` o ON o.`slug` = 'omnicart-demo'
  WHERE u.`subjectId` = 'mock-owner-001';

ALTER TABLE `platform_connection` ADD COLUMN `organizationId` INTEGER NULL;
UPDATE `platform_connection` SET `organizationId` = (SELECT `id` FROM `organization` WHERE `slug` = 'omnicart-demo') WHERE `organizationId` IS NULL;
ALTER TABLE `platform_connection` MODIFY `organizationId` INTEGER NOT NULL;
-- Keep an index whose first column is the existing platformId foreign-key column.
CREATE INDEX `platform_connection_platformId_idx` ON `platform_connection`(`platformId`);
ALTER TABLE `platform_connection` DROP INDEX `platform_connection_platformId_key`;
CREATE UNIQUE INDEX `platform_connection_organizationId_platformId_key` ON `platform_connection`(`organizationId`, `platformId`);
CREATE INDEX `platform_connection_organizationId_idx` ON `platform_connection`(`organizationId`);

ALTER TABLE `organization` ADD CONSTRAINT `organization_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `organization_status`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `platform_connection` ADD CONSTRAINT `platform_connection_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `organization_member` ADD CONSTRAINT `organization_member_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `organization_member` ADD CONSTRAINT `organization_member_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `app_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `organization_member` ADD CONSTRAINT `organization_member_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `organization_role_catalog`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `organization_member` ADD CONSTRAINT `organization_member_membershipStatusId_fkey` FOREIGN KEY (`membershipStatusId`) REFERENCES `organization_membership_status`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `organization_context_preference` ADD CONSTRAINT `organization_context_preference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `app_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `organization_context_preference` ADD CONSTRAINT `organization_context_preference_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `organization_slug_history` ADD CONSTRAINT `organization_slug_history_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `organization_audit_log` ADD CONSTRAINT `organization_audit_log_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `organization_audit_log` ADD CONSTRAINT `organization_audit_log_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `app_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
