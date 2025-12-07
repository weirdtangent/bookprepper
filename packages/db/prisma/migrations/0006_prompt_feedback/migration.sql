CREATE TABLE `PromptFeedback` (
    `id` VARCHAR(191) NOT NULL,
    `prepId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `dimension` ENUM('CORRECT','FUN','USEFUL','SURPRISING') NOT NULL,
    `value` ENUM('AGREE','DISAGREE') NOT NULL,
    `note` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `PromptFeedback_prepId_userId_dimension_key`(`prepId`, `userId`, `dimension`),
    INDEX `PromptFeedback_userId_idx`(`userId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `PromptFeedback_prepId_fkey` FOREIGN KEY (`prepId`) REFERENCES `BookPrep`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `PromptFeedback_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `UserProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PromptScore` (
    `prepId` VARCHAR(191) NOT NULL,
    `agreeCount` INTEGER NOT NULL DEFAULT 0,
    `disagreeCount` INTEGER NOT NULL DEFAULT 0,
    `totalCount` INTEGER NOT NULL DEFAULT 0,
    `score` DOUBLE NOT NULL DEFAULT 0,
    `dimensionTallies` JSON NULL,
    `lastFeedbackAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`prepId`),
    CONSTRAINT `PromptScore_prepId_fkey` FOREIGN KEY (`prepId`) REFERENCES `BookPrep`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `PromptFeedback` (`id`, `prepId`, `userId`, `dimension`, `value`, `note`, `createdAt`, `updatedAt`)
SELECT UUID(), `prepId`, `userId`, 'CORRECT', `value`, NULL, `createdAt`, `createdAt`
FROM `PrepVote`;

INSERT INTO `PromptScore` (`prepId`, `agreeCount`, `disagreeCount`, `totalCount`, `score`, `dimensionTallies`, `lastFeedbackAt`, `createdAt`, `updatedAt`)
SELECT
    pf.`prepId`,
    SUM(CASE WHEN pf.`value` = 'AGREE' THEN 1 ELSE 0 END) AS agreeCount,
    SUM(CASE WHEN pf.`value` = 'DISAGREE' THEN 1 ELSE 0 END) AS disagreeCount,
    COUNT(*) AS totalCount,
    CASE
        WHEN COUNT(*) = 0 THEN 0
        ELSE (SUM(CASE WHEN pf.`value` = 'AGREE' THEN 1 ELSE 0 END) - SUM(CASE WHEN pf.`value` = 'DISAGREE' THEN 1 ELSE 0 END)) / COUNT(*)
    END AS score,
    JSON_OBJECT(
        'CORRECT',
        JSON_OBJECT(
            'agree', SUM(CASE WHEN pf.`value` = 'AGREE' THEN 1 ELSE 0 END),
            'disagree', SUM(CASE WHEN pf.`value` = 'DISAGREE' THEN 1 ELSE 0 END),
            'total', COUNT(*)
        )
    ) AS dimensionTallies,
    MAX(pf.`createdAt`) AS lastFeedbackAt,
    NOW(),
    NOW()
FROM `PromptFeedback` pf
GROUP BY pf.`prepId`;
