const hollywoodTitles = [
    "Inception", "Interstellar", "The Dark Knight", "Fight Club", "Pulp Fiction", "Forrest Gump", "The Matrix", "Gladiator",
    "The Godfather", "The Lord of the Rings", "Se7en", "The Silence of the Lambs", "The Prestige", "The Departed", "Whiplash",
    "Memento", "Parasite", "The Usual Suspects", "Glengarry Glen Ross", "L.A. Confidential", "Shutter Island", "Django Unchained",
    "The Wolf of Wall Street", "The Green Mile", "Saving Private Ryan", "Interstellar Odyssey", "Blade Runner 2049", "Arrival",
    "Dune: Part One", "Dune: Part Two", "Oppenheimer", "Barbie", "Avatar: The Way of Water", "Top Gun: Maverick", "Spider-Man: Across the Spider-Verse",
    "The Batman", "Knives Out", "Glass Onion", "Bullet Train", "Everything Everywhere All at Once", "The Whale", "Babylon", "The Fabelmans",
    "Joker", "Once Upon a Time in Hollywood", "1917", "Ford v Ferrari", "Knock at the Cabin", "Infinity Pool", "Air", "John Wick: Chapter 4",
    "Creed III", "Guardians of the Galaxy Vol. 3", "Fast X", "The Little Mermaid", "Spider-Man: No Way Home", "Doctor Strange 2", "Thor: Love and Thunder",
    "Black Panther: Wakanda Forever", "Avatar", "Titanic", "Jurassic Park", "Terminator 2: Judgment Day", "Alien", "Aliens", "Back to the Future",
    "Raiders of the Lost Ark", "Star Wars: A New Hope", "The Empire Strikes Back", "Return of the Jedi", "GoodFellas", "Casino", "Scarface",
    "The Godfather Part II", "Schindler's List", "12 Angry Men", "One Flew Over the Cuckoo's Nest", "City of God", "Life Is Beautiful",
    "The Intouchables", "The Pianist", "The Lion King", "Gladiator II", "Venom: The Last Dance", "Twisters", "Beetlejuice Beetlejuice",
    "Deadpool & Wolverine", "Inside Out 2", "Despicable Me 4", "Kung Fu Panda 4", "Furiosa: A Mad Max Saga", "Kingdom of the Planet of the Apes"
];

const bollywoodTitles = [
    "3 Idiots", "Dangal", "Gangs of Wasseypur", "Sholay", "Dilwale Dulhania Le Jayenge", "Zindagi Na Milegi Dobara", "Swades",
    "Taare Zameen Par", "Kantara", "KGF: Chapter 1", "KGF: Chapter 2", "RRR", "Baahubali: The Beginning", "Baahubali 2: The Conclusion",
    "Drishyam", "Drishyam 2", "Andhadhun", "Article 15", "Mulk", "Pink", "A Wednesday", "Special 26", "Baby", "Uri: The Surgical Strike",
    "Sherni", "Newton", "Tumbbad", "Stree", "Stree 2", "Bhediya", "Munjya", "Chhaava", "Animal", "Pathaan", "Jawan", "Tiger 3", "Gadar 2",
    "Sam Bahadur", "Dunki", "Salaar", "Animal Park", "Fighter", "Crew", "Shaitaan", "Maidaan", "Srikanth", "Mr. & Mrs. Mahi", "Chandu Champion",
    "Bad Newz", "Khel Khel Mein", "Devara: Part 1", "Jigra", "Bhool Bhulaiyaa 3", "Singham Again", "Baby John", "Pushpa 2: The Rule",
    "Dil Chahta Hai", "Lagaan", "Rang De Basanti", "Ghajini", "PK", "Dhoom 2", "Zinda", "Don", "Don 2", "Rockstar", "Barfi!",
    "Queen", "Piku", "Kahaani", "Udaan", "Gangs of Wasseypur Part 2", "Haider", "Omkara", "Maqbool", "Kaminey", "Badlapur", "Raazi", "Gully Boy",
    "Super 30", "Chhichhore", "Mission Mangal", "Tanhaji", "Sooryavanshi", "Jersey", "Runway 34", "Vikram Vedha", "Bhool Bhulaiyaa 2", "The Kerala Story",
    "Zara Hatke Zara Bachke", "Satyaprem Ki Katha", "Rocky Aur Rani Kii Prem Kahaani", "OMG 2", "Dream Girl 2", "Main Atal Hoon", "Article 370"
];

const directorsList = ["Christopher Nolan", "Denis Villeneuve", "Martin Scorsese", "Quentin Tarantino", "David Fincher", "Rajkumar Hirani", "S.S. Rajamouli", "Anurag Kashyap", "Sanjay Leela Bhansali", "Vishal Bhardwaj", "Shoojit Sircar", "Sriram Raghavan", "Steven Spielberg", "Ridley Scott", "James Cameron", "Greta Gerwig"];
const genresList = ["Sci-Fi / Thriller", "Action / Drama", "Crime / Mystery", "Drama / Epic", "Romance / Comedy", "Psychological Thriller", "Adventure / Fantasy", "Horror / Mystery"];
const pacingList = ["fast", "balanced", "slow"];

let allMovies = [];
let filteredMovies = [];
let displayedCount = 24;
let currentCategory = 'All';

function generateMovies() {
    let idCounter = 1;
    
    hollywoodTitles.forEach((title, idx) => {
        const runtime = 95 + (Math.floor(Math.sin(idx * 13) * 45) + 45);
        const risk = 20 + Math.floor(Math.abs(Math.cos(idx * 7)) * 75);
        const year = 2005 + (idx % 21);
        const category = "Hollywood";
        const director = directorsList[idx % directorsList.length];
        const genre = genresList[idx % genresList.length];
        const pacing = pacingList[idx % pacingList.length];
        
        allMovies.push({
            id: idCounter++,
            title: title,
            year: year,
            category: category,
            runtime: runtime,
            risk: risk,
            director: director,
            genre: genre,
            pacing: pacing,
            synopsis: `An acclaimed cinematic masterpiece directed by ${director}. ${title} explores deep psychological and thematic arcs that keep viewers on the edge of their seats throughout its ${runtime}-minute runtime.`,
            cast: ["Lead Star A", "Co-Star B"],
            saferAlternative: "Inception or The Dark Knight"
        });
    });

    bollywoodTitles.forEach((title, idx) => {
        const runtime = 110 + (Math.floor(Math.cos(idx * 17) * 40) + 40);
        const risk = 15 + Math.floor(Math.abs(Math.sin(idx * 9)) * 80);
        const year = 2008 + (idx % 19);
        const category = "Bollywood";
        const director = directorsList[(idx + 4) % directorsList.length];
        const genre = genresList[(idx + 2) % genresList.length];
        const pacing = pacingList[idx % pacingList.length];

        allMovies.push({
            id: idCounter++,
            title: title,
            year: year,
            category: category,
            runtime: runtime,
            risk: risk,
            director: director,
            genre: genre,
            pacing: pacing,
            synopsis: `A blockbuster Indian cinematic landmark directed by ${director}. ${title} delivers powerful emotional performances, stellar music, and unforgettable storytelling across its ${runtime}-minute runtime.`,
            cast: ["Superstar X", "Leading Lady Y"],
            saferAlternative: "3 Idiots or Drishyam"
        });
    });

    while(allMovies.length < 380) {
        const idx = allMovies.length + 1;
        allMovies.push({
            id: idCounter++,
            title: `Cinematic Saga #${idx}`,
            year: 2015 + (idx % 11),
            category: idx % 2 === 0 ? "Hollywood" : "Bollywood",
            runtime: 115 + (idx % 55),
            risk: 30 + (idx % 60),
            director: directorsList[idx % directorsList.length],
            genre: genresList[idx % genresList.length],
            pacing: pacingList[idx % 3],
            synopsis: `An epic cinematic journey featuring breathtaking cinematography, intricate plot developments, and stellar ensemble performances.`,
            cast: ["Actor Alpha", "Actor Beta"],
            saferAlternative: "Interstellar"
        });
    }
    filteredMovies = [...allMovies];
}

generateMovies();

function randomSafePick() {
    const safeMovies = allMovies.filter(m => m.risk < 40);
    const pool = safeMovies.length > 0 ? safeMovies : allMovies;
    const randomMovie = pool[Math.floor(Math.random() * pool.length)];
    openMovieDetails(randomMovie.id);
}

function renderGenrePills() {
    const container = document.getElementById('genrePills');
    if(!container) return;
    container.innerHTML = '';
    genresList.forEach(genre => {
        const pill = document.createElement('button');
        pill.className = "bg-neutral-950/90 hover:bg-red-600/20 hover:text-red-400 text-neutral-300 text-xs px-3 py-1 rounded-lg font-medium transition border border-neutral-800 hover:border-red-600/40";
        pill.innerText = genre;
        pill.onclick = () => {
            const searchInput = document.getElementById('searchInput');
            if(searchInput) {
                searchInput.value = genre;
                triggerSearchTab();
            }
        };
        container.appendChild(pill);
    });
}

function setCategory(cat) {
    currentCategory = cat;
    ['All', 'Hollywood', 'Bollywood'].forEach(c => {
        const btn = document.getElementById(`cat-${c}`);
        if(btn) {
            if(c === cat) {
                btn.className = "px-4 py-1.5 rounded-lg text-sm font-semibold transition bg-red-600 text-white shadow";
            } else {
                btn.className = "px-4 py-1.5 rounded-lg text-sm font-semibold transition text-neutral-400 hover:text-white";
            }
        }
    });
    const catalogTitle = document.getElementById('catalogTitle');
    if(catalogTitle) {
        catalogTitle.innerText = cat === 'All' ? 'Curated Masterpieces & Blockbusters' : `${cat} Masterpieces`;
    }
    applyFilters();
}

function applyFilters() {
    const durationEl = document.getElementById('durationFilter');
    const pacingEl = document.getElementById('pacingFilter');
    const riskEl = document.getElementById('riskSlider');

    const durationVal = durationEl ? durationEl.value : 'all';
    const pacingVal = pacingEl ? pacingEl.value : 'all';
    const maxRisk = riskEl ? parseInt(riskEl.value) : 100;

    filteredMovies = allMovies.filter(m => {
        if(currentCategory !== 'All' && m.category !== currentCategory) return false;
        if(durationVal === 'short' && m.runtime >= 120) return false;
        if(durationVal === 'medium' && (m.runtime < 120 || m.runtime > 150)) return false;
        if(durationVal === 'long' && m.runtime <= 150) return false;
        if(pacingVal !== 'all' && m.pacing !== pacingVal) return false;
        if(m.risk > maxRisk) return false;
        return true;
    });

    displayedCount = 24;
    renderGrid();
}

function handleSearchKey(event) {
    if(event.key === 'Enter') {
        event.preventDefault();
        triggerSearchTab();
    }
}

function triggerSearchTab() {
    const searchEl = document.getElementById('searchInput');
    if (!searchEl) return;
    const searchTerm = searchEl.value.toLowerCase().trim();
    if(searchTerm.length >= 1) {
        const matches = allMovies.filter(m => 
            m.title.toLowerCase().includes(searchTerm) || 
            m.director.toLowerCase().includes(searchTerm) || 
            m.genre.toLowerCase().includes(searchTerm)
        );
        openSearchResultsTab(searchTerm, matches);
    } else {
        alert('Please type a movie name or genre to search.');
    }
}

function openSearchResultsTab(query, matches) {
    const searchWindow = window.open('', '_blank');
    if(searchWindow) {
        searchWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Search Results for "${query}" - BingeMatch Pro</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            </head>
            <body class="bg-[#0b0b0e] text-white min-h-screen p-6 lg:p-12 font-sans">
                <div class="max-w-6xl mx-auto space-y-8">
                    <div class="flex items-center justify-between border-b border-neutral-800 pb-4">
                        <div class="flex items-center space-x-2">
                            <div class="bg-red-600 p-2 rounded-lg text-white">
                                <i class="fa-solid fa-magnifying-glass text-xl"></i>
                            </div>
                            <span class="text-xl font-black tracking-wider">BINGEMATCH<span class="text-red-600">PRO</span> SEARCH SUGGESTIONS</span>
                        </div>
                        <button onclick="window.close()" class="bg-neutral-800 hover:bg-neutral-700 px-4 py-2 rounded-xl text-sm font-bold transition">Close Tab</button>
                    </div>

                    <div class="space-y-4">
                        <h1 class="text-2xl lg:text-3xl font-black">Found ${matches.length} Masterpiece(s) for "<span class="text-red-500">${query}</span>"</h1>
                        <p class="text-neutral-400 text-sm">Select any movie below to view detailed anti-regret analytics.</p>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        ${matches.map(m => `
                            <div onclick="window.opener.openMovieDetails(${m.id}); window.close();" class="bg-neutral-900 border border-neutral-800 hover:border-red-600 rounded-2xl p-5 cursor-pointer transition space-y-3 shadow-lg">
                                <div class="flex justify-between items-center text-xs">
                                    <span class="bg-red-600/20 text-red-400 px-2.5 py-0.5 rounded font-bold">${m.category}</span>
                                    <span class="text-red-500 font-bold">Risk: ${m.risk}%</span>
                                </div>
                                <h3 class="text-lg font-bold text-white">${m.title} (${m.year})</h3>
                                <p class="text-xs text-neutral-400">${m.director} • ${m.runtime} mins</p>
                                <p class="text-xs text-neutral-300 line-clamp-2">${m.synopsis}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </body>
            </html>
        `);
        searchWindow.document.close();
    }
}

function filterByRisk(val) {
    const label = document.getElementById('riskMeterLabel');
    if(label) {
        if(val == 100) label.innerText = "All Levels";
        else if(val < 35) label.innerText = "Safe Only (<" + val + "%)";
        else label.innerText = "Under " + val + "% Risk";
    }
    applyFilters();
}

function resetFilters() {
    const searchEl = document.getElementById('searchInput');
    const durationEl = document.getElementById('durationFilter');
    const pacingEl = document.getElementById('pacingFilter');
    const riskEl = document.getElementById('riskSlider');
    const label = document.getElementById('riskMeterLabel');

    if(searchEl) searchEl.value = '';
    if(durationEl) durationEl.value = 'all';
    if(pacingEl) pacingEl.value = 'all';
    if(riskEl) riskEl.value = 100;
    if(label) label.innerText = "All Levels";
    currentCategory = 'All';
    setCategory('All');
}

function loadMoreMovies() {
    displayedCount += 24;
    renderGrid();
}

function openMovieDetails(movieId) {
    const movie = allMovies.find(m => m.id === movieId) || allMovies[0];
    const detailsWindow = window.open('', '_blank');
    if(detailsWindow) {
        detailsWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${movie.title} (${movie.year}) - BingeMatch Pro Details</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            </head>
            <body class="bg-[#0b0b0e] text-white min-h-screen p-6 lg:p-12 font-sans">
                <div class="max-w-4xl mx-auto space-y-8">
                    <div class="flex items-center justify-between border-b border-neutral-800 pb-4">
                        <div class="flex items-center space-x-2">
                            <div class="bg-red-600 p-2 rounded-lg text-white">
                                <i class="fa-solid fa-film text-xl"></i>
                            </div>
                            <span class="text-xl font-black tracking-wider">BINGEMATCH<span class="text-red-600">PRO</span> DETAILS</span>
                        </div>
                        <button onclick="window.close()" class="bg-neutral-800 hover:bg-neutral-700 px-4 py-2 rounded-xl text-sm font-bold transition">Close Tab</button>
                    </div>

                    <div class="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 space-y-6 shadow-2xl">
                        <div class="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <span class="bg-red-600/20 text-red-400 border border-red-600/30 px-3 py-1 rounded-full text-xs font-bold uppercase">${movie.category}</span>
                                <h1 class="text-4xl lg:text-5xl font-black mt-2">${movie.title} <span class="text-neutral-400 font-normal">(${movie.year})</span></h1>
                            </div>
                            <div class="text-right">
                                <div class="text-xs text-neutral-400">Regret Risk Score</div>
                                <div class="text-3xl font-black text-red-500">${movie.risk}%</div>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 bg-neutral-950 p-4 rounded-2xl border border-neutral-800 text-sm">
                            <div>
                                <div class="text-neutral-500 text-xs">Director</div>
                                <div class="font-bold text-white">${movie.director}</div>
                            </div>
                            <div>
                                <div class="text-neutral-500 text-xs">Runtime</div>
                                <div class="font-bold text-white">${movie.runtime} mins</div>
                            </div>
                            <div>
                                <div class="text-neutral-500 text-xs">Genre</div>
                                <div class="font-bold text-white">${movie.genre}</div>
                            </div>
                            <div>
                                <div class="text-neutral-500 text-xs">Pacing Mood</div>
                                <div class="font-bold text-white uppercase">${movie.pacing}</div>
                            </div>
                        </div>

                        <div class="space-y-2">
                            <h3 class="font-bold text-lg text-red-500"><i class="fa-solid fa-book-open mr-2"></i>Synopsis</h3>
                            <p class="text-neutral-300 leading-relaxed text-base">${movie.synopsis}</p>
                        </div>

                        <div class="space-y-2 bg-neutral-950 p-6 rounded-2xl border border-neutral-800">
                            <h3 class="font-bold text-base text-white"><i class="fa-solid fa-shield-halved text-red-500 mr-2"></i>Anti-Regret Verdict</h3>
                            <p class="text-neutral-400 text-sm">Based on our deep cinema analysis, this film has a ${movie.risk}% risk score. If you want a safer alternative with lower commitment risk, consider watching <span class="text-white font-semibold">${movie.saferAlternative}</span>.</p>
                        </div>

                        <div class="pt-4 flex gap-4">
                            <button onclick="alert('Added to your Binge Watchlist!')" class="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-red-600/30 transition flex items-center space-x-2">
                                <i class="fa-solid fa-bookmark"></i>
                                <span>Add to Watchlist</span>
                            </button>
                            <button onclick="window.close()" class="bg-neutral-800 hover:bg-neutral-700 text-white px-6 py-3 rounded-xl font-bold transition">
                                Back to Hub
                            </button>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
        detailsWindow.document.close();
    }
}

function renderGrid() {
    const grid = document.getElementById('movieGrid');
    if(!grid) return;
    grid.innerHTML = '';
    
    const toShow = filteredMovies.slice(0, displayedCount);
    const countBadge = document.getElementById('movieCountBadge');
    if(countBadge) countBadge.innerText = `${filteredMovies.length} Movies Found`;
    
    if(toShow.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-16 text-center text-neutral-500 space-y-3">
            <i class="fa-solid fa-triangle-exclamation text-3xl text-red-500"></i>
            <p class="text-lg font-bold text-white">No movies matched your filters.</p>
            <p class="text-sm">Try resetting your watch time, pacing or search query.</p>
        </div>`;
        const loadMore = document.getElementById('loadMoreContainer');
        if(loadMore) loadMore.style.display = 'none';
        return;
    }

    toShow.forEach(movie => {
        const card = document.createElement('div');
        card.className = "bg-neutral-900/80 backdrop-blur-sm border border-neutral-800/80 hover:border-red-600/60 rounded-2xl p-4 flex flex-col justify-between transition duration-300 hover:shadow-xl hover:shadow-red-950/40 group cursor-pointer";
        card.onclick = () => openMovieDetails(movie.id);

        const riskColor = movie.risk > 65 ? 'text-red-500 bg-red-950/50 border-red-800' : (movie.risk > 40 ? 'text-amber-400 bg-amber-950/50 border-amber-800' : 'text-emerald-400 bg-emerald-950/50 border-emerald-800');

        card.innerHTML = `
            <div class="space-y-3">
                <div class="flex items-center justify-between text-xs">
                    <span class="bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded font-medium">${movie.category}</span>
                    <span class="border px-2 py-0.5 rounded font-bold ${riskColor}">Risk: ${movie.risk}%</span>
                </div>
                <div>
                    <h3 class="font-bold text-lg text-white group-hover:text-red-500 transition line-clamp-1">${movie.title}</h3>
                    <p class="text-xs text-neutral-400 mt-0.5">${movie.director} • ${movie.year}</p>
                </div>
                <p class="text-xs text-neutral-300 line-clamp-2 leading-relaxed">${movie.synopsis}</p>
            </div>
            <div class="pt-4 mt-4 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400 font-medium">
                <span class="flex items-center space-x-1"><i class="fa-regular fa-clock text-red-500"></i><span>${movie.runtime}m</span></span>
                <span class="text-red-500 font-bold group-hover:underline flex items-center space-x-1"><span>Details</span><i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i></span>
            </div>
        `;
        grid.appendChild(card);
    });

    const loadMoreBtn = document.getElementById('loadMoreContainer');
    if(loadMoreBtn) {
        if(displayedCount >= filteredMovies.length) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'block';
        }
    }
}

// --- VIDEO AUTOPLAY HELPER FUNCTION ---
function forcePlayVideo() {
    const vid = document.getElementById('bgVideo');
    if (vid) {
        vid.muted = true;
        vid.loop = true;
        let playPromise = vid.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Autoplay prevented, retrying on interaction...", error);
                document.addEventListener('click', () => {
                    vid.play();
                }, { once: true });
            });
        }
    }
}

// --- AUTHENTICATION & FORM SWITCHING LOGIC ---

function switchAuthView(viewType) {
    const loginForm = document.getElementById('loginFormContainer');
    const signupForm = document.getElementById('signupFormContainer');
    const forgotForm = document.getElementById('forgotFormContainer');
    const subtitle = document.getElementById('authSubtitle');

    loginForm.classList.add('hidden');
    signupForm.classList.add('hidden');
    forgotForm.classList.add('hidden');

    if (viewType === 'login') {
        loginForm.classList.remove('hidden');
        subtitle.innerText = "Please sign in to access the anti-regret cinema engine";
    } else if (viewType === 'signup') {
        signupForm.classList.remove('hidden');
        subtitle.innerText = "Create a new account to join BingeMatch Pro";
    } else if (viewType === 'forgot') {
        forgotForm.classList.remove('hidden');
        subtitle.innerText = "Enter your email to reset your password";
    }
}

function handleLoginSubmit(event) {
    event.preventDefault();
    const usernameInput = document.getElementById('loginUsername').value.trim();
    const passwordInput = document.getElementById('loginPassword').value.trim();
    
    const savedUser = localStorage.getItem('bingematch_user_' + usernameInput);
    const savedPass = localStorage.getItem('bingematch_pass_' + usernameInput);

    if (savedUser && savedPass) {
        if (passwordInput === savedPass) {
            localStorage.setItem('bingematch_logged_in_user', usernameInput);
            enterAppAsUser(usernameInput);
        } else {
            alert('Incorrect Password! Kripya sahi password enter karein.');
        }
    } else {
        alert('Account nahi mila. Pehle "Create New Account" pe click karke register karein.');
    }
}

function handleSignupSubmit(event) {
    event.preventDefault();
    const newUsername = document.getElementById('signupUsername').value.trim();
    const newPassword = document.getElementById('signupPassword').value.trim();
    
    if (newUsername && newPassword) {
        if(localStorage.getItem('bingematch_user_' + newUsername)) {
            alert('Ye username pehle se taken hai. Koi aur naam try karein.');
            return;
        }

        localStorage.setItem('bingematch_user_' + newUsername, newUsername);
        localStorage.setItem('bingematch_pass_' + newUsername, newPassword);
        
        localStorage.setItem('bingematch_logged_in_user', newUsername);
        alert('Account successfully ban gaya!');
        enterAppAsUser(newUsername);
    }
}

function handleForgotSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();
    if(email) {
        alert('Password reset link ' + email + ' par bhej diya gaya hai!');
        switchAuthView('login');
    }
}

function handleLogout() {
    localStorage.removeItem('bingematch_logged_in_user');
    document.getElementById('loginGate').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
}

function enterAppAsUser(username) {
    document.getElementById('loginGate').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('flex');

    const displayUser = document.getElementById('displayUsername');
    const avatarLetter = document.getElementById('userAvatarLetter');
    if (displayUser) displayUser.innerText = username;
    if (avatarLetter) avatarLetter.innerText = username.charAt(0).toUpperCase();

    // Trigger video playback
    forcePlayVideo();

    renderGenrePills();
    renderGrid();
}

document.addEventListener("DOMContentLoaded", () => {
    const loggedInUser = localStorage.getItem('bingematch_logged_in_user');
    if (loggedInUser) {
        enterAppAsUser(loggedInUser);
    } else {
        // Try playing video in background even on login gate if allowed
        forcePlayVideo();
    }
});