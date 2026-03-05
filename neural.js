/**
 * Réseau de Neurones pour le Jeu de NIM
 * Apprend à évaluer les positions de jeu via self-play
 * 
 * Architecture: Réseau feedforward simple
 * - Input: état du jeu normalisé (nombre d'objets, joueur actuel)
 * - Hidden: couche cachée avec activation ReLU
 * - Output: score d'évaluation de la position
 */

class NeuralNetwork {
    constructor() {
        // Architecture du réseau
        this.inputSize = 3;   // [objets normalisés, joueur (0/1), nim-sum normalisé]
        this.hiddenSize = 16;
        this.outputSize = 1;
        
        // Learning parameters
        this.learningRate = 0.1;
        this.gamma = 0.95; // Discount factor pour TD-learning
        
        // Initialisation des poids avec Xavier initialization
        this.weightsIH = this.initWeights(this.inputSize, this.hiddenSize);
        this.biasH = new Array(this.hiddenSize).fill(0);
        this.weightsHO = this.initWeights(this.hiddenSize, this.outputSize);
        this.biasO = new Array(this.outputSize).fill(0);
        
        // Stats d'entraînement
        this.gamesPlayed = 0;
        this.totalUpdates = 0;
        
        // Historique pour l'apprentissage
        this.stateHistory = [];
        
        // Charger les poids sauvegardés si disponibles
        this.loadWeights();
    }
    
    /**
     * Initialise les poids avec Xavier initialization
     */
    initWeights(inputSize, outputSize) {
        const scale = Math.sqrt(2.0 / (inputSize + outputSize));
        const weights = [];
        for (let i = 0; i < inputSize; i++) {
            weights[i] = [];
            for (let j = 0; j < outputSize; j++) {
                weights[i][j] = (Math.random() * 2 - 1) * scale;
            }
        }
        return weights;
    }
    
    /**
     * Fonction d'activation ReLU
     */
    relu(x) {
        return Math.max(0, x);
    }
    
    /**
     * Dérivée de ReLU
     */
    reluDerivative(x) {
        return x > 0 ? 1 : 0;
    }
    
    /**
     * Fonction d'activation Sigmoid pour l'output (valeur entre 0 et 1)
     */
    sigmoid(x) {
        return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
    }
    
    /**
     * Normalise l'état du jeu pour l'entrée du réseau
     */
    normalizeState(objects, isMaximizing) {
        const maxObjects = 21; // Maximum typique pour NIM
        const normalizedObjects = objects / maxObjects;
        const playerValue = isMaximizing ? 1 : 0;
        const nimSum = objects % 4; // XOR simplifié pour NIM standard
        const normalizedNimSum = nimSum / 3;
        
        return [normalizedObjects, playerValue, normalizedNimSum];
    }
    
    /**
     * Forward pass du réseau
     */
    forward(input) {
        // Couche cachée
        this.hiddenValues = [];
        this.hiddenRaw = [];
        for (let j = 0; j < this.hiddenSize; j++) {
            let sum = this.biasH[j];
            for (let i = 0; i < this.inputSize; i++) {
                sum += input[i] * this.weightsIH[i][j];
            }
            this.hiddenRaw[j] = sum;
            this.hiddenValues[j] = this.relu(sum);
        }
        
        // Couche de sortie
        let output = this.biasO[0];
        for (let j = 0; j < this.hiddenSize; j++) {
            output += this.hiddenValues[j] * this.weightsHO[j][0];
        }
        
        // Sigmoid pour avoir une valeur entre 0 et 1
        return this.sigmoid(output);
    }
    
    /**
     * Évalue une position de jeu
     * Retourne une valeur entre -1 (perdant) et 1 (gagnant)
     */
    evaluate(objects, isMaximizing) {
        const input = this.normalizeState(objects, isMaximizing);
        const output = this.forward(input);
        // Convertir [0,1] en [-1,1]
        return (output * 2) - 1;
    }
    
    /**
     * Choisit le meilleur coup selon le réseau
     */
    chooseMove(objects, isMaximizing) {
        let bestMove = 1;
        let bestValue = isMaximizing ? -Infinity : Infinity;
        
        const maxTake = Math.min(3, objects);
        
        for (let take = 1; take <= maxTake; take++) {
            const newObjects = objects - take;
            
            // Position terminale
            if (newObjects === 0) {
                // Le joueur actuel prend le dernier et perd (règle normale)
                // ou gagne (règle misère) - ici on utilise la règle normale
                const value = isMaximizing ? -1 : 1;
                if (isMaximizing ? value > bestValue : value < bestValue) {
                    bestValue = value;
                    bestMove = take;
                }
            } else {
                const value = this.evaluate(newObjects, !isMaximizing);
                if (isMaximizing ? value > bestValue : value < bestValue) {
                    bestValue = value;
                    bestMove = take;
                }
            }
        }
        
        // Ajouter un peu d'exploration (epsilon-greedy)
        if (Math.random() < 0.1) {
            bestMove = Math.floor(Math.random() * maxTake) + 1;
        }
        
        return bestMove;
    }
    
    /**
     * Enregistre un état pour l'apprentissage
     */
    recordState(objects, isMaximizing) {
        this.stateHistory.push({
            input: this.normalizeState(objects, isMaximizing),
            objects: objects,
            isMaximizing: isMaximizing
        });
    }
    
    /**
     * Backpropagation pour mettre à jour les poids
     */
    backpropagate(input, target, output) {
        // Erreur de sortie (dérivée de sigmoid)
        const outputError = (target - output) * output * (1 - output);
        
        // Mise à jour des poids hidden -> output
        for (let j = 0; j < this.hiddenSize; j++) {
            this.weightsHO[j][0] += this.learningRate * outputError * this.hiddenValues[j];
        }
        this.biasO[0] += this.learningRate * outputError;
        
        // Erreurs de la couche cachée
        const hiddenErrors = [];
        for (let j = 0; j < this.hiddenSize; j++) {
            hiddenErrors[j] = outputError * this.weightsHO[j][0] * this.reluDerivative(this.hiddenRaw[j]);
        }
        
        // Mise à jour des poids input -> hidden
        for (let i = 0; i < this.inputSize; i++) {
            for (let j = 0; j < this.hiddenSize; j++) {
                this.weightsIH[i][j] += this.learningRate * hiddenErrors[j] * input[i];
            }
        }
        for (let j = 0; j < this.hiddenSize; j++) {
            this.biasH[j] += this.learningRate * hiddenErrors[j];
        }
        
        this.totalUpdates++;
    }
    
    /**
     * Apprentissage après une partie (TD-Learning)
     * winner: 1 si le premier joueur a gagné, -1 sinon
     */
    learnFromGame(winner) {
        if (this.stateHistory.length === 0) return;
        
        // Récompense finale
        const finalReward = winner;
        
        // Parcourir l'historique à l'envers (TD-Learning)
        let futureValue = finalReward;
        
        for (let i = this.stateHistory.length - 1; i >= 0; i--) {
            const state = this.stateHistory[i];
            const input = state.input;
            
            // Forward pass pour obtenir la prédiction actuelle
            const currentOutput = this.forward(input);
            
            // Target value (TD target)
            // Le target dépend de qui joue à ce moment
            let target;
            if (state.isMaximizing) {
                // Pour le maximizer, on veut que la valeur soit proche de la récompense finale si on gagne
                target = (futureValue + 1) / 2; // Convertir [-1,1] en [0,1]
            } else {
                // Pour le minimizer, l'inverse
                target = (-futureValue + 1) / 2;
            }
            
            // Appliquer discount pour les états précédents
            futureValue = this.gamma * futureValue;
            
            // Backpropagation
            this.backpropagate(input, target, currentOutput);
        }
        
        this.gamesPlayed++;
        this.stateHistory = []; // Reset pour la prochaine partie
        
        // Sauvegarder périodiquement
        if (this.gamesPlayed % 10 === 0) {
            this.saveWeights();
        }
    }
    
    /**
     * Self-play pour entraîner le réseau
     */
    selfPlay(numGames = 100, startObjects = 15) {
        console.log(`🧠 Début du self-play: ${numGames} parties`);
        
        for (let game = 0; game < numGames; game++) {
            let objects = startObjects;
            let isPlayer1Turn = true;
            
            this.stateHistory = [];
            
            while (objects > 0) {
                this.recordState(objects, isPlayer1Turn);
                
                const move = this.chooseMove(objects, isPlayer1Turn);
                objects -= move;
                isPlayer1Turn = !isPlayer1Turn;
            }
            
            // Le dernier joueur qui a joué a pris le dernier objet et perd
            const winner = isPlayer1Turn ? 1 : -1; // Le joueur qui n'a PAS joué en dernier gagne
            this.learnFromGame(winner);
        }
        
        console.log(`✅ Self-play terminé. Games: ${this.gamesPlayed}, Updates: ${this.totalUpdates}`);
        this.saveWeights();
    }
    
    /**
     * Entraînement contre un joueur optimal (stratégie NIM connue)
     */
    trainAgainstOptimal(numGames = 50, startObjects = 15) {
        console.log(`🎯 Entraînement contre joueur optimal: ${numGames} parties`);
        
        for (let game = 0; game < numGames; game++) {
            let objects = startObjects;
            let isNNTurn = game % 2 === 0; // Alterne qui commence
            
            this.stateHistory = [];
            
            while (objects > 0) {
                let move;
                
                if (isNNTurn) {
                    this.recordState(objects, true);
                    move = this.chooseMove(objects, true);
                } else {
                    // Stratégie optimale: laisser un multiple de 4
                    const remainder = objects % 4;
                    move = remainder === 0 ? 1 : remainder;
                    move = Math.min(move, objects);
                }
                
                objects -= move;
                isNNTurn = !isNNTurn;
            }
            
            // Déterminer le gagnant
            const nnWon = !isNNTurn; // Si c'est pas le tour du NN, NN a joué en dernier
            // Celui qui prend le dernier perd -> nnWon devrait être l'inverse
            const winner = nnWon ? -1 : 1;
            this.learnFromGame(winner);
        }
        
        console.log(`✅ Entraînement optimal terminé. Games: ${this.gamesPlayed}`);
        this.saveWeights();
    }
    
    /**
     * Sauvegarde les poids dans localStorage
     */
    saveWeights() {
        const data = {
            weightsIH: this.weightsIH,
            biasH: this.biasH,
            weightsHO: this.weightsHO,
            biasO: this.biasO,
            gamesPlayed: this.gamesPlayed,
            totalUpdates: this.totalUpdates
        };
        
        try {
            localStorage.setItem('nim_neural_weights', JSON.stringify(data));
            console.log('💾 Poids sauvegardés');
        } catch (e) {
            console.warn('Impossible de sauvegarder les poids:', e);
        }
    }
    
    /**
     * Charge les poids depuis localStorage
     */
    loadWeights() {
        try {
            const data = localStorage.getItem('nim_neural_weights');
            if (data) {
                const parsed = JSON.parse(data);
                this.weightsIH = parsed.weightsIH;
                this.biasH = parsed.biasH;
                this.weightsHO = parsed.weightsHO;
                this.biasO = parsed.biasO;
                this.gamesPlayed = parsed.gamesPlayed || 0;
                this.totalUpdates = parsed.totalUpdates || 0;
                console.log(`📥 Poids chargés (${this.gamesPlayed} parties jouées)`);
                return true;
            }
        } catch (e) {
            console.warn('Impossible de charger les poids:', e);
        }
        return false;
    }
    
    /**
     * Réinitialise le réseau
     */
    reset() {
        this.weightsIH = this.initWeights(this.inputSize, this.hiddenSize);
        this.biasH = new Array(this.hiddenSize).fill(0);
        this.weightsHO = this.initWeights(this.hiddenSize, this.outputSize);
        this.biasO = new Array(this.outputSize).fill(0);
        this.gamesPlayed = 0;
        this.totalUpdates = 0;
        this.stateHistory = [];
        localStorage.removeItem('nim_neural_weights');
        console.log('🔄 Réseau réinitialisé');
    }
    
    /**
     * Retourne les statistiques du réseau
     */
    getStats() {
        return {
            gamesPlayed: this.gamesPlayed,
            totalUpdates: this.totalUpdates,
            weightsCount: this.inputSize * this.hiddenSize + this.hiddenSize * this.outputSize,
            isTraned: this.gamesPlayed > 0
        };
    }
}

// Instance globale du réseau de neurones
const neuralNetwork = new NeuralNetwork();

// Entraînement initial si le réseau n'a jamais été entraîné
if (neuralNetwork.gamesPlayed < 100) {
    setTimeout(() => {
        console.log('🚀 Entraînement initial du réseau de neurones...');
        neuralNetwork.selfPlay(100, 15);
        neuralNetwork.trainAgainstOptimal(50, 15);
    }, 1000);
}

// Export pour utilisation dans d'autres modules
window.NeuralNetwork = NeuralNetwork;
window.neuralNetwork = neuralNetwork;
