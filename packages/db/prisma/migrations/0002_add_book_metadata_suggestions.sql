-- CreateTable
CREATE TABLE `BookMetadataSuggestion` (
    `id` VARCHAR(191) NOT NULL,
    `bookId` VARCHAR(191) NOT NULL,
    `submittedById` VARCHAR(191) NULL,
    `suggestedSynopsis` LONGTEXT NULL,
    `suggestedGenres` JSON NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `moderatorNote` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BookMetadataSuggestion` ADD CONSTRAINT `BookMetadataSuggestion_bookId_fkey` FOREIGN KEY (`bookId`) REFERENCES `Book`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookMetadataSuggestion` ADD CONSTRAINT `BookMetadataSuggestion_submittedById_fkey` FOREIGN KEY (`submittedById`) REFERENCES `UserProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

