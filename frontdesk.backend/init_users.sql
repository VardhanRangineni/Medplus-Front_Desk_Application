-- Create users table for frontdesk login
CREATE TABLE IF NOT EXISTS users (
    username VARCHAR(100) NOT NULL PRIMARY KEY,
    Location VARCHAR(100),
    password VARCHAR(255) NOT NULL,
    role     VARCHAR(50)  NOT NULL
);

-- Insert admin user  (password = 'admin', BCrypt encoded)
INSERT INTO users (username, password, role)
VALUES (
    'admin',
    '$2a$10$7EqJtq98hPqEX7fNZaFWoO9isVgaCDBstRSGgZCjL7aYKBDFP9pHe',
    'ADMIN'
)
ON DUPLICATE KEY UPDATE
    password = VALUES(password),
    role     = VALUES(role);

-- Verify
SELECT username, role FROM users;
