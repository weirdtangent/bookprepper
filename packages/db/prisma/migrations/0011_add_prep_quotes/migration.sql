-- CreateTable
CREATE TABLE `PrepQuote` (
    `id` VARCHAR(191) NOT NULL,
    `prepId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `text` VARCHAR(2000) NOT NULL,
    `pageNumber` VARCHAR(20) NULL,
    `chapter` VARCHAR(100) NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `verifiedSource` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX `PrepQuote_prepId_idx`(`prepId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `PrepQuote_prepId_fkey` FOREIGN KEY (`prepId`) REFERENCES `BookPrep`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `PrepQuote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `UserProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuoteVote` (
    `id` VARCHAR(191) NOT NULL,
    `quoteId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `value` ENUM('AGREE','DISAGREE') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `QuoteVote_quoteId_userId_key`(`quoteId`, `userId`),
    INDEX `QuoteVote_quoteId_idx`(`quoteId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `QuoteVote_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `PrepQuote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `QuoteVote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `UserProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
