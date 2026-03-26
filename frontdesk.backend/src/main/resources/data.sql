INSERT INTO `User` (`username`, `password`, `Location`, `role`)
SELECT 'admin',
       '$2a$10$A.Tw6CL6bUVo1F3Jiwcsdu4s6eYVzIJPZvZpk/M9cCSNz3LrqYgcq',
       NULL,
       'admin'
WHERE NOT EXISTS (
    SELECT 1 FROM `User` WHERE `username` = 'admin'
);

