CREATE TABLE `log_entries` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`pm2Id` int NOT NULL,
	`type` enum('stdout','stderr') NOT NULL,
	`content` text NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `log_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `performance_metrics` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`pm2Id` int NOT NULL,
	`cpu` float NOT NULL,
	`memory` bigint NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `performance_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pm2Id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`groupId` int,
	`script` text,
	`cwd` text,
	`args` json,
	`env` json,
	`instances` int DEFAULT 1,
	`execMode` enum('fork','cluster') DEFAULT 'fork',
	`autorestart` int DEFAULT 1,
	`maxRestarts` int DEFAULT 10,
	`minUptime` int DEFAULT 1000,
	`maxMemoryRestart` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `task_configs_pm2Id_unique` UNIQUE(`pm2Id`)
);
--> statement-breakpoint
CREATE TABLE `task_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`color` varchar(7) DEFAULT '#00ffff',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_groups_id` PRIMARY KEY(`id`)
);
