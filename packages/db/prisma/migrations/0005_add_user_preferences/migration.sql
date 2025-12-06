ALTER TABLE `UserProfile`
ADD COLUMN `preferences` JSON NULL;

UPDATE `UserProfile`
SET `preferences` = JSON_OBJECT()
WHERE `preferences` IS NULL;
