CREATE TABLE "User" (
  id SERIAL PRIMARY KEY,
  username VARCHAR UNIQUE,
  email VARCHAR UNIQUE,
  created_at TIMESTAMP DEFAULT now(),
  password_hash VARCHAR(255) NOT NULL
);
CREATE TABLE Folder (
  folder_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  folder_name VARCHAR(255),
  created TIMESTAMP NOT NULL DEFAULT now()
);
CREATE TABLE Note (
  note_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  folder_id INTEGER REFERENCES Folder(folder_id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  created TIMESTAMP NOT NULL DEFAULT now(),
  updated TIMESTAMP,
  is_pinned BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE Tag (
  tag_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  tag_name VARCHAR
);
CREATE TABLE NoteTag (
  note_id INTEGER NOT NULL REFERENCES Note(note_id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES Tag(tag_id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);
CREATE TABLE Attachment (
  att_id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES Note(note_id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_type VARCHAR(100),
  file_size BIGINT,
  uploaded_at TIMESTAMP DEFAULT now()
);
CREATE TABLE Reminders (
  remind_id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES Note(note_id) ON DELETE CASCADE,
  remind_at TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created TIMESTAMP DEFAULT now()
);
INSERT INTO "User"(username, email, password_hash) VALUES ('demo', 'demo@example.com', 'x');
INSERT INTO Folder(user_id, folder_name) VALUES (1, 'Work'), (1, 'Personal');
INSERT INTO Tag(user_id, tag_name) VALUES (1, 'important'), (1, 'ideas');
