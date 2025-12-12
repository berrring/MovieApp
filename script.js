const API_URL = 'https://api.jikan.moe/v4';
let myWatchlist = JSON.parse(localStorage.getItem('myWatchlist')) || [];

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    injectSidebar();
    
    // Принудительно ставим имя Admin
    const userDisplay = document.getElementById('userNameDisplay');
    if(userDisplay) userDisplay.innerText = 'Admin';

    // Проверка URL и запуск
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') || 'home';
    navigate(view, false);

    initPageListeners();
});

window.addEventListener('popstate', (event) => {
    const view = event.state ? event.state.view : 'home';
    navigate(view, false);
});

function checkAuth() {
    if (window.location.pathname.includes('login.html')) return;
    if (!localStorage.getItem('isAuth')) window.location.href = 'login.html';
}

// === МЕНЮ (Генерация) ===
function injectSidebar() {
    const sidebar = document.getElementById('sidebar-container');
    if (!sidebar) return;

    // КНОПКА SETTINGS УБРАНА ИЗ HTML НИЖЕ
    sidebar.innerHTML = `
        <div class="logo">AnimeBoX</div>
        <nav class="menu">
            <div class="menu-item" data-page="home" onclick="navigate('home')">
                <i class='bx bxs-home'></i> <span>Home</span>
            </div>
            <div class="menu-item" data-page="trending" onclick="navigate('trending')">
                <i class='bx bx-star'></i> <span>Trending</span>
            </div>
            <div class="menu-item" data-page="category" onclick="navigate('category')">
                <i class='bx bx-grid-alt'></i> <span>Category</span>
            </div>
            <div class="menu-item" data-page="schedule" onclick="navigate('schedule')">
                <i class='bx bx-calendar'></i> <span>Schedule</span>
            </div>
            </nav>
        <div class="logout-btn" onclick="logout()">
            <i class='bx bx-log-out'></i> <span>Logout</span>
        </div>
    `;
}

function logout() {
    localStorage.removeItem('isAuth');
    window.location.href = 'login.html';
}

function initPageListeners() {
    const searchInput = document.getElementById('searchInput');
    let timeout;
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fetchAnime(e.target.value, 'search'), 500);
    });

    document.getElementById('openWatchListBtn')?.addEventListener('click', () => {
        navigate('watchlist');
    });
}

// === НАВИГАЦИЯ ===
function navigate(view, addToHistory = true) {
    if (addToHistory) {
        const url = new URL(window.location);
        url.searchParams.set('view', view);
        window.history.pushState({ view: view }, '', url);
    }

    // Подсветка меню
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.querySelector(`.menu-item[data-page="${view}"]`);
    if (activeItem) activeItem.classList.add('active');

    const hero = document.getElementById('heroBanner');
    const topSection = document.getElementById('topChartsSection');
    const title = document.getElementById('sectionTitle');
    const backBtn = document.getElementById('backBtn');
    const grid = document.getElementById('animeGrid');

    // Сброс видимости
    if (hero) hero.style.display = 'block';
    if (topSection) topSection.style.display = 'block';
    if (backBtn) backBtn.style.display = 'none';
    if (grid) grid.innerHTML = '<p style="color:gray">Loading...</p>';

    // --- ЛОГИКА СТРАНИЦ ---
    if (view === 'home') {
        title.innerText = 'Streaming';
        if (hero) hero.style.display = 'block';
        fetchAnime('now');
        fetchAnime('upcoming', 'top'); 

    } else if (view === 'trending') {
        title.innerText = 'Trending Now';
        if (topSection) topSection.style.display = 'none';
        fetchAnime('bypopularity');

    } else if (view === 'schedule') {
        title.innerText = 'Released Today';
        if (hero) hero.style.display = 'none';
        if (topSection) topSection.style.display = 'none';
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = days[new Date().getDay()];
        fetchAnime(today, 'schedule');

    } else if (view === 'category') {
        title.innerText = 'Browse Categories';
        if (hero) hero.style.display = 'none';
        if (topSection) topSection.style.display = 'none';
        fetchGenres();

    } else if (view === 'watchlist') {
        title.innerText = 'My Watch List';
        if (hero) hero.style.display = 'none';
        if (topSection) topSection.style.display = 'none';
        renderWatchlistGrid();
    }
    
    // Закрываем мобильное меню после клика (если оно было открыто)
    if (window.innerWidth <= 768) {
       const sidebar = document.getElementById('sidebar-container');
       sidebar.classList.remove('mobile-active');
    }
}

// === API ===
async function fetchGenres() {
    const grid = document.getElementById('animeGrid');
    try {
        const res = await fetch(`${API_URL}/genres/anime`);
        const data = await res.json();
        grid.innerHTML = '';
        const popularGenres = data.data.filter(g => g.count > 100).slice(0, 18);
        popularGenres.forEach(genre => {
            const card = document.createElement('div');
            card.className = 'genre-card';
            card.innerHTML = `<i class='bx bx-hash'></i><span>${genre.name}</span><small style="color:#787A91">${genre.count}</small>`;
            card.onclick = () => {
                document.getElementById('sectionTitle').innerText = `Genre: ${genre.name}`;
                document.getElementById('backBtn').style.display = 'inline-block';
                fetchAnime(genre.mal_id, 'genre');
            };
            grid.appendChild(card);
        });
    } catch (e) { grid.innerHTML = '<p>Error loading genres</p>'; }
}

async function fetchAnime(query, mode = 'season') {
    const grid = (mode === 'top') ? document.getElementById('topChartsGrid') : document.getElementById('animeGrid');
    if (!grid) return;
    
    if (mode !== 'top') grid.innerHTML = '<p style="color:gray">Loading content...</p>';

    let url;
    if (mode === 'search') url = `${API_URL}/anime?q=${query}&limit=12&sfw=true`;
    else if (mode === 'season' && query === 'now') url = `${API_URL}/seasons/now?limit=8&sfw=true`;
    else if (mode === 'season' && query === 'bypopularity') url = `${API_URL}/top/anime?filter=bypopularity&limit=12`;
    else if (mode === 'top') url = `${API_URL}/top/anime?filter=upcoming&limit=4`;
    else if (mode === 'schedule') url = `${API_URL}/schedules?filter=${query}&limit=12`;
    else if (mode === 'genre') url = `${API_URL}/anime?genres=${query}&limit=12&order_by=score&sort=desc&sfw=true`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        renderCards(data.data, grid, mode === 'top');
    } catch (error) { console.error(error); }
}

function renderWatchlistGrid() {
    const grid = document.getElementById('animeGrid');
    grid.innerHTML = '';
    if (myWatchlist.length === 0) {
        grid.innerHTML = '<p>Your list is empty. Add some anime!</p>';
        return;
    }
    renderCards(myWatchlist, grid, false, true);
}

function renderCards(list, grid, isTopChart, isWatchlistMode = false) {
    grid.innerHTML = '';
    list.forEach((anime, index) => {
        const title = anime.title_english || anime.title;
        const img = anime.images?.jpg?.large_image_url || anime.image;
        const id = anime.mal_id || anime.id;
        
        const isAdded = myWatchlist.some(item => (item.mal_id || item.id) === id);
        const btnClass = isAdded ? 'add-btn added' : 'add-btn';
        const btnText = isAdded ? "<i class='bx bx-check-circle'></i> Added" : "<i class='bx bx-plus-circle'></i> Add";
        const btnColor = isAdded ? "#4ade80" : "#3B82F6";

        let numberBadge = isTopChart ? `<span style="position:absolute; bottom:10px; left:10px; font-size:60px; font-weight:800; color:rgba(255,255,255,0.15); line-height:1; z-index:1;">${index + 1}</span>` : '';

        const card = document.createElement('div');
        card.className = 'anime-card';
        card.onclick = () => openAnimeDetails(id); 

        card.innerHTML = `
            <div class="card-image-wrapper">
                <span class="live-tag">Live</span>
                ${numberBadge}
                <img src="${img}" onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
            </div>
            <h3>${title}</h3>
            <div class="card-footer">
                <span><i class='bx bx-show'></i> ${anime.score || 'N/A'}</span>
                <button class="${btnClass}" style="color: ${btnColor}" onclick='toggleWatchlist(event, ${JSON.stringify({id: id, title: title, image: img}).replace(/'/g, "&#39;")}, this)'>
                    ${btnText}
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// === MODAL ===
async function openAnimeDetails(id) {
    const modal = document.getElementById('modalOverlay');
    const body = document.getElementById('modalBody');
    modal.classList.add('open');
    body.innerHTML = '<p style="color:white; text-align:center; padding: 50px;">Loading details...</p>';

    try {
        const res = await fetch(`${API_URL}/anime/${id}/full`);
        const data = await res.json();
        const anime = data.data;

        let trailerHTML = anime.trailer?.embed_url ? 
            `<div class="trailer-container"><iframe src="${anime.trailer.embed_url}?autoplay=0" frameborder="0" allowfullscreen></iframe></div>` : 
            '<div style="padding:20px; text-align:center; color:gray; background:#111; border-radius:12px; margin-top:20px;">No Trailer Available</div>';

        body.innerHTML = `
            <div class="modal-header">
                <img src="${anime.images.jpg.large_image_url}" class="modal-poster">
                <div class="modal-info">
                    <h2 class="modal-title">${anime.title_english || anime.title}</h2>
                    <div class="modal-meta">
                        <span class="badge">${anime.year || 'Unknown'}</span>
                        <span class="badge">${anime.type}</span>
                        <span class="score-badge"><i class='bx bxs-star'></i> ${anime.score || 'N/A'}</span>
                        <span>${anime.episodes || '?'} eps</span>
                        <span>${anime.status}</span>
                    </div>
                    <p class="modal-desc">${anime.synopsis || 'No description available.'}</p>
                    <div style="margin-top: auto;">
                        <span style="color:#787A91">Genres: </span> 
                        ${anime.genres.map(g => `<span style="color:white; margin-right:5px;">${g.name}</span>`).join(', ')}
                    </div>
                </div>
            </div>
            ${trailerHTML}
        `;
    } catch (e) { body.innerHTML = '<p style="color:red; text-align:center;">Error loading details</p>'; }
}

function closeModal(event) {
    if (event === 'force' || event.target.id === 'modalOverlay') {
        const modal = document.getElementById('modalOverlay');
        const body = document.getElementById('modalBody');
        modal.classList.remove('open');
        setTimeout(() => body.innerHTML = '', 300);
    }
}

function toggleWatchlist(event, animeData, btn) {
    event.stopPropagation();
    const index = myWatchlist.findIndex(item => (item.mal_id || item.id) === animeData.id);

    if (index === -1) {
        myWatchlist.push(animeData);
        btn.innerHTML = "<i class='bx bx-check-circle'></i> Added";
        btn.classList.add('added');
        btn.style.color = "#4ade80";
        showToast("Added to Watch List!");
    } else {
        myWatchlist.splice(index, 1);
        btn.innerHTML = "<i class='bx bx-plus-circle'></i> Add";
        btn.classList.remove('added');
        btn.style.color = "#3B82F6";
        showToast("Removed from Watch List");
        
        const params = new URLSearchParams(window.location.search);
        if(params.get('view') === 'watchlist') {
            btn.closest('.anime-card').remove();
            if(myWatchlist.length === 0) document.getElementById('animeGrid').innerHTML = '<p>Your list is empty.</p>';
        }
    }
    localStorage.setItem('myWatchlist', JSON.stringify(myWatchlist));
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}