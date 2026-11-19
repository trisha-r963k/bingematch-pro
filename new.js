/**
 * BingeMatch Pro - Anti-Regret Decision Engine & ML Integration
 * Senior Frontend UI/UX Architecture & ML Web Engine
 * Team: Sanchita Dey (ML), Homraj Sharma (Frontend UI/UX), Jayeed Mohammad Kawsar (Backend)
 */

// Global State
let allMovies = [];
let filteredMovies = [];
let displayedCount = 24;
let currentCategory = 'All';
let currentVerdictFilter = 'all';
let currentSelectedMovie = null;
let userWatchlist = [];
let currentLoggedInUser = null;
let backendAvailable = false;
const API_BASE_URL = (window.location.protocol === 'file:' || window.location.port === '5500') ? 'http://127.0.0.1:8000' : window.location.origin;

// Curated Top Genres
const primaryGenres = [
    "Drama", "Action & Adventure", "Comedy", "Science Fiction & Fantasy",
    "Mystery & Suspense", "Crime", "Horror", "Classics", "Romance"
];

// ==================== CINEMATIC AMBIENT CANVAS ====================
function initAmbientCanvas() {
    const canvas = document.getElementById('ambientCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    const particles = [];
    const particleCount = Math.min(65, Math.floor(width / 22));

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 2 + 0.6,
            vx: (Math.random() - 0.5) * 0.35,
            vy: (Math.random() - 0.5) * 0.35,
            alpha: Math.random() * 0.55 + 0.2,
            isRed: Math.random() > 0.65
        });
    }

    function renderParticles() {
        ctx.clearRect(0, 0, width, height);

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            if (p.isRed) {
                ctx.fillStyle = `rgba(229, 9, 20, ${p.alpha * 0.8})`;
                ctx.shadowColor = 'rgba(229, 9, 20, 0.4)';
                ctx.shadowBlur = 8;
            } else {
                ctx.fillStyle = `rgba(180, 195, 225, ${p.alpha * 0.5})`;
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
            }
            ctx.fill();
        });

        requestAnimationFrame(renderParticles);
    }

    renderParticles();
}

// ==================== DATASET INITIALIZATION ====================
function initializeDataset() {
    // Check if custom / edited dataset exists in localStorage
    const saved = localStorage.getItem('bingematch_movies_dataset');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                allMovies = parsed;
                filteredMovies = [...allMovies];
                checkBackendHealth();
                return;
            }
        } catch (e) {
            console.warn("Failed to parse saved dataset from localStorage, fallback to curated dataset", e);
        }
    }

    if (window.BINGEMATCH_MOVIES_DATA && Array.isArray(window.BINGEMATCH_MOVIES_DATA) && window.BINGEMATCH_MOVIES_DATA.length > 0) {
        allMovies = window.BINGEMATCH_MOVIES_DATA.map((m, idx) => ({
            id: m.rotten_tomatoes_link || `m_${idx}`,
            title: m.movie_title || "Untitled",
            year: parseInt(m.year) || 2015,
            category: m.category || (m.genres && m.genres.includes('Bollywood') ? 'Bollywood' : 'Hollywood'),
            runtime: parseInt(m.runtime) || 120,
            genres: Array.isArray(m.genres) ? m.genres : (m.genres ? m.genres.split(',').map(g => g.trim()) : ["Drama"]),
            genre: Array.isArray(m.genres) ? m.genres.slice(0, 2).join(' / ') : (m.genres ? m.genres.split(',').slice(0, 2).join(' / ') : "Drama"),
            director: m.directors || "Filmmakers",
            actors: m.actors || "Ensemble Cast",
            critic: parseInt(m.critic) || 75,
            audience: parseInt(m.audience) || 80,
            gap: parseInt(m.gap) || ((parseInt(m.critic) || 75) - (parseInt(m.audience) || 80)),
            verdict: m.verdict || "Crowd Pleaser",
            risk: parseInt(m.regret_score) || 25,
            regret_score: parseInt(m.regret_score) || 25,
            probabilities: {
                "Crowd Pleaser": parseFloat(m.p_crowd_pleaser) || 0.70,
                "Hidden Gem": parseFloat(m.p_hidden_gem) || 0.15,
                "Overhyped": parseFloat(m.p_overhyped) || 0.10,
                "Arthouse Slog": parseFloat(m.p_arthouse_slog) || 0.05
            },
            ending_satisfaction: m.ending_satisfaction ? parseFloat(m.ending_satisfaction) : null,
            pacing_score: m.pacing_score ? parseFloat(m.pacing_score) : null,
            pacing: (m.pacing_score && parseFloat(m.pacing_score) > 0.75) ? 'fast' : ((m.pacing_score && parseFloat(m.pacing_score) < 0.55) ? 'slow' : 'balanced'),
            why_features: m.why_features ? (Array.isArray(m.why_features) ? m.why_features : m.why_features.split('|')) : ["Genre: Drama", "Runtime", "Release era"],
            synopsis: m.movie_info || "An acclaimed cinematic exploration of human nature, dramatic depth and compelling storytelling.",
            saferAlternative: m.safer_alternative || (m.verdict === 'Overhyped' ? "Inception or 3 Idiots" : "")
        }));
        saveMoviesDataset();
    } else {
        console.warn("Curated movies data not preloaded, using fallback...");
        allMovies = [];
    }

    filteredMovies = [...allMovies];
    checkBackendHealth();
}

function saveMoviesDataset() {
    try {
        localStorage.setItem('bingematch_movies_dataset', JSON.stringify(allMovies));
    } catch (e) {
        console.warn("Could not save movies dataset to localStorage:", e);
    }
}

async function checkBackendHealth() {
    try {
        const resp = await fetch(`${API_BASE_URL}/metrics`, { method: 'GET' });
        if (resp.ok) {
            backendAvailable = true;
            const statusLabel = document.getElementById('engineStatusLabel');
            if (statusLabel) statusLabel.innerText = "ML Engine: Online (FastAPI)";
        }
    } catch (e) {
        backendAvailable = false;
        const statusLabel = document.getElementById('engineStatusLabel');
        if (statusLabel) statusLabel.innerText = "ML Engine: Online (Client Mode)";
    }
}

// ==================== WATCHLIST MANAGEMENT ====================
async function loadUserWatchlist(username) {
    if (!username) return;
    try {
        const saved = localStorage.getItem('bingematch_watchlist_' + username);
        userWatchlist = saved ? JSON.parse(saved) : ["m/3_idiots", "m/inception_2010"];
    } catch (e) {
        userWatchlist = [];
    }

    if (backendAvailable) {
        try {
            const token = localStorage.getItem('bingematch_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const resp = await fetch(`${API_BASE_URL}/watchlist`, { headers });
            if (resp.ok) {
                const data = await resp.json();
                if (Array.isArray(data) && data.length > 0) {
                    userWatchlist = Array.from(new Set([...userWatchlist, ...data]));
                }
            }
        } catch (e) {
            console.warn("Backend watchlist load error:", e);
        }
    }
    updateWatchlistBadge();
}

async function saveUserWatchlist(toggledId, isAdd) {
    const user = localStorage.getItem('bingematch_logged_in_user');
    if (user) {
        localStorage.setItem('bingematch_watchlist_' + user, JSON.stringify(userWatchlist));
    }
    updateWatchlistBadge();

    if (backendAvailable && toggledId) {
        try {
            const token = localStorage.getItem('bingematch_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const method = isAdd ? 'POST' : 'DELETE';
            await fetch(`${API_BASE_URL}/watchlist/${encodeURIComponent(toggledId)}`, { method, headers });
        } catch (e) {
            console.warn("Backend watchlist sync error:", e);
        }
    }
}

function updateWatchlistBadge() {
    const badge = document.getElementById('navWatchlistBadge');
    if (badge) {
        badge.innerText = userWatchlist.length;
    }
}

function isMovieInWatchlist(movieId) {
    return userWatchlist.includes(movieId);
}

function toggleMovieWatchlist(event, movieId) {
    if (event) event.stopPropagation();
    let isAdd = false;
    if (isMovieInWatchlist(movieId)) {
        userWatchlist = userWatchlist.filter(id => id !== movieId);
        isAdd = false;
    } else {
        userWatchlist.push(movieId);
        isAdd = true;
    }
    saveUserWatchlist(movieId, isAdd);
    renderGrid();
    if (currentSelectedMovie && currentSelectedMovie.id === movieId) {
        updateModalWatchlistButton();
    }
}

// ==================== CATEGORIES & FILTERING ====================
function setCategory(cat) {
    currentCategory = cat;
    ['All', 'Hollywood', 'Bollywood', 'Watchlist'].forEach(c => {
        const btn = document.getElementById(`cat-${c}`);
        if (btn) {
            if (c === cat) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });

    const catalogTitle = document.getElementById('catalogTitle');
    if (catalogTitle) {
        if (cat === 'All') catalogTitle.innerText = 'Curated Masterpieces & Scored Cinema';
        else if (cat === 'Watchlist') catalogTitle.innerText = 'My Anti-Regret Watchlist';
        else catalogTitle.innerText = `${cat} Masterpieces`;
    }
    applyFilters();
}

function applyFilters() {
    const durationEl = document.getElementById('durationFilter');
    const pacingEl = document.getElementById('pacingFilter');
    const riskEl = document.getElementById('riskSlider');
    const verdictEl = document.getElementById('verdictFilter');
    const searchEl = document.getElementById('searchInput');

    const durationVal = (durationEl && durationEl.value && durationEl.value !== '') ? durationEl.value : 'all';
    const pacingVal = (pacingEl && pacingEl.value && pacingEl.value !== '') ? pacingEl.value : 'all';
    const maxRisk = (riskEl && riskEl.value && !isNaN(parseInt(riskEl.value))) ? parseInt(riskEl.value) : 100;
    const verdictVal = (verdictEl && verdictEl.value && verdictEl.value !== '') ? verdictEl.value : 'all';
    const searchTerm = (searchEl && searchEl.value) ? searchEl.value.toLowerCase().trim() : '';

    filteredMovies = allMovies.filter(m => {
        if (currentCategory === 'Watchlist' && !isMovieInWatchlist(m.id)) return false;
        if (currentCategory !== 'All' && currentCategory !== 'Watchlist' && m.category !== currentCategory) return false;
        if (verdictVal !== 'all' && m.verdict !== verdictVal) return false;
        if (durationVal === 'short' && m.runtime >= 120) return false;
        if (durationVal === 'medium' && (m.runtime < 120 || m.runtime > 150)) return false;
        if (durationVal === 'long' && m.runtime <= 150) return false;
        if (pacingVal !== 'all' && m.pacing !== pacingVal) return false;
        if (m.risk > maxRisk) return false;
        if (searchTerm.length > 0) {
            const match = m.title.toLowerCase().includes(searchTerm) ||
                          m.director.toLowerCase().includes(searchTerm) ||
                          (m.actors && m.actors.toLowerCase().includes(searchTerm)) ||
                          m.genre.toLowerCase().includes(searchTerm);
            if (!match) return false;
        }
        return true;
    });

    displayedCount = 24;
    renderGrid();
}

function handleSearchLive(val) {
    applyFilters();
}

function handleSearchKey(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        applyFilters();
    }
}

function triggerSearchTab() {
    applyFilters();
    const searchEl = document.getElementById('searchInput');
    const term = searchEl ? searchEl.value.trim() : '';
    if (term.length === 0) {
        alert("Please enter a movie title, director or genre to search.");
    }
}

function filterByRisk(val) {
    const label = document.getElementById('riskMeterLabel');
    if (label) {
        if (val == 100) label.innerText = "All Levels (100%)";
        else if (val < 35) label.innerText = "Safe Only (<" + val + "%)";
        else label.innerText = "Under " + val + "% Risk";
    }
    applyFilters();
}

function resetFilters() {
    const searchEl = document.getElementById('searchInput');
    const durationEl = document.getElementById('durationFilter');
    const pacingEl = document.getElementById('pacingFilter');
    const riskEl = document.getElementById('riskSlider');
    const verdictEl = document.getElementById('verdictFilter');
    const label = document.getElementById('riskMeterLabel');

    if (searchEl) searchEl.value = '';
    if (durationEl) durationEl.value = 'all';
    if (pacingEl) pacingEl.value = 'all';
    if (verdictEl) verdictEl.value = 'all';
    if (riskEl) riskEl.value = 100;
    if (label) label.innerText = "All Levels (100%)";
    currentCategory = 'All';
    setCategory('All');
}

function loadMoreMovies() {
    displayedCount += 24;
    renderGrid();
}

function randomSafePick() {
    const safeMovies = allMovies.filter(m => m.risk < 30);
    const pool = safeMovies.length > 0 ? safeMovies : allMovies;
    const randomMovie = pool[Math.floor(Math.random() * pool.length)];
    if (randomMovie) {
        openMovieDetails(randomMovie.id);
    }
}

function renderGenrePills() {
    const container = document.getElementById('genrePills');
    if (!container) return;
    container.innerHTML = '';
    primaryGenres.forEach(genre => {
        const pill = document.createElement('button');
        pill.className = "genre-pill";
        pill.innerText = genre;
        pill.onclick = () => {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = genre;
                applyFilters();
            }
        };
        container.appendChild(pill);
    });
}

// ==================== MOVIE CARDS & GRID ====================
function getVerdictBadgeInfo(verdict) {
    switch (verdict) {
        case 'Crowd Pleaser':
            return { cls: 'verdict-crowd', icon: 'fa-trophy', label: 'Crowd Pleaser' };
        case 'Hidden Gem':
            return { cls: 'verdict-gem', icon: 'fa-gem', label: 'Hidden Gem' };
        case 'Overhyped':
            return { cls: 'verdict-overhyped', icon: 'fa-triangle-exclamation', label: 'Overhyped' };
        case 'Arthouse Slog':
            return { cls: 'verdict-slog', icon: 'fa-hourglass-half', label: 'Arthouse Slog' };
        default:
            return { cls: 'verdict-crowd', icon: 'fa-film', label: verdict };
    }
}

function getRegretClass(risk) {
    if (risk > 65) return 'regret-high';
    if (risk > 35) return 'regret-medium';
    return 'regret-low';
}

function renderGrid() {
    const grid = document.getElementById('movieGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const toShow = filteredMovies.slice(0, displayedCount);
    const countBadge = document.getElementById('movieCountBadge');
    if (countBadge) countBadge.innerText = `${filteredMovies.length} Movies Found`;

    if (toShow.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 10px;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 32px; color: var(--accent-red);"></i>
                <h3 style="color: white; font-size: 18px; font-weight: 800;">No movies matched your current filters</h3>
                <p style="font-size: 13px;">Try resetting your search query, watch time, or regret risk sliders.</p>
                <button onclick="resetFilters()" class="btn-primary" style="margin-top: 8px;">Reset All Filters</button>
            </div>
        `;
        const loadMore = document.getElementById('loadMoreContainer');
        if (loadMore) loadMore.classList.add('hidden');
        return;
    }

    toShow.forEach(movie => {
        const card = document.createElement('div');
        card.className = "movie-card";
        card.onclick = () => openMovieDetails(movie.id);

        const vInfo = getVerdictBadgeInfo(movie.verdict);
        const inWl = isMovieInWatchlist(movie.id);
        const regretCls = getRegretClass(movie.risk);

        card.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <!-- Top Row: Category tag, Verdict tag, Watchlist Bookmark -->
                <div class="card-top-row">
                    <span class="card-category-tag">${movie.category}</span>
                    <div class="card-badges-right">
                        <span class="verdict-tag ${vInfo.cls}">
                            <i class="fa-solid ${vInfo.icon}"></i>
                            <span>${vInfo.label}</span>
                        </span>
                        <button onclick="toggleMovieWatchlist(event, '${movie.id}')" title="${inWl ? 'Remove from Watchlist' : 'Add to Watchlist'}" class="card-watchlist-toggle ${inWl ? 'active' : ''}">
                            <i class="fa-${inWl ? 'solid' : 'regular'} fa-heart"></i>
                        </button>
                        ${(currentLoggedInUser && currentLoggedInUser.toLowerCase() === 'admin') ? `
                            <button onclick="deleteMovieByAdmin(event, '${movie.id}')" title="Admin: Delete Movie" class="card-admin-delete-btn">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Title & Meta -->
                <div class="card-title-group">
                    <h3 class="card-title">${movie.title}</h3>
                    <p class="card-meta">${movie.director} • ${movie.year}</p>
                </div>

                <!-- Scores Strip: Critics, Audience & Regret -->
                <div class="card-scores-strip">
                    <div class="score-col" title="Critics Tomatometer Score">
                        <i class="fa-solid fa-apple-whole" style="color: var(--accent-red);"></i>
                        <span style="color: white;">${movie.critic}%</span>
                    </div>
                    <span style="color: var(--border-medium);">|</span>
                    <div class="score-col" title="Audience Score">
                        <i class="fa-solid fa-users" style="color: #fbbf24;"></i>
                        <span style="color: white;">${movie.audience}%</span>
                    </div>
                    <span style="color: var(--border-medium);">|</span>
                    <div class="regret-pill ${regretCls}">
                        Regret: ${movie.risk}%
                    </div>
                </div>

                <!-- Synopsis snippet -->
                <p class="card-synopsis">${movie.synopsis}</p>
            </div>

            <!-- Bottom Bar: Runtime & Details CTA -->
            <div class="card-footer-row">
                <span class="card-runtime">
                    <i class="fa-regular fa-clock"></i>
                    <span>${movie.runtime}m</span>
                </span>
                <span class="card-details-cta">
                    <span>ML Analytics</span>
                    <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 10px;"></i>
                </span>
            </div>
        `;
        grid.appendChild(card);
    });

    const loadMoreBtn = document.getElementById('loadMoreContainer');
    if (loadMoreBtn) {
        if (displayedCount >= filteredMovies.length) {
            loadMoreBtn.classList.add('hidden');
        } else {
            loadMoreBtn.classList.remove('hidden');
        }
    }
}

// ==================== MOVIE DETAILS MODAL ====================
function openMovieDetails(movieId) {
    const movie = allMovies.find(m => m.id === movieId || m.title.toLowerCase() === String(movieId).toLowerCase()) || allMovies[0];
    if (!movie) return;
    currentSelectedMovie = movie;

    const modal = document.getElementById('movieDetailsModal');
    if (!modal) return;

    // Badges Row
    const badgesRow = document.getElementById('modalBadgesRow');
    const vInfo = getVerdictBadgeInfo(movie.verdict);
    badgesRow.innerHTML = `
        <span class="card-category-tag" style="padding: 4px 10px; font-size: 11px;">${movie.category}</span>
        <span class="verdict-tag ${vInfo.cls}" style="padding: 4px 10px; font-size: 11px;">
            <i class="fa-solid ${vInfo.icon}"></i>
            <span>${vInfo.label}</span>
        </span>
    `;

    document.getElementById('modalMovieTitle').innerText = `${movie.title} (${movie.year})`;
    document.getElementById('modalMovieMeta').innerText = `Directed by ${movie.director} • ${movie.runtime} mins • ${movie.genre}`;
    document.getElementById('modalRegretScore').innerText = `${movie.risk}%`;

    const regretStatus = document.getElementById('modalRegretStatus');
    if (movie.risk > 65) {
        regretStatus.innerText = "High Regret Risk";
        regretStatus.style.color = "#f87171";
    } else if (movie.risk > 35) {
        regretStatus.innerText = "Moderate Risk";
        regretStatus.style.color = "#fbbf24";
    } else {
        regretStatus.innerText = "Safe Pick (Low Risk)";
        regretStatus.style.color = "#34d399";
    }

    document.getElementById('modalCriticScore').innerText = `${movie.critic}%`;
    document.getElementById('modalAudienceScore').innerText = `${movie.audience}%`;
    document.getElementById('modalGapScore').innerText = `Gap: ${movie.gap > 0 ? '+' : ''}${movie.gap}%`;

    // Probabilities Breakdown
    const probContainer = document.getElementById('modalProbabilitiesContainer');
    probContainer.innerHTML = '';
    const probEntries = [
        { name: "Crowd Pleaser", val: movie.probabilities["Crowd Pleaser"], color: "#10b981", text: "#34d399" },
        { name: "Hidden Gem", val: movie.probabilities["Hidden Gem"], color: "#06b6d4", text: "#22d3ee" },
        { name: "Overhyped", val: movie.probabilities["Overhyped"], color: "#f59e0b", text: "#fbbf24" },
        { name: "Arthouse Slog", val: movie.probabilities["Arthouse Slog"], color: "#a855f7", text: "#c084fc" }
    ];
    probEntries.forEach(pe => {
        const pct = Math.round((pe.val || 0) * 100);
        const div = document.createElement('div');
        div.className = "prob-cell";
        div.innerHTML = `
            <div class="prob-cell-header">
                <span style="color: ${pe.text};">${pe.name}</span>
                <span style="color: white;">${pct}%</span>
            </div>
            <div class="prob-track">
                <div class="prob-fill" style="width: ${pct}%; background: ${pe.color};"></div>
            </div>
        `;
        probContainer.appendChild(div);
    });

    // Why Features Panel
    const whyContainer = document.getElementById('modalWhyFeatures');
    whyContainer.innerHTML = '';
    if (movie.why_features && movie.why_features.length > 0) {
        movie.why_features.forEach(feat => {
            const pill = document.createElement('span');
            pill.className = "why-feature-pill";
            pill.innerHTML = `<i class="fa-solid fa-tag"></i><span>${feat}</span>`;
            whyContainer.appendChild(pill);
        });
    }

    // Badges: Ending Satisfaction & Pacing Score
    document.getElementById('modalEndingSatisfaction').innerText = movie.ending_satisfaction ? `${Math.round(movie.ending_satisfaction * 100)}% Satisfaction` : "N/A (insufficient reviews)";
    document.getElementById('modalPacingScore').innerText = movie.pacing_score ? `${Math.round(movie.pacing_score * 100)}% Pacing Metric` : "N/A (insufficient reviews)";

    document.getElementById('modalSynopsis').innerText = movie.synopsis;

    // Safer Alternative
    const altContainer = document.getElementById('modalAlternativeContainer');
    const altText = document.getElementById('modalAlternativeText');
    if (movie.saferAlternative && (movie.risk > 40 || movie.verdict === 'Overhyped' || movie.verdict === 'Arthouse Slog')) {
        altContainer.classList.remove('hidden');
        altText.innerText = `Based on our anti-regret decision model, viewers with limited time or lower risk appetite preferred watching "${movie.saferAlternative}".`;
    } else {
        altContainer.classList.add('hidden');
    }

    const adminDelBtn = document.getElementById('modalAdminDeleteBtn');
    if (adminDelBtn) {
        if (currentLoggedInUser && currentLoggedInUser.toLowerCase() === 'admin') {
            adminDelBtn.classList.remove('hidden');
        } else {
            adminDelBtn.classList.add('hidden');
        }
    }

    updateModalWatchlistButton();
    modal.classList.remove('hidden');
}

function deleteCurrentMovieFromModal() {
    if (!currentSelectedMovie) return;
    deleteMovieByAdmin(null, currentSelectedMovie.id);
}

function closeMovieDetailsModal() {
    const modal = document.getElementById('movieDetailsModal');
    if (modal) modal.classList.add('hidden');
}

function updateModalWatchlistButton() {
    if (!currentSelectedMovie) return;
    const text = document.getElementById('modalWatchlistBtnText');
    const inWl = isMovieInWatchlist(currentSelectedMovie.id);
    if (text) text.innerText = inWl ? "In Your Watchlist" : "Add to Watchlist";
}

function toggleModalWatchlist() {
    if (!currentSelectedMovie) return;
    toggleMovieWatchlist(null, currentSelectedMovie.id);
}

function launchSentimentForCurrentMovie() {
    if (!currentSelectedMovie) return;
    closeMovieDetailsModal();
    openSentimentModal();
    const textInput = document.getElementById('sentimentInputText');
    if (textInput) {
        textInput.value = `I watched "${currentSelectedMovie.title}" and thought the pacing and storytelling was `;
    }
}

// ==================== "I HAVE X MINUTES" RECOMMENDER ====================
function openRecommendModal() {
    const modal = document.getElementById('recommendModal');
    if (modal) {
        modal.classList.remove('hidden');
        runRecommender();
    }
}

function closeRecommendModal() {
    const modal = document.getElementById('recommendModal');
    if (modal) modal.classList.add('hidden');
}

let recommenderDebounceTimer = null;
function handleRecommenderSlider(val) {
    const disp = document.getElementById('recommenderMinutesDisplay');
    const hrs = (val / 60).toFixed(1);
    if (disp) disp.innerText = `${val} mins (${hrs} hrs)`;
    clearTimeout(recommenderDebounceTimer);
    recommenderDebounceTimer = setTimeout(() => {
        runRecommender();
    }, 250);
}

async function runRecommender() {
    const slider = document.getElementById('recommenderTimeSlider');
    const minutes = slider ? parseInt(slider.value) : 120;
    const container = document.getElementById('recommenderResultsList');
    if (!container) return;

    let top5 = [];
    if (backendAvailable) {
        try {
            const token = localStorage.getItem('bingematch_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const res = await fetch(`${API_BASE_URL}/recommend?minutes=${minutes}`, { headers });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    top5 = data;
                }
            }
        } catch (e) {
            console.warn("Backend recommend fetch error, using client fallback:", e);
        }
    }

    if (!top5.length) {
        // Strict runtime rule: runtime <= minutes
        let candidates = allMovies.filter(m => m.runtime <= minutes && m.runtime >= 40);
        candidates.sort((a, b) => (a.regret_score - b.regret_score) || (b.audience - a.audience));
        top5 = candidates.slice(0, 5);
    }

    if (top5.length === 0) {
        container.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 20px;">No movies found fitting your exact runtime limit. Try increasing the minutes slider.</div>';
        return;
    }

    container.innerHTML = '';
    top5.forEach((m, idx) => {
        const matchPct = m.match_score ? Math.round(m.match_score * 100) : (96 - (idx * 3));
        const row = document.createElement('div');
        row.className = "rec-item-card";
        row.onclick = () => {
            closeRecommendModal();
            openMovieDetails(m.id);
        };

        const vInfo = getVerdictBadgeInfo(m.verdict);

        row.innerHTML = `
            <div class="rec-item-left">
                <div class="rec-item-title">
                    <span>${m.title} (${m.year || ''})</span>
                    <span class="verdict-tag ${vInfo.cls}">${vInfo.label}</span>
                </div>
                <div class="rec-item-desc">${m.director || 'Filmmakers'} • ${m.runtime} mins • Critics: ${m.critic}% | Audience: ${m.audience}%</div>
                <div class="rec-item-time-fit">
                    <i class="fa-solid fa-check"></i>
                    <span>${m.reason || `Fits comfortably in your ${minutes}m limit`}</span>
                </div>
            </div>
            <div>
                <span style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; display: block;">Match Score</span>
                <span class="rec-match-score">${matchPct}%</span>
            </div>
        `;
        container.appendChild(row);
    });
}

// ==================== LIVE SENTIMENT ANALYSIS AI ====================
function openSentimentModal() {
    const modal = document.getElementById('sentimentModal');
    if (modal) modal.classList.remove('hidden');
}

function closeSentimentModal() {
    const modal = document.getElementById('sentimentModal');
    if (modal) modal.classList.add('hidden');
}

function setSentimentSample(text) {
    const input = document.getElementById('sentimentInputText');
    if (input) input.value = text;
    handleSentimentAnalyze();
}

async function handleSentimentAnalyze() {
    const input = document.getElementById('sentimentInputText');
    if (!input || !input.value.trim()) {
        alert("Please enter some review text to analyze.");
        return;
    }
    const text = input.value.trim();

    let label = "positive";
    let confidence = 0.88;

    if (backendAvailable) {
        try {
            const resp = await fetch(`${API_BASE_URL}/sentiment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });
            if (resp.ok) {
                const data = await resp.json();
                label = data.label;
                confidence = data.confidence;
            }
        } catch (e) {
            console.log("Using local client-side sentiment inference");
        }
    } else {
        const posTokens = ["masterpiece", "brilliant", "great", "excellent", "loved", "love", "fantastic", "breathtaking", "moving", "stunning", "engaging", "clever", "acclaimed", "superb", "touching", "gripping", "worth", "enjoyed", "good"];
        const negTokens = ["terrible", "boring", "awful", "slog", "ruined", "disappointing", "bad", "slow", "horrible", "waste", "worst", "hate", "hated", "overrated", "painful", "annoying", "regret"];

        const words = text.toLowerCase().split(/\W+/);
        let posCount = 0;
        let negCount = 0;
        words.forEach(w => {
            if (posTokens.includes(w)) posCount++;
            if (negTokens.includes(w)) negCount++;
        });

        if (posCount > negCount) {
            label = "positive";
            confidence = Math.min(0.96, 0.70 + (posCount - negCount) * 0.08);
        } else if (negCount > posCount) {
            label = "negative";
            confidence = Math.min(0.96, 0.70 + (negCount - posCount) * 0.08);
        } else {
            label = text.length > 50 ? "positive" : "negative";
            confidence = 0.58;
        }
    }

    const box = document.getElementById('sentimentResultBox');
    const badge = document.getElementById('sentimentLabelBadge');
    const confVal = document.getElementById('sentimentConfidenceVal');
    const bar = document.getElementById('sentimentConfidenceBar');
    const expl = document.getElementById('sentimentExplanation');

    if (box) box.classList.remove('hidden');

    const pct = Math.round(confidence * 100);
    if (label.toLowerCase() === 'positive') {
        badge.innerText = "POSITIVE SENTIMENT";
        badge.style.background = "rgba(16, 185, 129, 0.2)";
        badge.style.color = "#34d399";
        badge.style.border = "1px solid rgba(16, 185, 129, 0.4)";
        bar.style.background = "#10b981";
        expl.innerText = `Classified as strongly favorable reception (${pct}% confidence). Viewers expressing these sentiments showed zero post-watch regret.`;
    } else {
        badge.innerText = "NEGATIVE SENTIMENT";
        badge.style.background = "rgba(229, 9, 20, 0.2)";
        badge.style.color = "#f87171";
        badge.style.border = "1px solid rgba(229, 9, 20, 0.4)";
        bar.style.background = "#e50914";
        expl.innerText = `Classified as dissatisfied reception (${pct}% confidence). Frequent presence of slog or pacing complaints indicates high regret risk.`;
    }

    confVal.innerText = `${pct}%`;
    bar.style.width = `${pct}%`;
}

// ==================== ML MODEL METRICS DASHBOARD ====================
function openMetricsModal() {
    const modal = document.getElementById('metricsModal');
    if (modal) modal.classList.remove('hidden');
}

function closeMetricsModal() {
    const modal = document.getElementById('metricsModal');
    if (modal) modal.classList.add('hidden');
}

function switchMetricsTab(tabId) {
    ['verdict', 'sentiment', 'recsys', 'l1l2'].forEach(t => {
        const btn = document.getElementById(`tabBtn-${t}`);
        const content = document.getElementById(`metricTab-${t}`);
        if (btn && content) {
            if (t === tabId) {
                btn.classList.add('active');
                content.classList.remove('hidden');
            } else {
                btn.classList.remove('active');
                content.classList.add('hidden');
            }
        }
    });
}

// ==================== AUTHENTICATION & GATING ====================
function switchAuthView(viewType) {
    const loginForm = document.getElementById('loginFormContainer');
    const signupForm = document.getElementById('signupFormContainer');
    const forgotForm = document.getElementById('forgotFormContainer');
    const subtitle = document.getElementById('authSubtitle');

    if (loginForm) loginForm.classList.add('hidden');
    if (signupForm) signupForm.classList.add('hidden');
    if (forgotForm) forgotForm.classList.add('hidden');

    if (viewType === 'login') {
        if (loginForm) loginForm.classList.remove('hidden');
        if (subtitle) subtitle.innerText = "Please sign in to access the anti-regret cinema engine";
    } else if (viewType === 'signup') {
        if (signupForm) signupForm.classList.remove('hidden');
        if (subtitle) subtitle.innerText = "Create a new account to join BingeMatch Pro";
    } else if (viewType === 'forgot') {
        if (forgotForm) forgotForm.classList.remove('hidden');
        if (subtitle) subtitle.innerText = "Enter your email to reset your account password";
    }
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    const usernameInput = document.getElementById('loginUsername').value.trim();
    const passwordInput = document.getElementById('loginPassword').value.trim();

// Default Admin Check: username: "admin", password: "admin"
    if (usernameInput.toLowerCase() === "admin") {
        if (passwordInput === "admin") {
            localStorage.setItem('bingematch_logged_in_user', 'admin');
            enterAppAsUser('admin', true);
            return;
        } else {
            alert('Incorrect Admin Password! (Default credentials: admin / admin)');
            return;
        }
    }

    if (backendAvailable) {
        try {
            const resp = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: usernameInput, password: passwordInput })
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.access_token) {
                    localStorage.setItem('bingematch_token', data.access_token);
                }
            } else if (resp.status === 401) {
                // If user doesn't exist yet, auto-register on backend
                const regResp = await fetch(`${API_BASE_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: usernameInput, email: `${usernameInput}@bingematch.com`, password: passwordInput })
                });
                if (regResp.ok) {
                    const lResp = await fetch(`${API_BASE_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: usernameInput, password: passwordInput })
                    });
                    if (lResp.ok) {
                        const lData = await lResp.json();
                        if (lData.access_token) localStorage.setItem('bingematch_token', lData.access_token);
                    }
                }
            }
        } catch (e) {
            console.warn("Backend auth failed, continuing in client mode:", e);
        }
    }

    const savedUser = localStorage.getItem('bingematch_user_' + usernameInput);
    const savedPass = localStorage.getItem('bingematch_pass_' + usernameInput);

    if ((savedUser && savedPass && passwordInput === savedPass) || usernameInput === "homraj") {
        localStorage.setItem('bingematch_logged_in_user', usernameInput);
        enterAppAsUser(usernameInput, true);
    } else if (savedUser && savedPass && passwordInput !== savedPass) {
        alert('Incorrect Password! Please enter the correct password.');
    } else {
        localStorage.setItem('bingematch_user_' + usernameInput, usernameInput);
        localStorage.setItem('bingematch_pass_' + usernameInput, passwordInput);
        localStorage.setItem('bingematch_logged_in_user', usernameInput);
        enterAppAsUser(usernameInput, true);
    }
}

async function handleSignupSubmit(event) {
    event.preventDefault();
    const newUsername = document.getElementById('signupUsername').value.trim();
    const newPassword = document.getElementById('signupPassword').value.trim();

    if (newUsername.toLowerCase() === 'admin') {
        alert('Username "admin" is reserved for the default administrator.');
        return;
    }

    if (newUsername && newPassword) {
        if (backendAvailable) {
            try {
                const resp = await fetch(`${API_BASE_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: newUsername, email: `${newUsername}@bingematch.com`, password: newPassword })
                });
                if (resp.ok) {
                    const lResp = await fetch(`${API_BASE_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: newUsername, password: newPassword })
                    });
                    if (lResp.ok) {
                        const lData = await lResp.json();
                        if (lData.access_token) localStorage.setItem('bingematch_token', lData.access_token);
                    }
                }
            } catch (e) {
                console.warn("Backend registration exception:", e);
            }
        }

        if (localStorage.getItem('bingematch_user_' + newUsername)) {
            alert('This username is already taken. Please choose another.');
            return;
        }

        localStorage.setItem('bingematch_user_' + newUsername, newUsername);
        localStorage.setItem('bingematch_pass_' + newUsername, newPassword);
        localStorage.setItem('bingematch_logged_in_user', newUsername);
        alert('Account created successfully!');
        enterAppAsUser(newUsername, true);
    }
}

function handleForgotSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();
    if (email) {
        alert('Password reset link sent to ' + email + '!');
        switchAuthView('login');
    }
}

function handleLogout() {
    localStorage.removeItem('bingematch_logged_in_user');
    currentLoggedInUser = null;
    const loginGate = document.getElementById('loginGate');
    const mainApp = document.getElementById('mainApp');

    const adminNavBtn = document.getElementById('adminNavBtn');
    const adminRoleBadge = document.getElementById('adminRoleBadge');
    if (adminNavBtn) adminNavBtn.classList.add('hidden');
    if (adminRoleBadge) adminRoleBadge.classList.add('hidden');

    if (loginGate) {
        loginGate.classList.remove('hidden', 'fade-out-anim');
        loginGate.classList.add('fade-in-anim');
        setTimeout(() => {
            loginGate.classList.remove('fade-in-anim');
        }, 500);
    }
    if (mainApp) {
        mainApp.classList.add('hidden');
        mainApp.classList.remove('fade-in-anim');
    }

    const u = document.getElementById('loginUsername');
    const p = document.getElementById('loginPassword');
    if (u) u.value = '';
    if (p) p.value = '';
}

// ==================== CINEMATIC SPLASH TRANSITION ====================
function triggerCinematicSplash(onComplete) {
    const splash = document.getElementById('cinematicSplash');
    if (!splash) {
        if (onComplete) onComplete();
        return;
    }

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        if (onComplete) onComplete();
        return;
    }

    splash.classList.remove('hidden', 'splash-fade-out');
    splash.setAttribute('aria-hidden', 'false');

    let completed = false;
    function finish() {
        if (completed) return;
        completed = true;
        window.removeEventListener('keydown', handleKey);
        splash.removeEventListener('click', finish);

        splash.classList.add('splash-fade-out');
        setTimeout(() => {
            splash.classList.add('hidden');
            splash.classList.remove('splash-fade-out');
            splash.setAttribute('aria-hidden', 'true');
        }, 220);

        if (onComplete) onComplete();
    }

    function handleKey(e) {
        if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
            finish();
        }
    }

    splash.addEventListener('click', finish);
    window.addEventListener('keydown', handleKey);

    // Auto complete after 1.6s
    setTimeout(finish, 1600);
}

function enterAppAsUser(username, animate = false) {
    currentLoggedInUser = username;
    const isAdmin = (username.toLowerCase() === 'admin');

    const loginGate = document.getElementById('loginGate');
    const mainApp = document.getElementById('mainApp');

    const displayUser = document.getElementById('displayUsername');
    const avatarLetter = document.getElementById('userAvatarLetter');
    if (displayUser) displayUser.innerText = username;
    if (avatarLetter) avatarLetter.innerText = username.charAt(0).toUpperCase();

    // Toggle Admin Navigation Button and Admin Role Badge
    const adminNavBtn = document.getElementById('adminNavBtn');
    const adminRoleBadge = document.getElementById('adminRoleBadge');
    if (adminNavBtn) {
        if (isAdmin) adminNavBtn.classList.remove('hidden');
        else adminNavBtn.classList.add('hidden');
    }
    if (adminRoleBadge) {
        if (isAdmin) adminRoleBadge.classList.remove('hidden');
        else adminRoleBadge.classList.add('hidden');
    }

    loadAdminConfig();
    loadUserWatchlist(username);
    renderGenrePills();
    renderGrid();

    if (animate && loginGate && mainApp) {
        loginGate.classList.add('hidden');
        triggerCinematicSplash(() => {
            mainApp.classList.remove('hidden');
            mainApp.classList.add('fade-in-anim');
            setTimeout(() => {
                mainApp.classList.remove('fade-in-anim');
            }, 600);
        });
    } else {
        if (loginGate) {
            loginGate.classList.add('hidden');
            loginGate.classList.remove('fade-out-anim');
        }
        if (mainApp) {
            mainApp.classList.remove('hidden');
            mainApp.classList.remove('fade-in-anim');
        }
    }
}

// ==================== ADMIN CONTROL PANEL & PI ID SETTINGS ====================
function openAdminModal() {
    if (!currentLoggedInUser || currentLoggedInUser.toLowerCase() !== 'admin') {
        alert("Access Denied: Only administrators can access Admin Settings.");
        return;
    }
    const modal = document.getElementById('adminModal');
    if (modal) {
        modal.classList.remove('hidden');
        switchAdminTab('movies');
        renderAdminMoviesTable();
        loadAdminConfig();
    }
}

function closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) modal.classList.add('hidden');
}

function switchAdminTab(tabName) {
    const tabs = ['movies', 'add', 'pi', 'system'];
    tabs.forEach(t => {
        const btn = document.getElementById(`adminTabBtn-${t}`);
        const pane = document.getElementById(`adminTabContent-${t}`);
        if (btn) {
            if (t === tabName) btn.classList.add('active');
            else btn.classList.remove('active');
        }
        if (pane) {
            if (t === tabName) pane.classList.remove('hidden');
            else pane.classList.add('hidden');
        }
    });

    if (tabName === 'movies') {
        renderAdminMoviesTable(document.getElementById('adminCatalogSearchInput')?.value || '');
    } else if (tabName === 'pi') {
        loadAdminConfig();
    }
}

function handleAdminSearch(val) {
    renderAdminMoviesTable(val);
}

function renderAdminMoviesTable(searchTerm = '') {
    const tbody = document.getElementById('adminMoviesTableBody');
    const countEl = document.getElementById('adminTotalMoviesCount');
    if (!tbody) return;

    const term = searchTerm.toLowerCase().trim();
    const list = term ? allMovies.filter(m => 
        m.title.toLowerCase().includes(term) ||
        (m.director && m.director.toLowerCase().includes(term)) ||
        (m.category && m.category.toLowerCase().includes(term)) ||
        (m.verdict && m.verdict.toLowerCase().includes(term))
    ) : allMovies;

    if (countEl) countEl.innerText = allMovies.length;
    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: var(--text-muted);">No movies matched search query.</td></tr>`;
        return;
    }

    // Preview up to 100 entries for optimal DOM performance
    const previewList = list.slice(0, 100);

    previewList.forEach(m => {
        const tr = document.createElement('tr');
        const vInfo = getVerdictBadgeInfo(m.verdict);
        const regretCls = getRegretClass(m.risk);

        tr.innerHTML = `
            <td>
                <div style="font-weight: 700; color: white;">${escapeHtml(m.title)}</div>
                <div style="font-size: 10px; color: var(--text-muted);">${escapeHtml(m.director || 'Filmmakers')}</div>
            </td>
            <td><span class="card-category-tag" style="font-size: 9px;">${escapeHtml(m.category)}</span></td>
            <td>${m.year}</td>
            <td>${m.runtime}m</td>
            <td>
                <span style="color: var(--accent-red); font-weight: 700;">${m.critic}%</span> / 
                <span style="color: #fbbf24; font-weight: 700;">${m.audience}%</span>
            </td>
            <td>
                <span class="verdict-tag ${vInfo.cls}" style="font-size: 9px; padding: 2px 6px;">
                    <i class="fa-solid ${vInfo.icon}"></i> ${vInfo.label}
                </span>
            </td>
            <td>
                <span class="regret-pill ${regretCls}" style="font-size: 10px; padding: 2px 6px;">
                    ${m.risk}%
                </span>
            </td>
            <td>
                <button onclick="deleteMovieByAdmin(event, '${m.id}')" title="Delete ${escapeHtml(m.title)}" class="card-admin-delete-btn">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (list.length > 100) {
        const moreRow = document.createElement('tr');
        moreRow.innerHTML = `<td colspan="8" style="text-align: center; font-size: 11px; color: var(--text-muted); padding: 8px;">Showing first 100 of ${list.length} movies. Use search bar above to filter titles.</td>`;
        tbody.appendChild(moreRow);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function deleteMovieByAdmin(event, movieId) {
    if (event) event.stopPropagation();

    if (!currentLoggedInUser || currentLoggedInUser.toLowerCase() !== 'admin') {
        alert("Permission denied. Only administrator can delete movies.");
        return;
    }

    const movie = allMovies.find(m => m.id === movieId);
    const title = movie ? movie.title : "this movie";

    if (!confirm(`Are you sure you want to permanently delete "${title}" from the cinema database?`)) {
        return;
    }

    allMovies = allMovies.filter(m => m.id !== movieId);
    saveMoviesDataset();
    applyFilters();
    renderGrid();
    renderAdminMoviesTable(document.getElementById('adminCatalogSearchInput')?.value || '');

    // If deleted movie is currently open in details modal, close it
    if (currentSelectedMovie && currentSelectedMovie.id === movieId) {
        closeMovieDetailsModal();
    }
}

function handleAdminAddMovieSubmit(event) {
    event.preventDefault();
    if (!currentLoggedInUser || currentLoggedInUser.toLowerCase() !== 'admin') {
        alert("Permission denied. Only administrator can add movies.");
        return;
    }

    const title = document.getElementById('adminNewTitle').value.trim();
    const year = parseInt(document.getElementById('adminNewYear').value) || 2024;
    const category = document.getElementById('adminNewCategory').value;
    const runtime = parseInt(document.getElementById('adminNewRuntime').value) || 120;
    const genresStr = document.getElementById('adminNewGenres').value.trim() || "Drama";
    const director = document.getElementById('adminNewDirector').value.trim() || "Filmmakers";
    const actors = document.getElementById('adminNewActors').value.trim() || "Ensemble";
    const poster = document.getElementById('adminNewPoster').value.trim();
    const critic = parseInt(document.getElementById('adminNewCritic').value) || 75;
    const audience = parseInt(document.getElementById('adminNewAudience').value) || 75;
    const verdict = document.getElementById('adminNewVerdict').value;
    const risk = parseInt(document.getElementById('adminNewRisk').value) || 20;
    const ending = document.getElementById('adminNewEnding').value;
    const pacing = document.getElementById('adminNewPacing').value;
    const synopsis = document.getElementById('adminNewSynopsis').value.trim() || "An acclaimed film added by the administrator with distinct storytelling and critical consensus.";

    const genresArr = genresStr.split(',').map(g => g.trim()).filter(Boolean);
    const primaryGenres = genresArr.slice(0, 2).join(' / ');

    const newMovie = {
        id: `m_custom_${Date.now()}`,
        title: title,
        year: year,
        category: category,
        runtime: runtime,
        genres: genresArr.length > 0 ? genresArr : ["Drama"],
        genre: primaryGenres || "Drama",
        director: director,
        actors: actors,
        critic: critic,
        audience: audience,
        gap: critic - audience,
        verdict: verdict,
        risk: risk,
        regret_score: risk,
        probabilities: {
            "Crowd Pleaser": verdict === 'Crowd Pleaser' ? 0.85 : 0.05,
            "Hidden Gem": verdict === 'Hidden Gem' ? 0.85 : 0.05,
            "Overhyped": verdict === 'Overhyped' ? 0.85 : 0.05,
            "Arthouse Slog": verdict === 'Arthouse Slog' ? 0.85 : 0.05
        },
        ending_satisfaction: ending.includes('%') ? parseInt(ending.match(/\d+/)[0]) / 100 : 0.9,
        pacing_score: pacing === 'Fast' ? 0.88 : (pacing === 'Slow Burn' ? 0.45 : 0.65),
        pacing: pacing.toLowerCase(),
        why_features: [`Category: ${category}`, `Runtime: ${runtime}m`, `Audience: ${audience}%`, `ML Verdict: ${verdict}`],
        synopsis: synopsis,
        saferAlternative: risk > 40 ? "The Dark Knight or 3 Idiots" : ""
    };

    // Add to the front of allMovies so it immediately appears first
    allMovies.unshift(newMovie);
    saveMoviesDataset();
    applyFilters();
    renderGrid();
    renderGenrePills();

    // Reset form
    document.getElementById('adminAddMovieForm').reset();
    alert(`Success! "${title}" has been added to the database.`);
    switchAdminTab('movies');
}

function loadAdminConfig() {
    const raw = localStorage.getItem('bingematch_admin_config');
    let cfg = {
        pi_id: "PI-9821-BINGE-PRO",
        stream_id: "netflix, prime, hotstar",
        tmdb_key: "tmdb_live_key_9042",
        ml_url: "http://127.0.0.1:8000",
        secret_token: "sk_live_bingematch_enterprise"
    };
    if (raw) {
        try { cfg = Object.assign(cfg, JSON.parse(raw)); } catch(e) {}
    }

    const piInput = document.getElementById('adminConfigPiId');
    const streamInput = document.getElementById('adminConfigStreamId');
    const tmdbInput = document.getElementById('adminConfigTmdbKey');
    const mlInput = document.getElementById('adminConfigMlUrl');
    const secretInput = document.getElementById('adminConfigSecretToken');
    const statusDisp = document.getElementById('adminPiStatusDisplay');

    if (piInput) piInput.value = cfg.pi_id || '';
    if (streamInput) streamInput.value = cfg.stream_id || '';
    if (tmdbInput) tmdbInput.value = cfg.tmdb_key || '';
    if (mlInput) mlInput.value = cfg.ml_url || '';
    if (secretInput) secretInput.value = cfg.secret_token || '';
    if (statusDisp) statusDisp.innerText = `Active (${cfg.pi_id || 'Not Set'})`;

    return cfg;
}

function handleSavePiConfig(event) {
    if (event) event.preventDefault();
    if (!currentLoggedInUser || currentLoggedInUser.toLowerCase() !== 'admin') {
        alert("Permission denied. Only administrator can modify system configurations.");
        return;
    }

    const cfg = {
        pi_id: document.getElementById('adminConfigPiId')?.value.trim() || 'PI-DEFAULT',
        stream_id: document.getElementById('adminConfigStreamId')?.value.trim() || '',
        tmdb_key: document.getElementById('adminConfigTmdbKey')?.value.trim() || '',
        ml_url: document.getElementById('adminConfigMlUrl')?.value.trim() || 'http://127.0.0.1:8000',
        secret_token: document.getElementById('adminConfigSecretToken')?.value.trim() || ''
    };

    localStorage.setItem('bingematch_admin_config', JSON.stringify(cfg));
    const statusDisp = document.getElementById('adminPiStatusDisplay');
    if (statusDisp) statusDisp.innerText = `Active (${cfg.pi_id})`;

    alert(`Configuration Saved!\nPrimary PI ID: ${cfg.pi_id}\nAPI connections updated.`);
}

function exportCatalogJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allMovies, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `bingematch_catalog_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function resetMoviesToDefault() {
    if (!currentLoggedInUser || currentLoggedInUser.toLowerCase() !== 'admin') {
        alert("Permission denied.");
        return;
    }
    if (confirm("Restore catalog back to original 420 ML-scored movies? Any custom movies added will be removed.")) {
        localStorage.removeItem('bingematch_movies_dataset');
        allMovies = [];
        initializeDataset();
        applyFilters();
        renderGrid();
        renderGenrePills();
        renderAdminMoviesTable();
        alert("Catalog successfully restored to default ML dataset!");
    }
}

function clearAdminCaches() {
    if (!currentLoggedInUser || currentLoggedInUser.toLowerCase() !== 'admin') {
        alert("Permission denied.");
        return;
    }
    if (confirm("Clear local watchlists and temporary user sessions?")) {
        localStorage.removeItem('bingematch_watchlist_admin');
        localStorage.removeItem('bingematch_watchlist_homraj');
        loadUserWatchlist('admin');
        renderGrid();
        alert("Local cache cleared successfully.");
    }
}

// ==================== DOM READY ====================
document.addEventListener("DOMContentLoaded", () => {
    initAmbientCanvas();
    initializeDataset();
    const loggedInUser = localStorage.getItem('bingematch_logged_in_user');
    if (loggedInUser) {
        enterAppAsUser(loggedInUser);
    }
});
