-- Associate washing work with the dining session that generated it so tables
-- can become available only after their own cleanup is complete.
ALTER TABLE `WashingTask` ADD COLUMN `sessionId` VARCHAR(191) NULL;

CREATE INDEX `WashingTask_sessionId_status_idx` ON `WashingTask`(`sessionId`, `status`);

ALTER TABLE `WashingTask`
ADD CONSTRAINT `WashingTask_sessionId_fkey`
FOREIGN KEY (`sessionId`) REFERENCES `DiningSession`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;
