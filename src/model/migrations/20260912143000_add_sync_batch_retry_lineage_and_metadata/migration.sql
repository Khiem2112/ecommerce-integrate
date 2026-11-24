-- AlterTable
ALTER TABLE `sync_batch`
  ADD COLUMN `syncMode` VARCHAR(191) NOT NULL DEFAULT 'incremental',
  ADD COLUMN `parentBatchId` INTEGER NULL,
  ADD COLUMN `triggeredBy` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `sync_batch_parentBatchId_idx` ON `sync_batch`(`parentBatchId`);
CREATE INDEX `sync_batch_startedAt_idx` ON `sync_batch`(`startedAt`);

-- AddForeignKey
ALTER TABLE `sync_batch`
  ADD CONSTRAINT `sync_batch_parentBatchId_fkey`
  FOREIGN KEY (`parentBatchId`) REFERENCES `sync_batch`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
