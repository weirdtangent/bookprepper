-- AlterTable
ALTER TABLE `PrepKeyword`
    ADD COLUMN `status` ENUM('CANONICAL','PENDING','ALIAS') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `aliasOfId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `PrepKeyword_status_idx` ON `PrepKeyword`(`status`);

-- CreateIndex
CREATE INDEX `PrepKeyword_aliasOfId_idx` ON `PrepKeyword`(`aliasOfId`);

-- AddForeignKey
ALTER TABLE `PrepKeyword` ADD CONSTRAINT `PrepKeyword_aliasOfId_fkey`
    FOREIGN KEY (`aliasOfId`) REFERENCES `PrepKeyword`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the existing vocabulary rather than defaulting every row to PENDING, which
-- would empty the library filter on deploy.
--
-- Provenance is what status means, and the table records it exactly: the seeded
-- vocabulary carries a curated description, while free text created by
-- upsertKeywords() during prep authoring never sets one. On the production
-- catalog this splits 77 keywords into the 40 that were designed and the 37 that
-- drifted in, with no overlap in either direction.
--
-- Designed-but-unused keywords stay CANONICAL on purpose: they filter to nothing
-- today, so the facets endpoint withholds them, and they surface on their own once
-- a prep finally uses one.
UPDATE `PrepKeyword`
SET `status` = 'CANONICAL'
WHERE `description` IS NOT NULL AND `description` <> '';
