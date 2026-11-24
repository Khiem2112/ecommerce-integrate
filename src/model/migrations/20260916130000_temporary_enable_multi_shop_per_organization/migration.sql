-- Temporary enable multi shop for one organization.
-- externalShopId remains nullable until FEATURE_ShopManagement owns the authorization flow.
-- MySQL permits multiple NULLs in this unique index; only known external shop IDs are globally exclusive per platform.
ALTER TABLE `platform_connection` DROP INDEX `platform_connection_organizationId_platformId_key`;

CREATE UNIQUE INDEX `platform_connection_platformId_externalShopId_key`
  ON `platform_connection`(`platformId`, `externalShopId`);

CREATE INDEX `platform_connection_organizationId_platformId_idx`
  ON `platform_connection`(`organizationId`, `platformId`);
