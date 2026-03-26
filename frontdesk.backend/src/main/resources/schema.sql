CREATE TABLE IF NOT EXISTS `User` (
    `username` VARCHAR(100) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `Location` VARCHAR(255) NULL,
    `role` VARCHAR(100) NOT NULL,
    PRIMARY KEY (`username`)
);

