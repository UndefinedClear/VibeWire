let token = localStorage.getItem('token') || null;
let userId = localStorage.getItem('userId') || null;
let currentlyPlaying = null;
let audio = new Audio();
let currentPlaylist = null;
let currentPlaylistIndex = -1;

const API = 'http://localhost:3001';

// Check if user is already logged in
if (token && userId) {
    document.getElementById('auth').style.display = 'none';
    document.getElementById('main').style.display = 'grid';
    document.getElementById('username-display').textContent = localStorage.getItem('username') || '';
    loadMusic();
    loadPlaylists();
}

// Playlist playback controls
function playNextSong() {
    if (!currentPlaylist || currentPlaylistIndex === -1) return;
    currentPlaylistIndex = (currentPlaylistIndex + 1) % currentPlaylist.length;
    playSong(currentPlaylist[currentPlaylistIndex], true);
}

function playPreviousSong() {
    if (!currentPlaylist || currentPlaylistIndex === -1) return;
    currentPlaylistIndex = (currentPlaylistIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    playSong(currentPlaylist[currentPlaylistIndex], true);
}

// Update play buttons in the interface
function updatePlayButtons() {
    document.querySelectorAll('.play-btn i').forEach(icon => {
        if (icon.closest('.playlist-song-item')?.dataset.songId == currentlyPlaying) {
            icon.className = 'fas fa-pause';
        } else {
            icon.className = 'fas fa-play';
        }
    });
}

// Auth Functions
function register() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    // Проверка на пустые поля
    if (!username || !password) {
        document.getElementById('auth-msg').innerText = 'Username and password cannot be empty!';
        return;
    }

    fetch(`${API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
        .then(res => res.json())
        .then(data => {
            document.getElementById('auth-msg').innerText = data.message;
        });
}

function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    // Проверка на пустые поля
    if (!username || !password) {
        document.getElementById('auth-msg').innerText = 'Username and password cannot be empty!';
        return;
    }
    fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                token = data.token;
                userId = data.userId;

                // Store in localStorage
                localStorage.setItem('token', token);
                localStorage.setItem('userId', userId);
                localStorage.setItem('username', username);

                currentUser = { username: username, userId: userId };

                document.getElementById('auth').style.display = 'none';
                document.getElementById('main').style.display = 'grid';
                document.getElementById('username-display').textContent = username;
                loadMusic();
                loadPlaylists();
            } else {
                document.getElementById('auth-msg').innerText = data.message;
            }
        });
}

function unlogin() {
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');

    // Reset variables
    token = null;
    userId = null;

    // Stop any playing music
    if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
    }

    // Reset UI
    document.getElementById('auth').style.display = 'flex';
    document.getElementById('main').style.display = 'none';
    document.getElementById('auth-msg').innerText = '';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';

    location.reload();
}

// Music Functions
let searchTimeout;

function debounceSearch(event) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchSongs(event.target.value);
    }, 300);
}

function searchSongs(query) {
    const url = query ? `${API}/music?search=${encodeURIComponent(query)}` : `${API}/music`;
    fetch(url)
        .then(res => res.json())
        .then(data => {
            const grid = document.getElementById('music-list');
            grid.innerHTML = '';
            if (data.length === 0) {
                grid.innerHTML = '<div class="no-results">No songs found</div>';
                return;
            }
            data.forEach(song => {
                const card = createMusicCard(song);
                grid.appendChild(card);
            });
        });
}

function loadMusic() {
    fetch(`${API}/music`)
        .then(res => res.json())
        .then(data => {
            const grid = document.getElementById('music-list');
            grid.innerHTML = '';
            data.forEach(song => {
                const card = createMusicCard(song);
                grid.appendChild(card);
            });
        });
}

function createMusicCard(song) {
    const card = document.createElement('div');
    card.className = 'music-card';

    // Create a data attribute to store the song data
    card.dataset.song = JSON.stringify(song);

    card.innerHTML = `
        <img src="${song.cover_url || 'https://via.placeholder.com/150'}" alt="${song.name} cover">
        <h3>${song.name}</h3>
        <p class="text-gray">${song.author}</p>
        <div class="card-controls">
            <button class="play-btn">
                <i class="fas fa-play"></i>
            </button>
            <button class="lyrics-btn" title="View Lyrics">
                <i class="fas fa-align-left"></i>
            </button>
            <button class="add-to-playlist-btn" title="Add to Playlist">
                <i class="fas fa-plus"></i>
            </button>
        </div>
    `;

    // Add click event listeners for all buttons
    const playBtn = card.querySelector('.play-btn');
    const lyricsBtn = card.querySelector('.lyrics-btn');
    const addToPlaylistBtn = card.querySelector('.add-to-playlist-btn');

    playBtn.addEventListener('click', () => {
        const songData = JSON.parse(card.dataset.song);
        playSong(songData);
    });

    lyricsBtn.addEventListener('click', () => {
        showLyrics(song);
    });

    addToPlaylistBtn.addEventListener('click', () => {
        addToPlaylist(song.id);
    });

    return card;
}

// Song Upload
function showUploadForm() {
    const modal = document.createElement('div');
    modal.className = 'upload-modal';
    modal.innerHTML = `
        <h2>Upload New Song</h2>
        <input type="text" id="song-name" placeholder="Song Name" required>
        <input type="text" id="song-author" placeholder="Artist Name" required>
        <textarea id="song-description" placeholder="Song Description"></textarea>
        <textarea id="song-lyrics" placeholder="Lyrics"></textarea>
        <input type="url" id="song-cover" placeholder="Cover Image URL">
        <input type="file" id="song-file" accept="audio/*" required>
        <button onclick="uploadSong()">Upload Song</button>
        <button onclick="this.parentElement.remove()">Cancel</button>
    `;
    document.body.appendChild(modal);
}

async function uploadSong() {
    const name = document.getElementById('song-name').value.trim();
    const author = document.getElementById('song-author').value.trim();
    const description = document.getElementById('song-description').value.trim();
    const lyrics = document.getElementById('song-lyrics').value.trim();
    const cover_url = document.getElementById('song-cover').value.trim();
    const audioFile = document.getElementById('song-file').files[0];

    // Validation
    if (!name || !author || !audioFile) {
        alert('Song name, author and audio file are required!');
        return;
    }

    // Show loading state
    const uploadButton = document.querySelector('.upload-modal button');
    uploadButton.disabled = true;
    uploadButton.textContent = 'Uploading...';

    try {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('author', author);
        formData.append('description', description);
        formData.append('lyrics', lyrics);
        formData.append('cover_url', cover_url);
        formData.append('audioFile', audioFile);

        const response = await fetch(`${API}/music`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            alert('Song uploaded successfully!');
            document.querySelector('.upload-modal').remove();
            loadMusic();
        } else {
            throw new Error(data.error || 'Unknown error');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error uploading song: ' + error.message);
        uploadButton.disabled = false;
        uploadButton.textContent = 'Upload Song';
    }
}

// Playback Functions
let currentSong = null;

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function updatePlayPauseButton(isPlaying) {
    const playButton = document.querySelector('.play-pause-btn i');
    if (playButton) {
        playButton.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
    }
}

function updateProgress() {
    const progressBar = document.querySelector('.progress');
    const currentTime = document.getElementById('current-time');
    const totalTime = document.getElementById('total-time');

    if (audio.duration) {
        const percent = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = percent + '%';
        currentTime.textContent = formatTime(audio.currentTime);
        totalTime.textContent = formatTime(audio.duration);
    }
}

function setupProgressControl() {
    const progressContainer = document.querySelector('.progress-bar');

    progressContainer.addEventListener('click', (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = audio.duration * percent;
        updateProgress();
    });
}

function updateVolumeIcon(volume) {
    const volumeIcon = document.querySelector('.volume-control i');
    if (!volumeIcon) return;

    if (volume === 0) {
        volumeIcon.className = 'fas fa-volume-mute';
    } else if (volume < 0.5) {
        volumeIcon.className = 'fas fa-volume-down';
    } else {
        volumeIcon.className = 'fas fa-volume-up';
    }
}

function setupVolumeControl() {
    const volumeContainer = document.querySelector('.volume-control .progress-bar');
    const volumeProgress = volumeContainer.querySelector('.progress');
    const volumeIcon = document.querySelector('.volume-control i');

    // Get volume from localStorage or use default
    const savedVolume = localStorage.getItem('volume');
    audio.volume = savedVolume !== null ? parseFloat(savedVolume) : 0.7;
    volumeProgress.style.width = (audio.volume * 100) + '%';

    // Initialize icon and volume
    if (audio && audio.volume !== undefined) {
        volumeProgress.style.width = (audio.volume * 100) + '%';
        updateVolumeIcon(audio.volume);
    }

    volumeContainer.addEventListener('click', (e) => {
        const rect = volumeContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const newVolume = Math.max(0, Math.min(1, percent));

        // Update audio volume and UI
        audio.volume = newVolume;
        volumeProgress.style.width = (newVolume * 100) + '%';
        updateVolumeIcon(newVolume);

        // Save to localStorage
        localStorage.setItem('volume', newVolume);
    });

    // Toggle mute on icon click
    volumeIcon.addEventListener('click', () => {
        if (audio.volume > 0) {
            // Store current volume before muting
            localStorage.setItem('lastVolume', audio.volume);
            audio.volume = 0;
            volumeProgress.style.width = '0%';
            volumeIcon.className = 'fas fa-volume-mute';
            localStorage.setItem('volume', 0);
        } else {
            // Restore last volume
            const lastVolume = parseFloat(localStorage.getItem('lastVolume')) || 1;
            audio.volume = lastVolume;
            volumeProgress.style.width = (lastVolume * 100) + '%';
            updateVolumeIcon(lastVolume);
            localStorage.setItem('volume', lastVolume);
        }
    });
}

function playSong(song, isPlaylist = false) {
    if (!song.audio_path && !song.audio_url) {
        alert('No audio file available for this song');
        return;
    }

    if (currentlyPlaying === song.id) {
        togglePlayPause();
        return;
    }

    // Update player UI first
    document.getElementById('current-track-name').textContent = song.name;
    document.getElementById('current-track-artist').textContent = song.author;
    document.getElementById('current-track-image').src = song.cover_url || 'https://via.placeholder.com/56';

    // Reset previous audio instance
    if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
    }

    // Create new audio instance
    audio = new Audio();

    // Восстанавливаем настройки громкости
    const savedVolume = localStorage.getItem('volume');
    if (savedVolume !== null) {
        audio.volume = parseFloat(savedVolume);
        const volumeProgress = document.querySelector('.volume-control .progress-bar .progress');
        if (volumeProgress) {
            volumeProgress.style.width = (audio.volume * 100) + '%';
        }
    }

    // Add event listeners
    audio.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        alert('Error loading the song.');
        currentlyPlaying = null;
        currentSong = null;
        updatePlayPauseButton(false);
        updatePlayButtons();
    });

    audio.addEventListener('loadedmetadata', () => {
        updateProgress();
        audio.play().catch(error => {
            console.error('Error playing audio:', error);
            alert('Error playing the song.');
            currentlyPlaying = null;
            currentSong = null;
            updatePlayPauseButton(false);
            updatePlayButtons();
        });
    });

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('play', () => {
        updatePlayPauseButton(true);
        updatePlayButtons();
    });
    audio.addEventListener('pause', () => {
        updatePlayPauseButton(false);
        updatePlayButtons();
    });
    audio.addEventListener('ended', () => {
        if (currentPlaylist && currentPlaylist.length > 0) {
            playNextSong();
        } else {
            currentlyPlaying = null;
            updatePlayPauseButton(false);
            updatePlayButtons();
        }
    });

    // Set source and start loading
    audio.src = song.audio_path ? `${API}/${song.audio_path}` : song.audio_url;
    currentlyPlaying = song.id;
    currentSong = song;

    // Update playlist tracking if this is a playlist song
    if (isPlaylist && currentPlaylist) {
        currentPlaylistIndex = currentPlaylist.findIndex(s => s.id === song.id);
    }

    // Setup controls
    setupProgressControl();
    setupVolumeControl();
}

function togglePlayPause() {
    if (!audio.src) return;

    if (audio.paused) {
        audio.play().catch(error => {
            console.error('Error playing audio:', error);
            alert('Error playing the song.');
        });
    } else {
        audio.pause();
    }
    updatePlayPauseButton(!audio.paused);
}

function showCreatePlaylistModal() {
    const modal = document.createElement('div');
    modal.className = 'create-playlist-modal';

    modal.innerHTML = `
        <div class="modal-content">
            <h3>Create New Playlist</h3>
            <div class="input-group">
                <input type="text" id="new-playlist-name" placeholder="Playlist Name" maxlength="50">
                <small class="char-counter">0/50</small>
            </div>
            <div class="input-group">
                <textarea id="new-playlist-description" placeholder="Playlist Description (optional)" maxlength="200"></textarea>
                <small class="char-counter">0/200</small>
            </div>
            <div class="modal-buttons">
                <button onclick="createPlaylist()" class="create-btn">
                    <i class="fas fa-plus"></i> Create
                </button>
                <button onclick="this.closest('.create-playlist-modal').remove()" class="cancel-btn">
                    Cancel
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add character counters
    const nameInput = modal.querySelector('#new-playlist-name');
    const descInput = modal.querySelector('#new-playlist-description');

    nameInput.addEventListener('input', () => {
        const counter = nameInput.parentElement.querySelector('.char-counter');
        counter.textContent = `${nameInput.value.length}/50`;
    });

    descInput.addEventListener('input', () => {
        const counter = descInput.parentElement.querySelector('.char-counter');
        counter.textContent = `${descInput.value.length}/200`;
    });

    // Focus the input
    nameInput.focus();
}

function createPlaylist() {
    const name = document.getElementById('new-playlist-name').value.trim();
    const description = document.getElementById('new-playlist-description').value.trim();

    if (!name) {
        showNotification('Please enter a playlist name', 'error');
        return;
    }

    fetch(`${API}/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            description,
            userId
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                document.querySelector('.create-playlist-modal').remove();
                showNotification(`Playlist "${name}" created`);
                loadPlaylists();
            } else {
                showNotification('Failed to create playlist', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('Failed to create playlist', 'error');
        });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function loadPlaylists() {
    fetch(`${API}/playlists?userId=${userId}`)
        .then(res => res.json())
        .then(data => {
            const list = document.getElementById('playlists');
            list.innerHTML = '';
            data.forEach(p => {
                const div = document.createElement('div');
                div.className = 'playlist-item';
                div.innerHTML = `
                <i class="fas fa-music"></i>
                <div class="playlist-info">
                    <span class="playlist-name">${p.name}</span>
                    ${p.description ? `<p class="playlist-description">${p.description}</p>` : ''}
                    <div class="playlist-details">
                        <span>${p.song_count} songs</span>
                        <span class="separator">•</span>
                        <span>Created ${formatDate(p.created_at)}</span>
                    </div>
                </div>
                <button onclick="viewPlaylist(${p.id}, '${p.name}')" class="view-playlist-btn">
                    <i class="fas fa-play"></i>
                </button>
            `;
                list.appendChild(div);
            });
        });
}

function addToPlaylist(musicId) {
    fetch(`${API}/playlists?userId=${userId}`)
        .then(res => res.json())
        .then(playlists => {
            const modal = document.createElement('div');
            modal.className = 'playlist-modal';

            let html = '<h3>Add to Playlist</h3><div class="playlist-list">';
            playlists.forEach(p => {
                html += `
                <div class="playlist-option" onclick="addSongToPlaylist(${musicId}, ${p.id}, '${p.name}')">
                    <i class="fas fa-list"></i>
                    <span>${p.name}</span>
                </div>
            `;
            });
            html += '</div><button onclick="this.parentElement.remove()">Cancel</button>';

            modal.innerHTML = html;
            document.body.appendChild(modal);
        });
}

function addSongToPlaylist(musicId, playlistId, playlistName) {
    fetch(`${API}/playlist_music`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId, musicId })
    })
        .then(res => res.json())
        .then(data => {
            document.querySelector('.playlist-modal').remove();
            if (data.success) {
                showNotification(`Added to ${playlistName}`);
            } else {
                showNotification('Failed to add to playlist', 'error');
            }
        });
}

function showLyrics(song) {
    const modal = document.createElement('div');
    modal.className = 'lyrics-modal';

    // Server performs sanitization; render values directly
    // Форматирование текста песни (сервер уже очистил HTML)
    let lyricsHtml;
    if (song.lyrics) {
        lyricsHtml = song.lyrics
            .split('\n')
            .map(line => `<p>${line || '&nbsp;'}</p>`)
            .join('');
    } else {
        lyricsHtml = '<p class="no-lyrics">No lyrics available</p>';
    }

    // Создаем структуру модального окна
    const header = document.createElement('div');
    header.className = 'lyrics-header';
    header.innerHTML = `
        <h3>${song.name}</h3>
        <p class="text-gray">${song.author}</p>
    `;

    // Добавляем кнопку закрытия
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.addEventListener('click', () => modal.remove());
    header.appendChild(closeBtn);

    // Создаем контейнер для текста
    const content = document.createElement('div');
    content.className = 'lyrics-content';
    content.innerHTML = lyricsHtml;

    // Собираем всё вместе
    modal.appendChild(header);
    modal.appendChild(content);
    document.body.appendChild(modal);
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

function viewPlaylist(id, name) {
    // First fetch playlist details
    fetch(`${API}/playlists?userId=${userId}`)
        .then(res => res.json())
        .then(playlists => {
            const playlist = playlists.find(p => p.id === id);

            // Then fetch playlist songs
            return fetch(`${API}/playlist_music?playlistId=${id}`)
                .then(res => res.json())
                .then(data => ({ playlist, songs: data }));
        })
        .then(({ playlist, songs: data }) => {
            currentPlaylist = data;
            currentPlaylistIndex = -1;

            const mainContent = document.querySelector('.main-content');
            mainContent.innerHTML = `
            <header class="playlist-header">
                <button onclick="showMainView()" class="back-btn">
                    <i class="fas fa-arrow-left"></i> Back
                </button>
                <div class="playlist-info">
                    <h2>${name}</h2>
                    ${playlist.description ? `<p class="playlist-description">${playlist.description}</p>` : ''}
                    <div class="playlist-meta">
                        <span>Created ${formatDate(playlist.created_at)}</span>
                        <span class="separator">•</span>
                        <span>${data.length} songs</span>
                    </div>
                </div>
                <div class="playlist-controls">
                    <button class="delete-playlist-btn" onclick="deletePlaylist(${id}, '${name}')">
                        <i class="fas fa-trash"></i> Delete Playlist
                    </button>
                    ${data.length > 0 ? `
                        <button class="play-all-btn" onclick="playAllSongs()">
                            <i class="fas fa-play"></i> Play All
                        </button>
                    ` : ''}
                </div>
            </header>
            <div class="playlist-songs"></div>
        `;

            const songsContainer = mainContent.querySelector('.playlist-songs');
            if (data.length === 0) {
                songsContainer.innerHTML = '<div class="no-songs">No songs in this playlist</div>';
                return;
            }

            data.forEach((song, index) => {
                const songDiv = document.createElement('div');
                songDiv.className = 'playlist-song-item';
                songDiv.dataset.songId = song.id;
                songDiv.innerHTML = `
                <div class="song-number">${index + 1}</div>
                <img src="${song.cover_url || 'https://via.placeholder.com/40'}" alt="${song.name} cover">
                <div class="song-info">
                    <h4>${song.name}</h4>
                    <p>${song.author}</p>
                </div>
                <div class="song-controls">
                    <button class="play-btn" onclick='playSong(${JSON.stringify(song)}, true)'>
                        <i class="fas ${currentlyPlaying === song.id ? 'fa-pause' : 'fa-play'}"></i>
                    </button>
                    <button class="lyrics-btn" onclick='showLyrics(${JSON.stringify(song)})' title="View Lyrics">
                        <i class="fas fa-align-left"></i>
                    </button>
                    <button class="remove-btn" onclick="removeFromPlaylist(${id}, ${song.id}, '${name}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
                songsContainer.appendChild(songDiv);
            });
        });
}

function deletePlaylist(id, name) {
    if (!confirm(`Are you sure you want to delete the playlist "${name}"?`)) return;

    fetch(`${API}/playlists/${id}`, {
        method: 'DELETE'
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showNotification(`Playlist "${name}" deleted`);
                showMainView();
                loadPlaylists();
            } else {
                showNotification('Failed to delete playlist', 'error');
            }
        });
}

function playAllSongs() {
    if (!currentPlaylist || currentPlaylist.length === 0) return;
    currentPlaylistIndex = 0;
    playSong(currentPlaylist[0], true);
}

function loadComments() {
    fetch(`${API}/comments`)
        .then(res => res.json())
        .then(data => {
            const list = document.getElementById('comments');
            list.innerHTML = '';
            data.forEach(c => {
                const div = document.createElement('div');
                div.innerHTML = `<b>User ${c.user_id}</b>: ${c.text}`;
                list.appendChild(div);
            });
        });
}

function addComment() {
    const text = document.getElementById('comment-text').value;
    fetch(`${API}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, text })
    })
        .then(res => res.json())
        .then(() => loadComments());
}

// <header class="header">
//     <div class="search-container">
//         <input type="text" class="search-bar" id="search-song" 
//                placeholder="Search for Songs, Artists, or Playlists"
//                onkeyup="debounceSearch(event)">
//         <i class="fas fa-search search-icon"></i>
//     </div>
//     <div class="user-menu">
//         <span id="username-display"></span>

//         <space style="margin-left: 10px;"></space>

//         <button onclick="showUploadForm()" class="upload-btn" title="Support: MP3, WAV, OGG (max 10MB)">
//             <i class="fas fa-upload"></i> Upload Song
//         </button>

//         <button onclick="unlogin()" class="delete-playlist-btn">
//             <i class="fas fa-sign-out-alt"></i> Unlogin
//         </button>
//     </div>
// </header>

function showMainView() {
    const mainContent = document.querySelector('.main-content');
    mainContent.innerHTML = `


        <section class="featured-content">
            <h2>Featured</h2>
            <div class="music-grid" id="music-list"></div>
        </section>
    `;
    // Восстанавливаем имя пользователя
    document.getElementById('username-display').textContent = localStorage.getItem('username') || '';
    loadMusic();
}

function removeFromPlaylist(playlistId, songId, playlistName) {
    if (!confirm('Remove this song from the playlist?')) return;

    fetch(`${API}/playlist_music`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId, musicId: songId })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                viewPlaylist(playlistId, playlistName);
                showNotification('Song removed from playlist');
            } else {
                showNotification('Failed to remove song', 'error');
            }
        });
}





// Глобальные переменные для отслеживания состояния
let currentAudio = null;
let currentUser = null;
// let currentSong = null;
let isAudioPlaying = false;

// Функция для отправки текущего состояния прослушивания
async function updatePlaybackState(username, currentTime = 0, songName = null, coverUrl = null, isPlaying = false) {
    try {
        const defaultCover = 'https://static.hitmcdn.com/static/images/no-cover-150.jpg';

        const response = await fetch('/api/playback/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                currentTime: currentTime,
                songName: songName || 'No song playing',
                coverUrl: coverUrl || defaultCover,
                isPlaying: isPlaying
            })
        });

        const data = await response.json();

        if (!data.success) {
            console.error('Failed to update playback:', data.error);
        }

        return data;
    } catch (error) {
        console.error('Error updating playback state:', error);
        return { success: false, error: error.message };
    }
}

// Функция для получения состояния прослушивания пользователя
async function getPlaybackState(username) {
    try {
        const response = await fetch(`/api/playback/${encodeURIComponent(username)}`);
        const data = await response.json();

        if (!data.success) {
            console.error('Failed to get playback:', data.error);
            return null;
        }

        return data.playback;
    } catch (error) {
        console.error('Error getting playback state:', error);
        return null;
    }
}

// Функция для получения текущей песни (адаптируйте под вашу структуру)
function getCurrentSong() {
    if (!currentSong) {
        return {
            name: 'No song playing',
            cover_url: 'https://static.hitmcdn.com/static/images/no-cover-150.jpg'
        };
    }
    return currentSong;
}

// Функция для проверки состояния аудио
function getAudioState() {
    if (!currentAudio || currentAudio.paused) {
        return {
            isPlaying: false,
            currentTime: 0
        };
    }

    return {
        isPlaying: true,
        currentTime: currentAudio.currentTime
    };
}

// Основная функция отслеживания
function setupPlaybackTracking() {
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 5000; // Обновлять каждые 5 секунд

    setInterval(() => {
        // Проверяем, авторизован ли пользователь
        if (!currentUser || !currentUser.username) {
            console.log('No user logged in, skipping playback update');
            return;
        }

        const currentTime = Date.now();

        // Обновляем только если прошло достаточно времени
        if (currentTime - lastUpdateTime >= UPDATE_INTERVAL) {
            const audioState = getAudioState();
            const song = getCurrentSong();

            updatePlaybackState(
                currentUser.username,
                audioState.currentTime,
                song.name,
                song.cover_url,
                audioState.isPlaying
            );

            lastUpdateTime = currentTime;
            console.log('Playback state updated:', {
                user: currentUser.username,
                playing: audioState.isPlaying,
                song: song.name,
                time: audioState.currentTime
            });
        }
    }, 1000); // Проверяем каждую секунду
}

// Функция для установки текущего аудио (вызывайте её при смене песни)
function setCurrentAudio(audioElement, songData = null) {
    currentAudio = audioElement;
    currentSong = songData;

    if (audioElement) {
        // Отслеживаем события воспроизведения/паузы
        audioElement.addEventListener('play', () => {
            isAudioPlaying = true;
            if (currentUser) {
                updatePlaybackState(
                    currentUser.username,
                    audioElement.currentTime,
                    currentSong?.name,
                    currentSong?.cover_url,
                    true
                );
            }
        });

        audioElement.addEventListener('pause', () => {
            isAudioPlaying = false;
            if (currentUser) {
                updatePlaybackState(
                    currentUser.username,
                    audioElement.currentTime,
                    currentSong?.name,
                    currentSong?.cover_url,
                    false
                );
            }
        });

        audioElement.addEventListener('ended', () => {
            isAudioPlaying = false;
            if (currentUser) {
                updatePlaybackState(
                    currentUser.username,
                    0,
                    'No song playing',
                    'https://static.hitmcdn.com/static/images/no-cover-150.jpg',
                    false
                );
            }
        });
    }
}

// Функция для установки текущего пользователя (вызывайте при логине)
function setCurrentUser(user) {
    currentUser = user;
    if (user && user.username) {
        console.log('User set for playback tracking:', user.username);
    }
}

// Функция для сброса состояния (вызывайте при логауте)
function resetPlaybackState() {
    if (currentUser) {
        // Отправляем состояние "не играет" перед выходом
        updatePlaybackState(
            currentUser.username,
            0,
            'No song playing',
            'https://static.hitmcdn.com/static/images/no-cover-150.jpg',
            false
        );
    }
    currentUser = null;
    currentAudio = null;
    currentSong = null;
    isAudioPlaying = false;
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function () {
    // localStorage.getItem('token', token);
    
    

    currentUser = { username: localStorage.getItem('username', username), userId: localStorage.getItem('userId', userId) };

    // Ждём немного перед инициализацией, чтобы всё загрузилось
    setTimeout(() => {
        setupPlaybackTracking();
        console.log('Playback tracking initialized');
    }, 2000);
});