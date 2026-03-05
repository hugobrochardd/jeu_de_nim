/**
 * Jeu de NIM - Logique principale du jeu
 * Gestion multi-écrans, profil cookies, sauvegarde, reprise, online
 * Version Misère : le joueur qui prend le dernier objet PERD
 */

class NimGame {
    constructor() {
        // État du jeu
        this.state = {
            objects: 15,
            initialObjects: 15,
            currentPlayer: 1,
            isGameOver: false,
            winner: null,
            selectedAmount: 0,
            moveHistory: [] // historique des coups: [{player, amount, remaining}]
        };
        
        // Configuration
        this.config = {
            mode: 'solo',
            difficulty: 'hard',
            player1: { name: 'Joueur', color: '#ff9500' },
            player2: { name: 'Ordinateur', color: '#007aff' }
        };
        
        // Profil utilisateur (stocké en cookies)
        this.profile = {
            name: 'Joueur',
            color: '#ff9500',
            wins: 0,
            losses: 0,
            games: 0,
            savedGames: []
        };
        
        // ID de la partie en cours (pour éviter les doublons de sauvegarde)
        this.currentGameId = null;
        
        // AI
        this.ai = null;
        
        // Online
        this.isOnline = false;
        this.roomCode = null;
        
        // Éléments DOM
        this.screens = {};
        this.elements = {};
        
        // Initialisation
        this.init();
    }
    
    init() {
        this.cacheElements();
        this.loadProfile();
        this.bindEvents();
        this.showScreen('home');
        this.initFirebase();
        console.log('🎮 Jeu de NIM initialisé');
    }
    
    // ========================================
    // COOKIES MANAGEMENT
    // ========================================
    
    setCookie(name, value, days = 365) {
        const expires = new Date(Date.now() + days * 864e5).toUTCString();
        const encoded = encodeURIComponent(JSON.stringify(value));
        document.cookie = `nim_${name}=${encoded}; expires=${expires}; path=/; SameSite=Lax`;
    }
    
    getCookie(name) {
        const match = document.cookie.match(new RegExp('(?:^|; )nim_' + name + '=([^;]*)'));
        if (match) {
            try {
                return JSON.parse(decodeURIComponent(match[1]));
            } catch (e) {
                return null;
            }
        }
        return null;
    }
    
    // ========================================
    // PROFILE MANAGEMENT (Cookies)
    // ========================================
    
    loadProfile() {
        const saved = this.getCookie('profile');
        if (saved) {
            this.profile = { ...this.profile, ...saved };
        }
        // S'assurer que savedGames est un tableau
        if (!Array.isArray(this.profile.savedGames)) {
            this.profile.savedGames = [];
        }
    }
    
    saveProfile() {
        this.setCookie('profile', this.profile);
    }
    
    // ========================================
    // DOM CACHE
    // ========================================
    
    cacheElements() {
        // Screens
        this.screens = {
            home: document.getElementById('home-screen'),
            difficulty: document.getElementById('difficulty-screen'),
            playerSetup: document.getElementById('player-setup-screen'),
            multiSetup: document.getElementById('multi-setup-screen'),
            onlineMenu: document.getElementById('online-menu-screen'),
            createGame: document.getElementById('create-game-screen'),
            waiting: document.getElementById('waiting-screen'),
            lobby: document.getElementById('lobby-screen'),
            profile: document.getElementById('profile-screen'),
            game: document.getElementById('game-screen'),
            end: document.getElementById('end-screen')
        };
        
        // Éléments
        this.elements = {
            // Difficulty
            difficultyCards: document.querySelectorAll('.difficulty-card'),
            
            // Player setup
            playerNameInput: document.getElementById('solo-player-name'),
            playerColorPicker: document.getElementById('solo-color-picker'),
            
            // Multi setup
            player1NameInput: document.getElementById('multi-player1-name'),
            player1ColorPicker: document.getElementById('multi-player1-color'),
            player2NameInput: document.getElementById('multi-player2-name'),
            player2ColorPicker: document.getElementById('multi-player2-color'),
            
            // Online
            onlinePlayerName: document.getElementById('online-player-name'),
            onlineColorPicker: document.getElementById('online-color-picker'),
            joinPlayerName: document.getElementById('join-player-name'),
            joinColorPicker: document.getElementById('join-color-picker'),
            roomNameDisplay: document.getElementById('display-room-name'),
            roomCodeDisplay: document.getElementById('display-room-code'),
            gamesList: document.getElementById('games-list'),
            
            // Profile
            profileNameInput: document.getElementById('profile-name-input'),
            profileColorPicker: document.getElementById('profile-color-picker'),
            statGamesPlayed: document.getElementById('stat-games-played'),
            statGamesWon: document.getElementById('stat-games-won'),
            statGamesLost: document.getElementById('stat-games-lost'),
            statWinRate: document.getElementById('stat-win-rate'),
            savedGamesList: document.getElementById('saved-games-list'),
            
            // Game
            objectsDisplay: document.getElementById('objects-display'),
            objectsCount: document.getElementById('remaining-count'),
            turnInfo: document.getElementById('current-player-name'),
            player1Card: document.getElementById('player1-card'),
            player2Card: document.getElementById('player2-card'),
            player1Avatar: document.getElementById('player1-avatar'),
            player2Avatar: document.getElementById('player2-avatar'),
            player1Name: document.getElementById('player1-name'),
            player2Name: document.getElementById('player2-name'),
            takeButtons: document.querySelectorAll('.take-btn'),
            confirmBtn: document.getElementById('confirm-move-btn'),
            statusBar: document.getElementById('status-bar'),
            saveGameBtn: document.getElementById('btn-save-game'),
            
            // End
            endTitle: document.getElementById('end-title'),
            endResult: document.getElementById('end-result'),
            saveResultBtn: document.getElementById('btn-save-result')
        };
    }
    
    bindEvents() {
        // Navigation home
        document.getElementById('btn-single-player')?.addEventListener('click', () => this.showScreen('difficulty'));
        document.getElementById('btn-multiplayer')?.addEventListener('click', () => this.showScreen('multiSetup'));
        document.getElementById('btn-online')?.addEventListener('click', () => this.showScreen('onlineMenu'));
        document.getElementById('btn-profile')?.addEventListener('click', () => this.showProfile());
        
        // Back buttons
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => this.goBack());
        });
        
        // Difficulty selection
        this.elements.difficultyCards?.forEach(card => {
            card.addEventListener('click', () => this.selectDifficulty(card));
        });
        
        document.getElementById('btn-confirm-difficulty')?.addEventListener('click', () => this.showScreen('playerSetup'));
        document.getElementById('btn-start-solo')?.addEventListener('click', () => this.startSoloGame());
        document.getElementById('btn-start-multi')?.addEventListener('click', () => this.startMultiGame());
        
        // Online
        document.getElementById('btn-create-game')?.addEventListener('click', () => this.showScreen('createGame'));
        document.getElementById('btn-join-game')?.addEventListener('click', () => this.showLobby());
        document.getElementById('btn-create-room')?.addEventListener('click', () => this.createOnlineGame());
        document.getElementById('btn-cancel-room')?.addEventListener('click', () => this.cancelWaiting());
        
        // Profile
        document.getElementById('btn-save-profile')?.addEventListener('click', () => this.saveProfileFromForm());
        
        // Color pickers
        document.querySelectorAll('.color-picker').forEach(picker => {
            picker.querySelectorAll('.color-option').forEach(option => {
                option.addEventListener('click', (e) => this.selectColor(e.target, picker));
            });
        });
        
        // Game actions
        this.elements.takeButtons?.forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = parseInt(btn.dataset.amount);
                this.selectAmount(amount);
            });
        });
        
        this.elements.confirmBtn?.addEventListener('click', () => this.confirmMove());
        
        // Save & Quit (en cours de partie solo/multi uniquement)
        document.getElementById('btn-save-game')?.addEventListener('click', () => this.saveAndQuit());
        document.getElementById('btn-quit-game')?.addEventListener('click', () => this.quitGame());
        
        // End actions
        document.getElementById('btn-replay')?.addEventListener('click', () => this.replay());
        document.getElementById('btn-end-menu')?.addEventListener('click', () => this.showScreen('home'));
        document.getElementById('btn-save-result')?.addEventListener('click', () => this.saveEndGame());
    }
    
    initFirebase() {
        const firebaseConfig = {
            apiKey: "AIzaSyCDUVy0k9YiocQamccT78P5v5Ovau1S-dk",
            authDomain: "jeudenim.firebaseapp.com",
            databaseURL: "https://jeudenim-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "jeudenim",
            storageBucket: "jeudenim.firebasestorage.app",
            messagingSenderId: "936803163967",
            appId: "1:936803163967:web:ab414a3d7ec2f6a38fcd1b",
            measurementId: "G-K1VZC1FMJM"
        };
        
        if (typeof firebase !== 'undefined' && !firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('🔥 Firebase initialisé');
        }
    }
    
    // ========================================
    // PRE-FILL FORMS WITH PROFILE DATA
    // ========================================
    
    prefillForms() {
        const name = this.profile.name || 'Joueur';
        const color = this.profile.color || '#ff9500';
        
        // Solo setup
        if (this.elements.playerNameInput) this.elements.playerNameInput.value = name;
        this.preselectColor(this.elements.playerColorPicker, color);
        
        // Multi setup - player 1 = moi
        if (this.elements.player1NameInput) this.elements.player1NameInput.value = name;
        this.preselectColor(this.elements.player1ColorPicker, color);
        
        // Online create
        if (this.elements.onlinePlayerName) this.elements.onlinePlayerName.value = name;
        this.preselectColor(this.elements.onlineColorPicker, color);
        
        // Online join
        if (this.elements.joinPlayerName) this.elements.joinPlayerName.value = name;
        this.preselectColor(this.elements.joinColorPicker, color);
        
        // Profile form
        if (this.elements.profileNameInput) this.elements.profileNameInput.value = name;
        this.preselectColor(this.elements.profileColorPicker, color);
    }
    
    preselectColor(picker, color) {
        if (!picker) return;
        picker.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.color === color);
        });
        // Si aucune correspondance, sélectionner la première
        if (!picker.querySelector('.color-option.selected')) {
            const first = picker.querySelector('.color-option');
            if (first) first.classList.add('selected');
        }
    }
    
    // ========================================
    // NAVIGATION
    // ========================================
    
    showScreen(screenId) {
        Object.values(this.screens).forEach(screen => {
            if (screen) screen.classList.remove('active');
        });
        
        if (this.screens[screenId]) {
            this.screens[screenId].classList.add('active');
        }
        
        this.currentScreen = screenId;
        
        // Pre-fill forms quand on navigue vers un écran de config
        if (['playerSetup', 'multiSetup', 'createGame', 'lobby', 'profile'].includes(screenId)) {
            this.prefillForms();
        }
    }
    
    goBack() {
        const backMap = {
            difficulty: 'home',
            playerSetup: 'difficulty',
            multiSetup: 'home',
            onlineMenu: 'home',
            createGame: 'onlineMenu',
            waiting: 'onlineMenu',
            lobby: 'onlineMenu',
            profile: 'home',
            game: 'home',
            end: 'home'
        };
        
        if (this.currentScreen === 'waiting' && window.onlineManager) {
            window.onlineManager.leaveRoom();
        }
        
        const target = backMap[this.currentScreen] || 'home';
        this.showScreen(target);
    }
    
    // ========================================
    // DIFFICULTY SELECTION
    // ========================================
    
    selectDifficulty(card) {
        this.elements.difficultyCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.config.difficulty = card.dataset.difficulty;
    }
    
    // ========================================
    // COLOR SELECTION
    // ========================================
    
    selectColor(option, picker) {
        picker.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
    }
    
    getSelectedColor(picker) {
        const selected = picker?.querySelector('.color-option.selected');
        return selected ? selected.dataset.color : '#ff9500';
    }
    
    // ========================================
    // PROFILE FORM SAVE
    // ========================================
    
    saveProfileFromForm() {
        const name = this.elements.profileNameInput?.value.trim() || 'Joueur';
        const color = this.getSelectedColor(this.elements.profileColorPicker);
        
        this.profile.name = name;
        this.profile.color = color;
        this.saveProfile();
        
        this.showProfileStatus('Profil sauvegardé !', 'success');
    }
    
    showProfileStatus(msg, type) {
        const btn = document.getElementById('btn-save-profile');
        if (!btn) return;
        const oldText = btn.textContent;
        btn.textContent = '✅ ' + msg;
        btn.classList.add(type);
        setTimeout(() => {
            btn.textContent = oldText;
            btn.classList.remove(type);
        }, 2000);
    }
    
    // ========================================
    // SOLO GAME
    // ========================================
    
    startSoloGame() {
        const name = this.elements.playerNameInput?.value.trim() || 'Joueur';
        const color = this.getSelectedColor(this.elements.playerColorPicker);
        
        this.config.mode = 'solo';
        this.config.player1 = { name, color };
        this.config.player2 = { name: 'Ordinateur', color: '#5856d6' };
        
        this.ai = new NimAI(this.config.difficulty);
        this.currentGameId = null; // nouvelle partie
        this.startGame();
    }
    
    // ========================================
    // MULTI GAME
    // ========================================
    
    startMultiGame() {
        const name1 = this.elements.player1NameInput?.value.trim() || 'Joueur 1';
        const color1 = this.getSelectedColor(this.elements.player1ColorPicker);
        const name2 = this.elements.player2NameInput?.value.trim() || 'Joueur 2';
        const color2 = this.getSelectedColor(this.elements.player2ColorPicker);
        
        this.config.mode = 'multi';
        this.config.player1 = { name: name1, color: color1 };
        this.config.player2 = { name: name2, color: color2 };
        
        this.ai = null;
        this.currentGameId = null;
        this.startGame();
    }
    
    // ========================================
    // ONLINE GAME
    // ========================================
    
    async createOnlineGame() {
        const name = this.elements.onlinePlayerName?.value.trim() || 'Joueur';
        const color = this.getSelectedColor(this.elements.onlineColorPicker);
        
        if (!window.onlineManager) {
            this.showStatus('Erreur: mode online non disponible', 'error');
            return;
        }
        
        try {
            const roomCode = await window.onlineManager.createRoom(name, color, 15);
            
            if (this.elements.roomNameDisplay) {
                this.elements.roomNameDisplay.textContent = name;
            }
            if (this.elements.roomCodeDisplay) {
                this.elements.roomCodeDisplay.textContent = roomCode;
            }
            
            this.config.mode = 'online';
            this.config.player1 = { name, color };
            this.isOnline = true;
            this.roomCode = roomCode;
            
            window.onlineManager.onGameStart = (room) => {
                this.config.player2 = { 
                    name: room.guest.name, 
                    color: room.guest.color 
                };
                this.startOnlineGame(room);
            };
            
            window.onlineManager.onOpponentLeft = () => {
                this.showStatus('Adversaire déconnecté', 'error');
                setTimeout(() => this.showScreen('home'), 2000);
            };
            
            this.showScreen('waiting');
        } catch (error) {
            console.error('Erreur création room:', error);
            this.showStatus('Erreur création partie', 'error');
        }
    }
    
    async showLobby() {
        this.showScreen('lobby');
        this.refreshGamesList();
        
        if (window.onlineManager) {
            window.onlineManager.listenToRoomsList((rooms) => {
                this.displayGamesList(rooms);
            });
        }
    }
    
    async refreshGamesList() {
        if (!window.onlineManager) return;
        
        this.elements.gamesList.innerHTML = '<p class="loading-msg">Chargement...</p>';
        
        try {
            const rooms = await window.onlineManager.getAvailableRooms();
            this.displayGamesList(rooms);
        } catch (error) {
            console.error('Erreur liste rooms:', error);
            this.elements.gamesList.innerHTML = '<p class="empty-msg">Erreur de chargement</p>';
        }
    }
    
    displayGamesList(rooms) {
        if (rooms.length === 0) {
            this.elements.gamesList.innerHTML = '<p class="empty-msg">Aucune partie disponible</p>';
            return;
        }
        
        this.elements.gamesList.innerHTML = rooms.map(room => `
            <div class="game-item" data-code="${room.code}">
                <div class="game-item-info">
                    <span class="game-item-name">Partie de ${room.hostName}</span>
                    <span class="game-item-host">${room.objects} objets</span>
                </div>
                <button class="join-btn">Rejoindre</button>
            </div>
        `).join('');
        
        this.elements.gamesList.querySelectorAll('.game-item').forEach(item => {
            item.querySelector('.join-btn').addEventListener('click', () => {
                this.joinOnlineGame(item.dataset.code);
            });
        });
    }
    
    async joinOnlineGame(roomCode) {
        const name = this.elements.joinPlayerName?.value.trim() || this.elements.onlinePlayerName?.value.trim() || 'Joueur';
        const color = this.getSelectedColor(this.elements.joinColorPicker) || this.getSelectedColor(this.elements.onlineColorPicker);
        
        if (!window.onlineManager) return;
        
        try {
            const room = await window.onlineManager.joinRoom(roomCode, name, color);
            
            this.config.mode = 'online';
            this.config.player1 = { name, color };
            this.config.player2 = { name: room.host.name, color: room.host.color };
            this.isOnline = true;
            this.roomCode = roomCode;
            
            window.onlineManager.onOpponentLeft = () => {
                this.showStatus('Adversaire déconnecté', 'error');
                setTimeout(() => this.showScreen('home'), 2000);
            };
            
            this.startOnlineGame(room);
        } catch (error) {
            console.error('Erreur join room:', error);
            this.showStatus(error.message || 'Erreur connexion', 'error');
        }
    }
    
    startOnlineGame(room) {
        console.log('🌐 startOnlineGame', room);
        
        if (window.onlineManager) {
            window.onlineManager.onOpponentMove = (count, remaining) => {
                console.log('🌐 onOpponentMove:', count, remaining);
                this.handleOpponentMove(count, remaining);
            };
            
            window.onlineManager.onGameEnd = (winner) => {
                console.log('🌐 onGameEnd Firebase winner:', winner);
                const didIWin = winner === window.onlineManager.playerNumber;
                this.state.winner = didIWin ? 1 : 2;
                this.endGame();
            };
        }
        
        this.currentGameId = null;
        this.startGame();
        
        this.state.objects = room.game.objects;
        this.state.initialObjects = room.game.initialObjects;
        
        const firebaseCurrentPlayer = room.game.currentPlayer;
        const myPlayerNumber = window.onlineManager.playerNumber;
        this.state.currentPlayer = firebaseCurrentPlayer === myPlayerNumber ? 1 : 2;
        
        this.renderObjects();
        this.updateUI();
    }
    
    handleOpponentMove(count, remaining) {
        this.state.objects = remaining;
        this.state.moveHistory.push({
            player: 2,
            amount: count,
            remaining: remaining
        });
        
        this.renderObjects();
        
        if (remaining === 0) {
            this.state.winner = 1;
            setTimeout(() => this.endGame(), 500);
        } else {
            this.state.currentPlayer = 1;
            this.updateUI();
        }
    }
    
    cancelWaiting() {
        if (window.onlineManager) {
            window.onlineManager.leaveRoom();
        }
        this.showScreen('onlineMenu');
    }
    
    // ========================================
    // GAME LOGIC
    // ========================================
    
    startGame() {
        this.state = {
            objects: 15,
            initialObjects: 15,
            currentPlayer: 1,
            isGameOver: false,
            winner: null,
            selectedAmount: 0,
            moveHistory: [],
            startTime: Date.now()
        };
        
        // Afficher/masquer le bouton sauvegarder selon le mode
        if (this.elements.saveGameBtn) {
            this.elements.saveGameBtn.style.display = 
                (this.config.mode === 'online') ? 'none' : 'inline-flex';
        }
        
        this.setupGameUI();
        this.showScreen('game');
        this.updateUI();
    }
    
    setupGameUI() {
        if (this.elements.player1Name) {
            this.elements.player1Name.textContent = this.config.player1.name;
        }
        if (this.elements.player2Name) {
            this.elements.player2Name.textContent = this.config.player2.name;
        }
        
        if (this.elements.player1Avatar) {
            this.elements.player1Avatar.textContent = this.config.player1.name.charAt(0).toUpperCase();
            this.elements.player1Avatar.style.backgroundColor = this.config.player1.color;
        }
        if (this.elements.player2Avatar) {
            this.elements.player2Avatar.textContent = this.config.player2.name.charAt(0).toUpperCase();
            this.elements.player2Avatar.style.backgroundColor = this.config.player2.color;
        }
        
        this.updatePlayerColor();
        this.renderObjects();
    }
    
    updatePlayerColor() {
        const currentPlayerConfig = this.state.currentPlayer === 1 ? this.config.player1 : this.config.player2;
        document.documentElement.style.setProperty('--player-color', currentPlayerConfig.color);
    }
    
    renderObjects() {
        if (!this.elements.objectsDisplay) return;
        
        this.elements.objectsDisplay.innerHTML = '';
        for (let i = 0; i < this.state.objects; i++) {
            const obj = document.createElement('div');
            obj.className = 'object-item';
            obj.dataset.index = i;
            this.elements.objectsDisplay.appendChild(obj);
        }
    }
    
    updateObjectsDisplay(removedCount = 0) {
        const objects = this.elements.objectsDisplay?.querySelectorAll('.object-item');
        if (!objects) return;
        
        const startIndex = this.state.objects;
        for (let i = startIndex; i < startIndex + removedCount; i++) {
            if (objects[i]) {
                objects[i].classList.add('removing');
            }
        }
        
        setTimeout(() => {
            this.renderObjects();
            this.updatePreview();
        }, 300);
    }
    
    updateUI() {
        if (this.elements.objectsCount) {
            this.elements.objectsCount.textContent = this.state.objects;
        }
        
        const currentPlayerConfig = this.state.currentPlayer === 1 ? this.config.player1 : this.config.player2;
        if (this.elements.turnInfo) {
            this.elements.turnInfo.textContent = currentPlayerConfig.name;
        }
        
        this.elements.player1Card?.classList.toggle('active', this.state.currentPlayer === 1);
        this.elements.player2Card?.classList.toggle('active', this.state.currentPlayer === 2);
        
        this.updatePlayerColor();
        
        this.elements.takeButtons?.forEach(btn => {
            const amount = parseInt(btn.dataset.amount);
            btn.disabled = amount > this.state.objects;
            btn.classList.remove('selected');
        });
        
        if (this.elements.confirmBtn) {
            this.elements.confirmBtn.setAttribute('disabled', 'disabled');
        }
        
        this.state.selectedAmount = 0;
        
        const isAITurn = this.config.mode === 'solo' && this.state.currentPlayer === 2;
        const isWaitingOpponent = this.config.mode === 'online' && this.state.currentPlayer === 2;
        
        const canPlay = !isAITurn && !isWaitingOpponent && !this.state.isGameOver;
        this.elements.takeButtons?.forEach(btn => {
            if (canPlay) {
                btn.disabled = parseInt(btn.dataset.amount) > this.state.objects;
            } else {
                btn.disabled = true;
            }
        });
        
        if (isAITurn) {
            this.showStatus("L'ordinateur réfléchit...", 'info');
            setTimeout(() => this.playAI(), 1000);
        } else if (isWaitingOpponent) {
            this.showStatus("En attente de l'adversaire...", 'info');
        } else {
            this.showStatus(`${currentPlayerConfig.name}, à vous de jouer!`, 'warning');
        }
    }
    
    selectAmount(amount) {
        if (amount > this.state.objects) return;
        
        this.elements.takeButtons?.forEach(btn => {
            const btnAmount = parseInt(btn.dataset.amount);
            btn.classList.toggle('selected', btnAmount === amount);
        });
        
        this.state.selectedAmount = amount;
        
        const confirmBtn = document.getElementById('confirm-move-btn');
        if (confirmBtn) {
            confirmBtn.removeAttribute('disabled');
            confirmBtn.classList.remove('disabled');
        }
        
        this.updatePreview();
    }
    
    updatePreview() {
        const objects = this.elements.objectsDisplay?.querySelectorAll('.object-item');
        if (!objects) return;
        
        objects.forEach(obj => obj.classList.remove('preview'));
        
        if (this.state.selectedAmount > 0) {
            const startIndex = this.state.objects - this.state.selectedAmount;
            for (let i = startIndex; i < this.state.objects; i++) {
                if (objects[i]) {
                    objects[i].classList.add('preview');
                }
            }
        }
    }
    
    async confirmMove() {
        if (this.state.selectedAmount === 0) return;
        
        const amount = this.state.selectedAmount;
        this.state.objects -= amount;
        
        // Historique du coup
        this.state.moveHistory.push({
            player: this.state.currentPlayer,
            amount: amount,
            remaining: this.state.objects
        });
        
        // Si online, envoyer le coup
        if (this.config.mode === 'online' && window.onlineManager) {
            try {
                await window.onlineManager.makeMove(amount);
            } catch (error) {
                console.error('Erreur envoi coup:', error);
                this.showStatus('Erreur envoi coup', 'error');
                return;
            }
        }
        
        this.updateObjectsDisplay(amount);
        
        if (this.state.objects === 0) {
            if (this.config.mode === 'online') {
                this.state.winner = 2;
            } else {
                this.state.winner = this.state.currentPlayer === 1 ? 2 : 1;
            }
            setTimeout(() => this.endGame(), 500);
            return;
        }
        
        if (this.config.mode === 'online') {
            this.state.currentPlayer = 2;
        } else {
            this.state.currentPlayer = this.state.currentPlayer === 1 ? 2 : 1;
        }
        
        setTimeout(() => this.updateUI(), 350);
    }
    
    playAI() {
        if (!this.ai || this.state.isGameOver) return;
        
        const move = this.ai.chooseMove({ remaining: this.state.objects });
        
        // Show preview of AI's chosen balls before removing
        const objects = this.elements.objectsDisplay?.querySelectorAll('.object-item');
        if (objects) {
            objects.forEach(obj => obj.classList.remove('preview'));
            const startIndex = this.state.objects - move;
            for (let i = startIndex; i < this.state.objects; i++) {
                if (objects[i]) objects[i].classList.add('preview');
            }
        }
        
        // Wait to let player see the preview, then remove
        setTimeout(() => {
            if (objects) objects.forEach(obj => obj.classList.remove('preview'));
            
            this.state.objects -= move;
            
            this.state.moveHistory.push({
                player: 2,
                amount: move,
                remaining: this.state.objects
            });
            
            this.updateObjectsDisplay(move);
            
            if (this.state.objects === 0) {
                this.state.winner = 1;
                
                if (this.ai) {
                    this.ai.notifyGameEnd(false);
                }
                
                setTimeout(() => this.endGame(), 500);
                return;
            }
            
            this.state.currentPlayer = 1;
            setTimeout(() => this.updateUI(), 350);
        }, 800);
    }
    
    // ========================================
    // END GAME
    // ========================================
    
    endGame() {
        if (this.state.isGameOver) return;
        this.state.isGameOver = true;
        this.state.endTime = Date.now();
        
        const winner = this.state.winner === 1 ? this.config.player1 : this.config.player2;
        const loser = this.state.winner === 1 ? this.config.player2 : this.config.player1;
        
        // Mettre à jour les stats (solo et multi seulement pour le joueur 1)
        if (this.config.mode !== 'online') {
            this.profile.games++;
            if (this.state.winner === 1) {
                this.profile.wins++;
            } else {
                this.profile.losses++;
            }
            this.saveProfile();
        }
        
        if (this.config.mode === 'solo' && this.ai) {
            this.ai.notifyGameEnd(this.state.winner === 2);
        }
        
        // Si c'est une partie reprise depuis le profil, mettre à jour automatiquement
        if (this.currentGameId) {
            const idx = this.profile.savedGames.findIndex(g => g.id === this.currentGameId);
            if (idx !== -1) {
                this.profile.savedGames[idx] = this.buildGameData(true);
                this.saveProfile();
            }
        }
        
        if (this.elements.endTitle) {
            this.elements.endTitle.textContent = '🎉 Partie terminée!';
        }
        if (this.elements.endResult) {
            this.elements.endResult.innerHTML = `
                <span class="winner">${winner.name}</span> remporte la partie!<br>
                <span class="loser">${loser.name}</span> a pris le dernier objet.
            `;
        }
        
        // Activer/désactiver bouton sauvegarder
        if (this.elements.saveResultBtn) {
            if (this.currentGameId) {
                // Partie déjà sauvegardée et mise à jour automatiquement
                this.elements.saveResultBtn.disabled = true;
                this.elements.saveResultBtn.textContent = '✅ Déjà sauvegardé';
            } else {
                this.elements.saveResultBtn.disabled = false;
                this.elements.saveResultBtn.textContent = '💾 Sauvegarder';
            }
        }
        
        this.showScreen('end');
    }
    
    replay() {
        this.currentGameId = null;
        this.startGame();
    }
    
    // ========================================
    // QUIT GAME
    // ========================================
    
    quitGame() {
        if (this.config.mode === 'online' && window.onlineManager) {
            window.onlineManager.leaveRoom();
        }
        this.showScreen('home');
    }
    
    // ========================================
    // SAVE & QUIT (mid-game, solo/multi only)
    // ========================================
    
    saveAndQuit() {
        if (this.config.mode === 'online') return;
        
        const gameData = this.buildGameData(false); // non terminée
        
        if (this.currentGameId) {
            // Mettre à jour la partie existante
            const idx = this.profile.savedGames.findIndex(g => g.id === this.currentGameId);
            if (idx !== -1) {
                this.profile.savedGames[idx] = gameData;
            } else {
                this.profile.savedGames.unshift(gameData);
            }
        } else {
            this.currentGameId = gameData.id;
            this.profile.savedGames.unshift(gameData);
        }
        
        // Garder max 20 parties
        this.profile.savedGames = this.profile.savedGames.slice(0, 20);
        this.saveProfile();
        
        this.showScreen('home');
    }
    
    // ========================================
    // SAVE END GAME (from end screen)
    // ========================================
    
    saveEndGame() {
        const gameData = this.buildGameData(true); // terminée
        
        if (this.currentGameId) {
            // Partie déjà sauvegardée (reprise) → mettre à jour
            const idx = this.profile.savedGames.findIndex(g => g.id === this.currentGameId);
            if (idx !== -1) {
                this.profile.savedGames[idx] = gameData;
            } else {
                this.profile.savedGames.unshift(gameData);
            }
        } else {
            this.currentGameId = gameData.id;
            this.profile.savedGames.unshift(gameData);
        }
        
        this.profile.savedGames = this.profile.savedGames.slice(0, 20);
        this.saveProfile();
        
        // Rediriger vers le profil
        this.showProfile();
    }
    
    buildGameData(completed) {
        const id = this.currentGameId || ('game_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
        
        return {
            id: id,
            date: Date.now(),
            startTime: this.state.startTime || Date.now(),
            endTime: completed ? (this.state.endTime || Date.now()) : null,
            completed: completed,
            mode: this.config.mode,
            difficulty: this.config.difficulty,
            player1: { ...this.config.player1 },
            player2: { ...this.config.player2 },
            initialObjects: this.state.initialObjects,
            remainingObjects: this.state.objects,
            currentPlayer: this.state.currentPlayer,
            winner: completed ? this.state.winner : null,
            won: completed ? (this.state.winner === 1) : null,
            totalMoves: this.state.moveHistory.length,
            moveHistory: [...this.state.moveHistory]
        };
    }
    
    isGameAlreadySaved(gameId) {
        return this.profile.savedGames.some(g => g.id === gameId);
    }
    
    // ========================================
    // RESUME GAME
    // ========================================
    
    resumeGame(gameId) {
        const game = this.profile.savedGames.find(g => g.id === gameId);
        if (!game || game.completed) return;
        
        // Restaurer la config
        this.config.mode = game.mode;
        this.config.difficulty = game.difficulty;
        this.config.player1 = { ...game.player1 };
        this.config.player2 = { ...game.player2 };
        this.currentGameId = game.id;
        
        // Recréer l'IA si solo
        if (game.mode === 'solo') {
            this.ai = new NimAI(game.difficulty);
        } else {
            this.ai = null;
        }
        
        // Restaurer l'état
        this.state = {
            objects: game.remainingObjects,
            initialObjects: game.initialObjects,
            currentPlayer: game.currentPlayer,
            isGameOver: false,
            winner: null,
            selectedAmount: 0,
            moveHistory: game.moveHistory ? [...game.moveHistory] : [],
            startTime: game.startTime
        };
        
        // Masquer le bouton save en online
        if (this.elements.saveGameBtn) {
            this.elements.saveGameBtn.style.display = 
                (this.config.mode === 'online') ? 'none' : 'inline-flex';
        }
        
        this.setupGameUI();
        this.showScreen('game');
        this.updateUI();
    }
    
    // ========================================
    // PROFILE DISPLAY
    // ========================================
    
    showProfile() {
        this.updateProfileDisplay();
        this.showScreen('profile');
    }
    
    updateProfileDisplay() {
        // Stats
        if (this.elements.statGamesPlayed) {
            this.elements.statGamesPlayed.textContent = this.profile.games || 0;
        }
        if (this.elements.statGamesWon) {
            this.elements.statGamesWon.textContent = this.profile.wins || 0;
        }
        if (this.elements.statGamesLost) {
            this.elements.statGamesLost.textContent = this.profile.losses || 0;
        }
        if (this.elements.statWinRate) {
            const total = this.profile.games || 0;
            const rate = total > 0 ? Math.round((this.profile.wins / total) * 100) : 0;
            this.elements.statWinRate.textContent = rate + '%';
        }
        
        // Parties sauvegardées
        this.renderSavedGames();
    }
    
    renderSavedGames() {
        const list = this.elements.savedGamesList;
        if (!list) return;
        
        if (!this.profile.savedGames || this.profile.savedGames.length === 0) {
            list.innerHTML = '<p class="empty-msg">Aucune partie enregistrée</p>';
            return;
        }
        
        list.innerHTML = this.profile.savedGames.map((game) => {
            const date = new Date(game.date);
            const dateStr = date.toLocaleDateString('fr-FR', { 
                day: '2-digit', month: '2-digit', year: 'numeric'
            });
            const timeStr = date.toLocaleTimeString('fr-FR', {
                hour: '2-digit', minute: '2-digit'
            });
            
            const modeLabels = { solo: '🎯 Solo', multi: '👥 Local', online: '🌐 En ligne' };
            const modeLabel = modeLabels[game.mode] || game.mode;
            
            const diffLabels = { easy: 'Facile', normal: 'Normal', hard: 'Difficile', neural: 'IA Neuronale' };
            const diffLabel = game.mode === 'solo' ? (diffLabels[game.difficulty] || game.difficulty) : '';
            
            let statusClass, statusLabel;
            if (game.completed) {
                statusClass = game.won ? 'win' : 'loss';
                statusLabel = game.won ? '✅ Victoire' : '❌ Défaite';
            } else {
                statusClass = 'paused';
                statusLabel = '⏸️ En pause';
            }
            
            // Durée si terminée
            let durationStr = '';
            if (game.completed && game.startTime && game.endTime) {
                const durationSec = Math.round((game.endTime - game.startTime) / 1000);
                const min = Math.floor(durationSec / 60);
                const sec = durationSec % 60;
                durationStr = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
            }
            
            const p1Name = game.player1?.name || 'Joueur 1';
            const p2Name = game.player2?.name || 'Joueur 2';
            
            return `
                <div class="saved-game-item ${statusClass}" data-game-id="${game.id}">
                    <div class="saved-game-main">
                        <div class="saved-game-header">
                            <span class="saved-game-status ${statusClass}">${statusLabel}</span>
                            <span class="saved-game-date">${dateStr} à ${timeStr}</span>
                        </div>
                        <div class="saved-game-details">
                            <span class="saved-game-mode">${modeLabel}${diffLabel ? ' • ' + diffLabel : ''}</span>
                            <span class="saved-game-players">${p1Name} vs ${p2Name}</span>
                        </div>
                        <div class="saved-game-stats">
                            <span>📦 ${game.remainingObjects ?? '?'}/${game.initialObjects ?? 15} objets restants</span>
                            <span>🎲 ${game.totalMoves ?? 0} coups joués</span>
                            ${durationStr ? `<span>⏱️ ${durationStr}</span>` : ''}
                        </div>
                    </div>
                    <div class="saved-game-actions">
                        ${!game.completed ? `<button class="btn-resume" data-game-id="${game.id}">▶️ Reprendre</button>` : ''}
                        <button class="btn-delete-game" data-game-id="${game.id}">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Bind events
        list.querySelectorAll('.btn-resume').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resumeGame(btn.dataset.gameId);
            });
        });
        
        list.querySelectorAll('.btn-delete-game').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteSavedGame(btn.dataset.gameId);
            });
        });
    }
    
    deleteSavedGame(gameId) {
        this.profile.savedGames = this.profile.savedGames.filter(g => g.id !== gameId);
        this.saveProfile();
        this.renderSavedGames();
    }
    
    // ========================================
    // STATUS
    // ========================================
    
    showStatus(message, type = '') {
        if (this.elements.statusBar) {
            this.elements.statusBar.textContent = message;
            this.elements.statusBar.className = 'status-bar ' + type;
        }
    }
}

// Initialiser le jeu au chargement
document.addEventListener('DOMContentLoaded', () => {
    window.nimGame = new NimGame();
});
