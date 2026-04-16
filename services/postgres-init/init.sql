CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT
);

CREATE TABLE IF NOT EXISTS flags (
    id SERIAL PRIMARY KEY,
    flag TEXT NOT NULL
);

INSERT INTO users (username, email) VALUES
    ('alice', 'alice@corp.com'),
    ('bob', 'bob@corp.com'),
    ('admin', 'admin@corp.com');

INSERT INTO flags (flag) VALUES ('FLAG{w34k_p0stgr3s_cr3ds}');