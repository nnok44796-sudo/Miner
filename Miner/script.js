// ===== КОНФИГУРАЦИЯ =====
const DIFFICULTY = {
    easy: { rows: 7, cols: 7, mines: 8, reward: 50 },
    medium: { rows: 14, cols: 14, mines: 35, reward: 150 },
    hard: { rows: 18, cols: 18, mines: 60, reward: 300 }
};

const SKINS = {
    flag: { classic: '🚩', crystal: '💎', fire: '🔥' },
    mine: { classic: '💣', toxic: '☣️', ice: '❄️' }
};

// ===== СОСТОЯНИЕ =====
let currentDifficulty = 'easy';
let currentTheme = 'classic';
let currentFlag = 'classic';
let currentMine = 'classic';
let board = [];
let revealed = [];
let flagged = [];
let gameActive = false;
let gameWon = false;
let gameStarted = false;
let firstClick = true;
let minesCount = 0;
let timer = 0;
let timerInterval = null;
let bestTimes = JSON.parse(localStorage.getItem('minesweeperBestTimes')) || { easy: null, medium: null, hard: null };

let coins = 0;
localStorage.setItem('minesweeperCoins', '0');
let ownedSkins = JSON.parse(localStorage.getItem('ownedSkins')) || {
    theme: ['classic'],
    flag: ['classic'],
    mine: ['classic']
};

let achievements = [
    { id: 'first_win', name: 'Первая победа', desc: 'Выиграть первую игру', icon: '🏆', points: 50, unlocked: false },
    { id: 'speedrunner', name: 'Спидраннер', desc: 'Выиграть меньше чем за 60 секунд', icon: '⚡', points: 100, unlocked: false },
    { id: 'mine_sweeper', name: 'Сапёр', desc: 'Обезвредить 50 мин', icon: '💣', points: 75, unlocked: false },
    { id: 'pro_player', name: 'Профессионал', desc: 'Выиграть на сложности Профи', icon: '👑', points: 200, unlocked: false },
    { id: 'collector', name: 'Коллекционер', desc: 'Купить 3 скина', icon: '🎨', points: 100, unlocked: false },
    { id: 'rich', name: 'Богач', desc: 'Накопить 1000 монет', icon: '💰', points: 150, unlocked: false }
];

const savedAchievements = localStorage.getItem('minesweeperAchievements');
if (savedAchievements) {
    const saved = JSON.parse(savedAchievements);
    achievements = achievements.map(a => ({ ...a, unlocked: saved.find(s => s.id === a.id)?.unlocked || false }));
}

let stats = {
    minesDefused: parseInt(localStorage.getItem('minesDefused')) || 0,
    gamesWon: parseInt(localStorage.getItem('gamesWon')) || 0,
    skinsBought: ownedSkins.theme.length + ownedSkins.flag.length + ownedSkins.mine.length - 3
};

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    initPreloader();
    initNavigation();
    initGame();
    initAchievements();
    initShop();
    updateCoinsDisplay();
    updateRewardDisplay();
    loadSelectedSkins();
    initTabs();

    console.log('💣 LEVEL Минёр загружен!');
});

function initPreloader() {
    const bar = document.getElementById('preloaderProgress');
    const status = document.getElementById('preloaderStatus');
    const tip = document.getElementById('preloaderTip');
    const tips = ['💡 Левая кнопка — открыть', '🚩 Правая кнопка — флаг', '🛒 Покупай скины', '🪙 Монеты за победы'];

    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setTimeout(() => {
                document.getElementById('preloader').style.opacity = '0';
                setTimeout(() => document.getElementById('preloader').style.display = 'none', 500);
                showToast('💣 Добро пожаловать в Минёр!', 'success');
            }, 300);
        }
        bar.style.width = progress + '%';
        status.textContent = `Загрузка... ${Math.floor(progress)}%`;
        if (Math.floor(progress) % 25 === 0) tip.textContent = tips[Math.floor(Math.random() * tips.length)];
    }, 100);
}

function initTabs() {
    document.querySelectorAll('.shop-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.shop-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });
}

function initNavigation() {
    document.querySelectorAll('[data-difficulty]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('[data-difficulty]').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            currentDifficulty = link.dataset.difficulty;
            updateRewardDisplay();
            newGame();
        });
    });
    document.getElementById('newGameBtn').addEventListener('click', newGame);
}

function initShop() {
    loadOwnedSkins();
    updateShopCoins();
}

function loadOwnedSkins() {
    document.querySelectorAll('[data-skin]').forEach(item => {
        const skin = item.dataset.skin;
        const type = item.dataset.type;
        if (ownedSkins[type]?.includes(skin)) {
            item.classList.remove('locked');
            const btn = item.querySelector('.btn-skin');
            btn.textContent = 'Выбрать';
            btn.className = 'btn-skin btn-select';
            btn.onclick = () => selectSkin(skin, type);
        }
    });
}

function updateShopCoins() {
    document.getElementById('shopCoinsCount').textContent = coins;
}

function buySkin(skin, type, price) {
    if (coins < price) { showToast('Недостаточно монет!', 'error'); return; }
    if (ownedSkins[type].includes(skin)) { showToast('У вас уже есть этот скин!', 'info'); return; }

    coins -= price;
    ownedSkins[type].push(skin);
    stats.skinsBought++;

    localStorage.setItem('minesweeperCoins', coins);
    localStorage.setItem('ownedSkins', JSON.stringify(ownedSkins));

    updateCoinsDisplay();
    updateShopCoins();
    loadOwnedSkins();

    showToast(`Скин "${getSkinName(skin)}" куплен!`, 'success');
    if (stats.skinsBought >= 3) unlockAchievement('collector');
}

function selectSkin(skin, type) {
    if (type === 'theme') currentTheme = skin;
    else if (type === 'flag') currentFlag = skin;
    else if (type === 'mine') currentMine = skin;

    localStorage.setItem('currentTheme', currentTheme);
    localStorage.setItem('currentFlag', currentFlag);
    localStorage.setItem('currentMine', currentMine);

    applyTheme();
    renderBoard();
    showToast(`Скин "${getSkinName(skin)}" выбран!`, 'success');
}

function loadSelectedSkins() {
    currentTheme = localStorage.getItem('currentTheme') || 'classic';
    currentFlag = localStorage.getItem('currentFlag') || 'classic';
    currentMine = localStorage.getItem('currentMine') || 'classic';
    applyTheme();
}

function applyTheme() {
    document.getElementById('gameBoardContainer').dataset.theme = currentTheme;
}

function getSkinName(skin) {
    const names = { classic: 'Классический', neon: 'Неоновый', forest: 'Лесной', sunset: 'Закатный', crystal: 'Кристальный', fire: 'Огненный', toxic: 'Токсичный', ice: 'Ледяной' };
    return names[skin] || skin;
}

function initGame() { newGame(); }

function newGame() {
    const diff = DIFFICULTY[currentDifficulty];
    board = Array(diff.rows).fill().map(() => Array(diff.cols).fill(0));
    revealed = Array(diff.rows).fill().map(() => Array(diff.cols).fill(false));
    flagged = Array(diff.rows).fill().map(() => Array(diff.cols).fill(false));

    minesCount = diff.mines;
    gameActive = true;
    gameWon = false;
    gameStarted = false;
    firstClick = true;

    clearInterval(timerInterval);
    timer = 0;
    updateTimer();
    updateMinesCount();
    renderBoard();
}

function placeMines(firstRow, firstCol) {
    const diff = DIFFICULTY[currentDifficulty];
    let placed = 0;
    const safeZone = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const nr = firstRow + dr, nc = firstCol + dc;
            if (nr >= 0 && nr < diff.rows && nc >= 0 && nc < diff.cols) safeZone.push(`${nr},${nc}`);
        }
    }

    while (placed < diff.mines) {
        const row = Math.floor(Math.random() * diff.rows), col = Math.floor(Math.random() * diff.cols);
        if (!safeZone.includes(`${row},${col}`) && board[row][col] !== '💣') {
            board[row][col] = '💣';
            placed++;
        }
    }

    for (let r = 0; r < diff.rows; r++) {
        for (let c = 0; c < diff.cols; c++) {
            if (board[r][c] !== '💣') {
                let count = 0;
                for (let dr = -1; dr <= 1; dr++)
                    for (let dc = -1; dc <= 1; dc++) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < diff.rows && nc >= 0 && nc < diff.cols && board[nr][nc] === '💣') count++;
                    }
                board[r][c] = count;
            }
        }
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (gameActive && !gameWon && gameStarted) { timer++; updateTimer(); }
    }, 1000);
}

function renderBoard() {
    const boardEl = document.getElementById('gameBoard');
    const diff = DIFFICULTY[currentDifficulty];
    boardEl.style.gridTemplateColumns = `repeat(${diff.cols}, var(--cell-size))`;
    boardEl.innerHTML = '';

    for (let r = 0; r < diff.rows; r++) {
        for (let c = 0; c < diff.cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;

            if (revealed[r][c]) {
                cell.classList.add('revealed');
                if (board[r][c] === '💣') {
                    cell.classList.add('mine');
                    cell.textContent = SKINS.mine[currentMine];
                } else if (board[r][c] > 0) {
                    cell.textContent = board[r][c];
                    cell.dataset.value = board[r][c];
                }
            } else if (flagged[r][c]) {
                cell.classList.add('flagged');
                cell.textContent = SKINS.flag[currentFlag];
            }

            cell.addEventListener('click', handleLeftClick);
            cell.addEventListener('contextmenu', handleRightClick);
            boardEl.appendChild(cell);
        }
    }
}

function handleLeftClick(e) {
    e.preventDefault();
    if (!gameActive || gameWon) return;
    const row = parseInt(e.target.dataset.row), col = parseInt(e.target.dataset.col);
    if (flagged[row][col] || revealed[row][col]) return;

    if (firstClick) { placeMines(row, col); firstClick = false; }
    if (!gameStarted) { gameStarted = true; startTimer(); }

    revealCell(row, col);
}

function handleRightClick(e) {
    e.preventDefault();
    if (!gameActive || gameWon) return;
    const row = parseInt(e.target.dataset.row), col = parseInt(e.target.dataset.col);
    if (revealed[row][col]) return;

    if (!gameStarted) { gameStarted = true; startTimer(); }

    flagged[row][col] = !flagged[row][col];
    minesCount += flagged[row][col] ? -1 : 1;
    updateMinesCount();
    renderBoard();
}

function revealCell(row, col) {
    const diff = DIFFICULTY[currentDifficulty];
    if (row < 0 || row >= diff.rows || col < 0 || col >= diff.cols) return;
    if (revealed[row][col] || flagged[row][col]) return;

    revealed[row][col] = true;

    if (board[row][col] === '💣') {
        gameActive = false; gameWon = false; gameStarted = false;
        clearInterval(timerInterval);

        for (let r = 0; r < diff.rows; r++)
            for (let c = 0; c < diff.cols; c++)
                if (board[r][c] === '💣') revealed[r][c] = true;

        renderBoard();
        showToast('💥 Вы взорвались! Попробуйте снова.', 'lose');
        return;
    }

    if (board[row][col] === 0) {
        for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++)
                revealCell(row + dr, col + dc);
    }

    renderBoard();
    checkWin();
}

function checkWin() {
    const diff = DIFFICULTY[currentDifficulty];
    let allSafeRevealed = true;
    for (let r = 0; r < diff.rows; r++)
        for (let c = 0; c < diff.cols; c++)
            if (board[r][c] !== '💣' && !revealed[r][c]) allSafeRevealed = false;

    if (allSafeRevealed) {
        gameActive = false; gameWon = true; gameStarted = false;
        clearInterval(timerInterval);

        stats.gamesWon++; stats.minesDefused += diff.mines;
        localStorage.setItem('gamesWon', stats.gamesWon);
        localStorage.setItem('minesDefused', stats.minesDefused);

        unlockAchievement('first_win');
        if (timer < 60) unlockAchievement('speedrunner');
        if (stats.minesDefused >= 50) unlockAchievement('mine_sweeper');
        if (currentDifficulty === 'hard') unlockAchievement('pro_player');
        if (coins >= 1000) unlockAchievement('rich');

        if (!bestTimes[currentDifficulty] || timer < bestTimes[currentDifficulty]) {
            bestTimes[currentDifficulty] = timer;
            localStorage.setItem('minesweeperBestTimes', JSON.stringify(bestTimes));
        }
        updateBestTime();

        addCoins(diff.reward);
        renderBoard();
        showToast(`🎉 Победа! +${diff.reward} монет! Время: ${timer}с`, 'win');
    }
}

function updateMinesCount() { document.getElementById('minesCount').textContent = minesCount; }
function updateTimer() { document.getElementById('timer').textContent = String(timer).padStart(3, '0'); }
function updateBestTime() { const best = bestTimes[currentDifficulty]; document.getElementById('bestTime').textContent = best ? String(best).padStart(3, '0') : '---'; }
function updateRewardDisplay() { document.getElementById('rewardAmount').textContent = DIFFICULTY[currentDifficulty].reward; }
function updateCoinsDisplay() {
    document.getElementById('coinsCount').textContent = coins;
    document.getElementById('shopCoinsCount').textContent = coins;
}

function addCoins(amount) {
    coins += amount;
    localStorage.setItem('minesweeperCoins', coins);
    updateCoinsDisplay();
    if (coins >= 1000) unlockAchievement('rich');

    const coinEl = document.createElement('div');
    coinEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:60px;animation:coinFloat 1.5s ease forwards;pointer-events:none;z-index:9999;';
    coinEl.innerHTML = `🪙 +${amount}`;
    document.body.appendChild(coinEl);
    setTimeout(() => coinEl.remove(), 1500);
}

function initAchievements() {
    updateAchievementsUI();
    const btn = document.getElementById('achievementsBtn'), modal = document.getElementById('achievementsModal');
    btn.addEventListener('click', () => modal.classList.add('active'));
    modal.querySelector('.modal-close').addEventListener('click', () => modal.classList.remove('active'));
    modal.querySelector('.modal-overlay').addEventListener('click', () => modal.classList.remove('active'));
    updateBestTime();
}

function unlockAchievement(id) {
    const a = achievements.find(x => x.id === id);
    if (a && !a.unlocked) {
        a.unlocked = true;
        localStorage.setItem('minesweeperAchievements', JSON.stringify(achievements));
        updateAchievementsUI();
        showToast(`🏆 ${a.name} +${a.points} XP`, 'success');
    }
}

function updateAchievementsUI() {
    const unlocked = achievements.filter(a => a.unlocked).length;
    document.getElementById('achievementCount').textContent = unlocked;
    const fill = document.getElementById('achievementProgressFill'), text = document.getElementById('achievementProgressText');
    if (fill) { fill.style.width = (unlocked / achievements.length * 100) + '%'; text.textContent = `${unlocked}/${achievements.length} достижений`; }

    const grid = document.getElementById('achievementsGrid');
    if (grid) {
        grid.innerHTML = achievements.map(a => `
            <div class="achievement-item ${a.unlocked ? '' : 'locked'}">
                <div class="achievement-icon">${a.icon}</div>
                <div class="achievement-info"><h4>${a.name}</h4><p>${a.desc}</p><div class="achievement-points">+${a.points} XP</div></div>
                ${a.unlocked ? '<div class="achievement-check"><i class="fas fa-check-circle"></i></div>' : '<div class="achievement-lock"><i class="fas fa-lock"></i></div>'}
            </div>
        `).join('');
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️', win: '🎉', lose: '💥' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(-100%)'; setTimeout(() => toast.remove(), 300); }, 4000);
}

const style = document.createElement('style');
style.textContent = `.cell.flagged { font-size: 18px; } @keyframes coinFloat { 0% { opacity:1; transform:translate(-50%,-50%) scale(1); } 100% { opacity:0; transform:translate(-50%,-200px) scale(0.5); } }`;
document.head.appendChild(style);