CREATE TABLE `rewardAttempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tier` enum('level1','level2') NOT NULL,
	`token` varchar(96) NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `rewardAttempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `rewardAttempts_token_unique` UNIQUE(`token`)
);
