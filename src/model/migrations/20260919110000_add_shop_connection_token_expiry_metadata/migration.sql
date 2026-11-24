-- Store non-secret token expiry metadata separately from credentials for safe indexed health queries.
ALTER TABLE `platform_connection`
  ADD COLUMN `tokenExpiresAt` DATETIME(3) NULL,
  ADD COLUMN `refreshTokenExpiresAt` DATETIME(3) NULL;

CREATE INDEX `platform_connection_status_tokenExpiresAt_idx`
  ON `platform_connection`(`status`, `tokenExpiresAt`);
