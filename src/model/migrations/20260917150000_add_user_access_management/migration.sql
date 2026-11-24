-- Expand: Add organization-scoped profile fields and version to organization_member
ALTER TABLE `organization_member`
  ADD COLUMN `displayName` VARCHAR(120) NULL,
  ADD COLUMN `contactEmail` VARCHAR(254) NULL,
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;

-- Backfill: populate displayName from global app_user identity
UPDATE `organization_member` om
JOIN `app_user` u ON om.`userId` = u.`id`
SET om.`displayName` = u.`displayName`
WHERE om.`displayName` IS NULL;

-- Fallback for any records where app_user was missing displayName
UPDATE `organization_member`
SET `displayName` = 'Member'
WHERE `displayName` IS NULL;

-- Contract: enforce required displayName
ALTER TABLE `organization_member`
  MODIFY COLUMN `displayName` VARCHAR(120) NOT NULL;

-- Add directory query indexes
CREATE INDEX `organization_member_organizationId_membershipStatusId_roleId_idx`
  ON `organization_member`(`organizationId`, `membershipStatusId`, `roleId`);

CREATE INDEX `organization_member_organizationId_displayName_idx`
  ON `organization_member`(`organizationId`, `displayName`);

-- Add idempotency correlation uniqueness on organization_audit_log
CREATE UNIQUE INDEX `organization_audit_log_organizationId_correlationId_key`
  ON `organization_audit_log`(`organizationId`, `correlationId`);
