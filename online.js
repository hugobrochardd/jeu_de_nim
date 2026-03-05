/**
 * Module Online - Gestion des parties en ligne avec Firebase
 * Realtime Database pour synchronisation temps réel
 */

class OnlineManager {
    constructor() {
        this.db = null;
        this.currentRoom = null;
        this.currentRoomRef = null;
        this.playerId = null;
        this.playerNumber = null; // 1 ou 2
        this.listeners = [];
        this.isHost = false;
        
        // Callbacks
        this.onGameStart = null;
        this.onOpponentMove = null;
        this.onOpponentLeft = null;
        this.onGameEnd = null;
        this.onRoomUpdate = null;
        
        this.initFirebase();
    }
    
    /**
     * Initialise Firebase
     */
    initFirebase() {
        // Configuration Firebase (déjà définie dans index.html)
        if (typeof firebase !== 'undefined' && firebase.database) {
            this.db = firebase.database();
            this.playerId = this.generatePlayerId();
            console.log('🔥 Firebase initialisé, Player ID:', this.playerId);
        } else {
            console.warn('⚠️ Firebase non disponible');
        }
    }
    
    /**
     * Génère un ID unique pour le joueur
     */
    generatePlayerId() {
        const stored = localStorage.getItem('nim_player_id');
        if (stored) return stored;
        
        const id = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('nim_player_id', id);
        return id;
    }
    
    /**
     * Génère un code de room aléatoire
     */
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    
    /**
     * Crée une nouvelle room
     */
    async createRoom(playerName, playerColor, objectCount = 15) {
        if (!this.db) throw new Error('Firebase non initialisé');
        
        const roomCode = this.generateRoomCode();
        const roomRef = this.db.ref('rooms/' + roomCode);
        
        const roomData = {
            code: roomCode,
            status: 'waiting', // waiting, playing, finished
            host: {
                id: this.playerId,
                name: playerName,
                color: playerColor,
                connected: true
            },
            guest: null,
            game: {
                objects: objectCount,
                initialObjects: objectCount,
                currentPlayer: 1, // 1 = host, 2 = guest
                lastMove: null,
                winner: null
            },
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };
        
        await roomRef.set(roomData);
        
        this.currentRoom = roomCode;
        this.currentRoomRef = roomRef;
        this.isHost = true;
        this.playerNumber = 1;
        
        // Écouter les changements de la room
        this.setupRoomListeners();
        
        // Mettre à jour la présence
        this.setupPresence();
        
        console.log('🏠 Room créée:', roomCode);
        return roomCode;
    }
    
    /**
     * Récupère la liste des rooms disponibles
     */
    async getAvailableRooms() {
        if (!this.db) throw new Error('Firebase non initialisé');
        
        const snapshot = await this.db.ref('rooms')
            .orderByChild('status')
            .equalTo('waiting')
            .once('value');
        
        const rooms = [];
        snapshot.forEach((child) => {
            const room = child.val();
            if (room.host && room.host.connected && !room.guest) {
                rooms.push({
                    code: room.code,
                    hostName: room.host.name,
                    objects: room.game.objects,
                    createdAt: room.createdAt
                });
            }
        });
        
        // Trier par date de création (plus récent en premier)
        rooms.sort((a, b) => b.createdAt - a.createdAt);
        
        return rooms;
    }
    
    /**
     * Écoute les changements de la liste des rooms
     */
    listenToRoomsList(callback) {
        if (!this.db) return;
        
        const roomsRef = this.db.ref('rooms').orderByChild('status').equalTo('waiting');
        
        const listener = roomsRef.on('value', (snapshot) => {
            const rooms = [];
            snapshot.forEach((child) => {
                const room = child.val();
                if (room.host && room.host.connected && !room.guest) {
                    rooms.push({
                        code: room.code,
                        hostName: room.host.name,
                        objects: room.game.objects,
                        createdAt: room.createdAt
                    });
                }
            });
            rooms.sort((a, b) => b.createdAt - a.createdAt);
            callback(rooms);
        });
        
        this.listeners.push({ ref: roomsRef, event: 'value', callback: listener });
    }
    
    /**
     * Rejoint une room existante
     */
    async joinRoom(roomCode, playerName, playerColor) {
        if (!this.db) throw new Error('Firebase non initialisé');
        
        const roomRef = this.db.ref('rooms/' + roomCode);
        const snapshot = await roomRef.once('value');
        
        if (!snapshot.exists()) {
            throw new Error('Room introuvable');
        }
        
        const room = snapshot.val();
        
        if (room.status !== 'waiting') {
            throw new Error('Partie déjà en cours');
        }
        
        if (room.guest) {
            throw new Error('Room complète');
        }
        
        // Rejoindre comme guest
        await roomRef.update({
            guest: {
                id: this.playerId,
                name: playerName,
                color: playerColor,
                connected: true
            },
            status: 'playing'
        });
        
        this.currentRoom = roomCode;
        this.currentRoomRef = roomRef;
        this.isHost = false;
        this.playerNumber = 2;
        
        // Écouter les changements
        this.setupRoomListeners();
        this.setupPresence();
        
        console.log('🎮 Rejoint room:', roomCode);
        return room;
    }
    
    /**
     * Configure les listeners pour la room
     */
    setupRoomListeners() {
        if (!this.currentRoomRef) return;
        
        // Écouter les changements de la room
        const roomListener = this.currentRoomRef.on('value', (snapshot) => {
            if (!snapshot.exists()) {
                console.log('Room supprimée');
                this.handleRoomDeleted();
                return;
            }
            
            const room = snapshot.val();
            
            // Vérifier si le guest a rejoint (pour l'host) - une seule fois
            if (this.isHost && room.status === 'playing' && room.guest && !this._gameStarted) {
                this._gameStarted = true;
                if (this.onGameStart) {
                    this.onGameStart(room);
                }
            }
            
            // Vérifier les déconnexions
            if (this.isHost && room.guest && !room.guest.connected) {
                if (this.onOpponentLeft) this.onOpponentLeft();
            }
            if (!this.isHost && room.host && !room.host.connected) {
                if (this.onOpponentLeft) this.onOpponentLeft();
            }
            
            // Notifier des mises à jour
            if (this.onRoomUpdate) {
                this.onRoomUpdate(room);
            }
        });
        
        this.listeners.push({ ref: this.currentRoomRef, event: 'value', callback: roomListener });
        
        // Écouter les changements de jeu spécifiquement
        const gameRef = this.currentRoomRef.child('game');
        let lastProcessedMove = null;
        
        let initialLoad = true;
        const gameListener = gameRef.on('value', (snapshot) => {
            const game = snapshot.val();
            if (!game) return;
            
            console.log('🔄 Game update:', JSON.stringify(game), 'initialLoad:', initialLoad);
            
            // Ignorer le premier chargement (état initial de la room)
            if (initialLoad) {
                initialLoad = false;
                lastProcessedMove = game.lastMove ? (game.lastMove.player + '-' + game.objects) : null;
                return;
            }
            
            // Ne traiter que les coups de l'adversaire
            if (game.lastMove && game.lastMove.player !== this.playerNumber) {
                // Éviter de traiter le même coup deux fois
                const moveKey = game.lastMove.player + '-' + game.objects;
                if (moveKey !== lastProcessedMove) {
                    lastProcessedMove = moveKey;
                    console.log('👤 Coup adversaire:', game.lastMove.count, 'Restant:', game.objects);
                    
                    // Si l'adversaire a pris le dernier objet, signaler la fin
                    if (game.winner && game.winner > 0) {
                        console.log('🏆 Adversaire a pris le dernier, gagnant:', game.winner);
                        if (this.onGameEnd) {
                            this.onGameEnd(game.winner);
                        }
                        return;
                    }
                    
                    // Sinon, notifier du coup adverse
                    if (this.onOpponentMove) {
                        this.onOpponentMove(game.lastMove.count, game.objects);
                    }
                }
            }
            // Ignorer les updates de mes propres coups (y compris mon propre winner)
        });
        
        this.listeners.push({ ref: gameRef, event: 'value', callback: gameListener });
    }
    
    /**
     * Configure la détection de présence
     */
    setupPresence() {
        if (!this.currentRoomRef) return;
        
        const playerPath = this.isHost ? 'host/connected' : 'guest/connected';
        const connectedRef = this.currentRoomRef.child(playerPath);
        
        // Mettre à jour la présence
        connectedRef.set(true);
        
        // Supprimer à la déconnexion
        connectedRef.onDisconnect().set(false);
        
        // Si host, supprimer la room à la déconnexion
        if (this.isHost) {
            this.currentRoomRef.onDisconnect().remove();
        }
    }
    
    /**
     * Envoie un coup
     */
    async makeMove(count) {
        if (!this.currentRoomRef) throw new Error('Pas de room active');
        
        const gameRef = this.currentRoomRef.child('game');
        const snapshot = await gameRef.once('value');
        const game = snapshot.val();
        
        if (game.currentPlayer !== this.playerNumber) {
            throw new Error("Ce n'est pas votre tour");
        }
        
        const newObjects = game.objects - count;
        
        const updates = {
            objects: newObjects,
            currentPlayer: this.playerNumber === 1 ? 2 : 1,
            lastMove: {
                player: this.playerNumber,
                count: count,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            }
        };
        
        // Vérifier fin de partie
        if (newObjects === 0) {
            updates.winner = this.playerNumber === 1 ? 2 : 1; // L'autre joueur gagne
        }
        
        await gameRef.update(updates);
        
        return newObjects;
    }
    
    /**
     * Vérifie si c'est le tour du joueur
     */
    async isMyTurn() {
        if (!this.currentRoomRef) return false;
        
        const snapshot = await this.currentRoomRef.child('game/currentPlayer').once('value');
        return snapshot.val() === this.playerNumber;
    }
    
    /**
     * Récupère l'état actuel du jeu
     */
    async getGameState() {
        if (!this.currentRoomRef) return null;
        
        const snapshot = await this.currentRoomRef.once('value');
        return snapshot.val();
    }
    
    /**
     * Quitte la room actuelle
     */
    async leaveRoom() {
        if (!this.currentRoomRef) return;
        
        // Supprimer tous les listeners
        this.listeners.forEach(({ ref, event, callback }) => {
            ref.off(event, callback);
        });
        this.listeners = [];
        
        if (this.isHost) {
            // Supprimer la room si on est l'host
            await this.currentRoomRef.remove();
        } else {
            // Marquer comme déconnecté si on est guest
            await this.currentRoomRef.child('guest').remove();
            await this.currentRoomRef.child('status').set('waiting');
        }
        
        this.currentRoom = null;
        this.currentRoomRef = null;
        this.isHost = false;
        this.playerNumber = null;
        
        console.log('👋 Room quittée');
    }
    
    /**
     * Gère la suppression de room
     */
    handleRoomDeleted() {
        this.listeners.forEach(({ ref, event, callback }) => {
            ref.off(event, callback);
        });
        this.listeners = [];
        
        this.currentRoom = null;
        this.currentRoomRef = null;
        
        if (this.onOpponentLeft) {
            this.onOpponentLeft();
        }
    }
    
    /**
     * Nettoie les vieilles rooms (> 1 heure)
     */
    async cleanupOldRooms() {
        if (!this.db) return;
        
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const snapshot = await this.db.ref('rooms')
            .orderByChild('createdAt')
            .endAt(oneHourAgo)
            .once('value');
        
        snapshot.forEach((child) => {
            child.ref.remove();
        });
    }
    
    /**
     * Propose une revanche
     */
    async proposeRematch() {
        if (!this.currentRoomRef) return;
        
        const snapshot = await this.currentRoomRef.once('value');
        const room = snapshot.val();
        
        await this.currentRoomRef.child('game').update({
            objects: room.game.initialObjects,
            currentPlayer: 1,
            lastMove: null,
            winner: null
        });
        
        await this.currentRoomRef.child('status').set('playing');
    }
}

// Configuration Firebase
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

// Initialiser Firebase avant tout
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log('🔥 Firebase initialisé');
}

// Instance globale (créée après l'init Firebase)
const onlineManager = new OnlineManager();

// Export
window.OnlineManager = OnlineManager;
window.onlineManager = onlineManager;

// Nettoyer les vieilles rooms au chargement
setTimeout(() => {
    if (onlineManager.db) {
        onlineManager.cleanupOldRooms();
    }
}, 5000);
