/*
  Warnings:

  - You are about to drop the column `platformId` on the `conversation` table. All the data in the column will be lost.
  - You are about to drop the column `platformId` on the `customer` table. All the data in the column will be lost.
  - You are about to drop the column `platformId` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `platformId` on the `sync_batch` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `conversation` DROP FOREIGN KEY `conversation_platformId_fkey`;

-- DropForeignKey
ALTER TABLE `customer` DROP FOREIGN KEY `customer_platformId_fkey`;

-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `order_platformId_fkey`;

-- DropForeignKey
ALTER TABLE `sync_batch` DROP FOREIGN KEY `sync_batch_platformId_fkey`;

-- DropIndex
DROP INDEX `conversation_platformId_fkey` ON `conversation`;

-- DropIndex
DROP INDEX `customer_platformId_idx` ON `customer`;

-- DropIndex
DROP INDEX `order_platformId_idx` ON `order`;

-- DropIndex
DROP INDEX `sync_batch_platformId_createdAt_idx` ON `sync_batch`;

-- AlterTable: add connectionId with temporary default, back-fill from platformId, then make strict
ALTER TABLE `conversation`
    ADD COLUMN `connectionId` INTEGER NOT NULL DEFAULT 0;

-- Back-fill: conversation.platformId was a direct FK to platform_connection.id
UPDATE `conversation` c
    JOIN `platform_connection` pc ON pc.`id` = c.`platformId`
    SET c.`connectionId` = pc.`id`;

-- Remove the temporary default so the column behaves as NOT NULL without default
ALTER TABLE `conversation`
    ALTER COLUMN `connectionId` DROP DEFAULT,
    DROP COLUMN `platformId`;

-- AlterTable
ALTER TABLE `customer` DROP COLUMN `platformId`;

-- AlterTable
ALTER TABLE `order` DROP COLUMN `platformId`;

-- AlterTable
ALTER TABLE `sync_batch` DROP COLUMN `platformId`;

-- CreateIndex
CREATE INDEX `conversation_connectionId_idx` ON `conversation`(`connectionId`);

-- CreateIndex
CREATE INDEX `customer_connectionId_idx` ON `customer`(`connectionId`);

-- CreateIndex
CREATE INDEX `order_connectionId_idx` ON `order`(`connectionId`);

-- AddForeignKey
ALTER TABLE `conversation` ADD CONSTRAINT `conversation_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `platform_connection`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
