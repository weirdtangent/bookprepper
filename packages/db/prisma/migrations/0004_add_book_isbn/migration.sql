-- Add ISBN column for book metadata and uniqueness
ALTER TABLE `Book`
  ADD COLUMN `isbn` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Book_isbn_key` ON `Book`(`isbn`);
