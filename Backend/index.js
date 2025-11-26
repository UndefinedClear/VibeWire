const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 3001;

const db_path = "../databases/spotify.db";

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads/music');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'uploads/music'));
    },
    filename: function (req, file, cb) {
        // Генерируем уникальное имя файла с расширением .mp3
        cb(null, Date.now() + '.mp3');
    }
});


const fileMaxSize = 40 * 1024 * 1024 // 40MB limit


const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: fileMaxSize
    },
    fileFilter: (req, file, cb) => {
        // Accept only audio files (mp3, wav, ogg)
        if (file.mimetype === 'audio/mpeg' || 
            file.mimetype === 'audio/wav' || 
            file.mimetype === 'audio/ogg') {
            cb(null, true);
        } else {
            cb(new Error('Only MP3, WAV and OGG files are allowed!'));
        }
    }
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Error handler for multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File is too large. Maximum size is 40MB.' });
    }
    return res.status(400).json({ success: false, error: err.message });
  }
  next(err);
});

// Раздача загруженных файлов
app.use('/uploads/music', express.static(path.join(__dirname, 'uploads/music')));

// Serve frontend static files with correct MIME types
app.use(express.static(path.join(__dirname, '../frontend')));

// Initialize SQLite DB
const db = new sqlite3.Database(db_path, (err) => {
  if (err) return console.error(err.message);
  console.log('Connected to SQLite database.');
});

// Simple input sanitizer to prevent stored XSS: removes <script> tags,
// strips HTML tags and event handler attributes like onerror, onclick, etc.
const sanitizeInput = (value) => {
  if (typeof value !== 'string') return value;
  let v = value;
  // Remove <script>...</script>
  v = v.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  // Remove image tags completely
  v = v.replace(/<img[\s\S]*?>/gi, '');
  // Remove inline event handlers e.g. onerror="..." or onclick='...'
  v = v.replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Remove javascript: URIs
  v = v.replace(/javascript:\s*[^\s"'>]*/gi, '');
  // Strip any remaining HTML tags
  v = v.replace(/<[^>]+>/g, '');
  return v.trim();
};

// Migration function to update the playlists table
const migratePlaylistsTable = () => {
  console.log('Starting playlists table migration...');
  
  db.serialize(() => {
    // Begin transaction
    db.run('BEGIN TRANSACTION');
    
    // Backup existing playlists
    db.all('SELECT * FROM playlists', [], (err, playlists) => {
      if (err) {
        console.error('Error backing up playlists:', err);
        db.run('ROLLBACK');
        return;
      }
      
      // Drop existing table
      db.run('DROP TABLE IF EXISTS playlists', (err) => {
        if (err) {
          console.error('Error dropping playlists table:', err);
          db.run('ROLLBACK');
          return;
        }
        
        // Create new table with updated schema
        db.run(`CREATE TABLE playlists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          description TEXT,
          user_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES accounts(id)
        )`, (err) => {
          if (err) {
            console.error('Error creating new playlists table:', err);
            db.run('ROLLBACK');
            return;
          }
          
          // Restore playlists data
          if (playlists && playlists.length > 0) {
            const stmt = db.prepare('INSERT INTO playlists (id, name, description, user_id) VALUES (?, ?, ?, ?)');
            playlists.forEach(playlist => {
              stmt.run(playlist.id, playlist.name, playlist.description, playlist.user_id);
            });
            stmt.finalize();
          }
          
          // Commit transaction
          db.run('COMMIT');
          console.log('Playlists table migration completed successfully');
        });
      });
    });
  });
};

// Add column helper function
const addColumnIfNotExists = (table, column, type) => {
  db.get(`PRAGMA table_info(${table})`, (err, rows) => {
    if (err) {
      console.error(`Error checking ${table} table info:`, err);
      return;
    }
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error(`Error adding ${column} to ${table}:`, err);
      }
    });
  });
};

// Create tables
const createTables = () => {
  // Create base tables
  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS music (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    author TEXT NOT NULL,
    lyrics TEXT,
    cover_url TEXT,
    audio_url TEXT
  )`);

  // Add audio_path column to existing table
  addColumnIfNotExists('music', 'audio_path', 'TEXT');
    
    db.run(`CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES accounts(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS playlist_music (
    playlist_id INTEGER,
    music_id INTEGER,
    FOREIGN KEY(playlist_id) REFERENCES playlists(id),
    FOREIGN KEY(music_id) REFERENCES music(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    music_id INTEGER,
    text TEXT,
    FOREIGN KEY(user_id) REFERENCES accounts(id),
    FOREIGN KEY(music_id) REFERENCES music(id)
  )`);
};

// Create tables and run migrations
createTables();
migratePlaylistsTable();

// Routes (basic examples)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ...API endpoints for accounts, music, playlists, comments will be added here...
// Register
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  const safeUsername = sanitizeInput(username);
  db.run('INSERT INTO accounts (username, password) VALUES (?, ?)', [safeUsername, password], function(err) {
    if (err) return res.json({ success: false, message: 'Username taken.' });
    res.json({ success: true, message: 'Registered successfully.' });
  });
});

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const safeUsername = sanitizeInput(username);
  db.get('SELECT * FROM accounts WHERE username = ? AND password = ?', [safeUsername, password], (err, row) => {
    if (row) {
      res.json({ success: true, userId: row.id, token: 'dummy-token', message: 'Login successful.' });
    } else {
      res.json({ success: false, message: 'Invalid credentials.' });
    }
  });
});

app.get('/assets/:filename', (req, res) => {
  path_ = path.join(__dirname, req.params.filename);

  res.sendFile(path_);
});

// Get all music
app.get('/music', (req, res) => {
  const query = req.query.search;
  let sql = 'SELECT * FROM music';
  let params = [];
  
  if (query) {
    sql = 'SELECT * FROM music WHERE name LIKE ? OR author LIKE ? OR description LIKE ?';
    params = [`%${query}%`, `%${query}%`, `%${query}%`];
  }
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error fetching music:', err);
      return res.status(500).json({ error: 'Failed to fetch music' });
    }
    res.json(rows);
  });
});

// Add music
app.post('/music', upload.single('audioFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Audio file is required' });
    }

      const { name, author, description, lyrics, cover_url } = req.body;
      const safeName = sanitizeInput(name);
      const safeAuthor = sanitizeInput(author);
      const safeDescription = sanitizeInput(description);
      const safeLyrics = sanitizeInput(lyrics);
      const safeCover = sanitizeInput(cover_url);
      // Default cover image when none provided
      const defaultCover = 'https://static.hitmcdn.com/static/images/no-cover-150.jpg';
      const finalCover = safeCover && safeCover.length ? safeCover : defaultCover;

      if (!safeName || !safeAuthor) {
      // Remove uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'Name and author are required' });
    }

    // Get relative path for storage
    const audio_path = path.relative(__dirname, req.file.path).replace(/\\/g, '/');

    db.run(
      'INSERT INTO music (name, author, description, lyrics, cover_url, audio_path) VALUES (?, ?, ?, ?, ?, ?)',
      [safeName, safeAuthor, safeDescription, safeLyrics, finalCover, audio_path],
      function(err) {
        if (err) {
          // Remove uploaded file if database insert fails
          fs.unlinkSync(req.file.path);
          console.error('Error adding music:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ 
          success: true, 
          id: this.lastID,
          song: {
            id: this.lastID,
            name: safeName,
            author: safeAuthor,
            description: safeDescription,
            lyrics: safeLyrics,
            cover_url: finalCover,
            audio_path
          }
        });
      }
    );
  } catch (error) {
    // Remove uploaded file if any error occurs
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Error in music upload:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create playlist
app.post('/playlists', (req, res) => {
  const { name, description, userId } = req.body;
  const safeName = sanitizeInput(name);
  const safeDescription = sanitizeInput(description);
  if (!safeName) {
    return res.status(400).json({ success: false, error: 'Playlist name is required' });
  }

  db.run('INSERT INTO playlists (name, description, user_id) VALUES (?, ?, ?)', 
    [safeName, safeDescription || null, userId], 
    function(err) {
      if (err) {
        console.error('Error creating playlist:', err);
        return res.status(500).json({ success: false, error: 'Failed to create playlist' });
      }
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Get playlists for user
app.get('/playlists', (req, res) => {
  const { userId } = req.query;
  db.all(`
    SELECT p.*, 
           COUNT(pm.music_id) as song_count 
    FROM playlists p 
    LEFT JOIN playlist_music pm ON p.id = pm.playlist_id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC`, 
    [userId], 
    (err, rows) => {
      if (err) {
        console.error('Error fetching playlists:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json(rows);
    }
  );
});

// Delete playlist
app.delete('/playlists/:id', (req, res) => {
  const playlistId = req.params.id;
  db.serialize(() => {
    // Begin transaction
    db.run('BEGIN TRANSACTION');
    
    // Delete playlist songs first
    db.run('DELETE FROM playlist_music WHERE playlist_id = ?', [playlistId], (err) => {
      if (err) {
        db.run('ROLLBACK');
        console.error('Error deleting playlist songs:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      
      // Then delete the playlist
      db.run('DELETE FROM playlists WHERE id = ?', [playlistId], (err) => {
        if (err) {
          db.run('ROLLBACK');
          console.error('Error deleting playlist:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        // Commit transaction
        db.run('COMMIT');
        res.json({ success: true });
      });
    });
  });
});

// Add music to playlist
app.post('/playlist_music', (req, res) => {
  const { playlistId, musicId } = req.body;
  db.run('INSERT INTO playlist_music (playlist_id, music_id) VALUES (?, ?)', [playlistId, musicId], function(err) {
    res.json({ success: !err });
  });
});

// Get music in playlist
app.get('/playlist_music', (req, res) => {
  const { playlistId } = req.query;
  db.all('SELECT music.* FROM music JOIN playlist_music ON music.id = playlist_music.music_id WHERE playlist_music.playlist_id = ?', [playlistId], (err, rows) => {
    if (err) {
      console.error('Error fetching playlist music:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json(rows);
  });
});

// Remove song from playlist
app.delete('/playlist_music', (req, res) => {
  const { playlistId, musicId } = req.body;
  db.run('DELETE FROM playlist_music WHERE playlist_id = ? AND music_id = ?', 
    [playlistId, musicId], 
    function(err) {
      if (err) {
        console.error('Error removing from playlist:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true });
    }
  );
});

// Get all comments
app.get('/comments', (req, res) => {
  db.all('SELECT * FROM comments', [], (err, rows) => {
    res.json(rows);
  });
});

// Add comment
app.post('/comments', (req, res) => {
  const { userId, text } = req.body;
  const safeText = sanitizeInput(text);
  db.run('INSERT INTO comments (user_id, text) VALUES (?, ?)', [userId, safeText], function(err) {
    res.json({ success: !err, id: this.lastID });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
