CREATE TABLE `coinTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`source` varchar(64) NOT NULL,
	`claimKey` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coinTransactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `coinTransactions_user_claim_key` UNIQUE(`userId`,`claimKey`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `coinBalance` int DEFAULT 0 NOT NULL;