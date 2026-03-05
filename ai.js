/**
 * Jeu de NIM - Module Intelligence Artificielle
 * Implémentation des algorithmes MinMax et Alpha-Beta (Negamax)
 * + Réseau de neurones pour apprentissage
 * 
 * VERSION MISÈRE : le joueur qui prend le dernier objet PERD
 * 
 * ARCHITECTURE ALGORITHMIQUE :
 * - Facile : coups aléatoires
 * - Normal : MinMax classique avec profondeur limitée
 * - Difficile : Negamax + Alpha-Beta (recherche complète)
 * - Neural : Réseau de neurones entraîné par self-play
 * 
 * NOTE THÉORIQUE :
 * En Nim misère, les positions où (remaining % 4 === 1) sont perdantes
 * pour le joueur qui doit jouer. Cependant, cette connaissance n'est
 * PAS injectée dans l'IA pour démontrer que les algorithmes MinMax
 * et Alpha-Beta trouvent la solution optimale par exploration.
 */

/**
 * Classe représentant l'IA du jeu de NIM
 */
class NimAI {
    /**
     * Constructeur de l'IA
     * @param {string} difficulty - Niveau de difficulté ('easy', 'normal', 'hard', 'neural')
     */
    constructor(difficulty = 'hard') {
        this.difficulty = difficulty;
        // Profondeur de recherche pour le mode normal
        this.normalDepth = 5;
        // Compteur de nœuds explorés (pour statistiques pédagogiques)
        this.nodesExplored = 0;
        // Référence au réseau de neurones (défini dans neural.js)
        this.neuralNetwork = null;
    }

    /**
     * Choisit le meilleur coup à jouer selon le niveau de difficulté
     * @param {Object} gameState - État actuel du jeu {remaining, currentPlayer}
     * @returns {number} - Nombre d'objets à retirer (1, 2 ou 3)
     */
    chooseMove(gameState) {
        // Réinitialiser le compteur de nœuds
        this.nodesExplored = 0;

        let move;
        switch (this.difficulty) {
            case 'easy':
                move = this.randomMove(gameState);
                break;
            case 'normal':
                move = this.minmaxMove(gameState, this.normalDepth);
                break;
            case 'hard':
                move = this.negamaxAlphaBetaMove(gameState);
                break;
            case 'neural':
                move = this.neuralMove(gameState);
                break;
            default:
                move = this.negamaxAlphaBetaMove(gameState);
        }

        console.log(`[IA ${this.difficulty}] Coup: ${move} | Noeuds explorés: ${this.nodesExplored}`);
        return move;
    }

    /**
     * Retourne les coups possibles pour un état donné
     * @param {number} remaining - Nombre d'objets restants
     * @returns {number[]} - Liste des coups possibles (1, 2 ou 3)
     */
    getPossibleMoves(remaining) {
        return [1, 2, 3].filter(n => n <= remaining);
    }

    /**
     * Vérifie si l'état est terminal (fin de partie)
     * @param {number} remaining - Nombre d'objets restants
     * @returns {boolean} - true si la partie est terminée
     */
    isTerminal(remaining) {
        return remaining === 0;
    }

    // ========================================
    // NIVEAU FACILE : Coups aléatoires
    // ========================================

    /**
     * Choisit un coup en utilisant le réseau de neurones
     * Niveau neural - IA apprenante
     * 
     * @param {Object} gameState - État du jeu
     * @returns {number} - Coup choisi par le réseau de neurones
     */
    neuralMove(gameState) {
        // Accéder au réseau de neurones global
        const nn = this.neuralNetwork || window.neuralNetwork;
        
        if (!nn) {
            console.warn('[IA Neural] Réseau non disponible, fallback sur hard');
            return this.negamaxAlphaBetaMove(gameState);
        }
        
        // Enregistrer l'état pour l'apprentissage futur
        nn.recordState(gameState.remaining, true);
        
        // Choisir le meilleur coup selon le réseau
        return nn.chooseMove(gameState.remaining, true);
    }

    /**
     * Choisit un coup aléatoire parmi les coups possibles
     * Niveau facile - Aucune stratégie
     * 
     * @param {Object} gameState - État du jeu
     * @returns {number} - Coup choisi aléatoirement
     */
    randomMove(gameState) {
        const possibleMoves = this.getPossibleMoves(gameState.remaining);
        const randomIndex = Math.floor(Math.random() * possibleMoves.length);
        return possibleMoves[randomIndex];
    }

    // ========================================
    // NIVEAU NORMAL : MinMax classique
    // ========================================

    /**
     * Choisit le meilleur coup en utilisant MinMax avec profondeur limitée
     * 
     * MinMax classique :
     * - Maximizer cherche le score le plus haut
     * - Minimizer cherche le score le plus bas
     * - On alterne à chaque niveau de l'arbre
     * 
     * @param {Object} gameState - État du jeu
     * @param {number} maxDepth - Profondeur maximale de recherche
     * @returns {number} - Meilleur coup trouvé
     */
    minmaxMove(gameState, maxDepth) {
        const possibleMoves = this.getPossibleMoves(gameState.remaining);
        let bestMove = possibleMoves[0];
        let bestScore = -Infinity;

        for (const move of possibleMoves) {
            // Simuler le coup
            const newRemaining = gameState.remaining - move;
            
            // Évaluer avec MinMax (c'est au tour de l'adversaire = minimizer)
            const score = this.minmax(newRemaining, maxDepth - 1, false);

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    /**
     * Algorithme MinMax classique récursif
     * 
     * @param {number} remaining - Objets restants
     * @param {number} depth - Profondeur restante
     * @param {boolean} isMaximizing - true si c'est au tour du joueur maximisant (IA)
     * @returns {number} - Score de la position
     */
    minmax(remaining, depth, isMaximizing) {
        this.nodesExplored++;

        // Condition terminale : plus d'objets
        if (this.isTerminal(remaining)) {
            // En version misère : celui qui a joué le dernier coup a PERDU
            // Donc le joueur COURANT (qui n'a plus rien à jouer) a GAGNÉ
            // Si c'est le tour du maximizer : il gagne -> +100
            // Si c'est le tour du minimizer : le maximizer a perdu -> -100
            return isMaximizing ? 100 : -100;
        }

        // Profondeur maximale atteinte : évaluation heuristique neutre
        if (depth === 0) {
            // Heuristique simple : pas de connaissance injectée
            // On retourne 0 pour laisser MinMax décider via l'exploration
            return 0;
        }

        const possibleMoves = this.getPossibleMoves(remaining);

        if (isMaximizing) {
            // Maximizer : cherche le meilleur score
            let maxScore = -Infinity;
            for (const move of possibleMoves) {
                const newRemaining = remaining - move;
                const score = this.minmax(newRemaining, depth - 1, false);
                maxScore = Math.max(maxScore, score);
            }
            return maxScore;
        } else {
            // Minimizer : cherche le pire score pour le maximizer
            let minScore = Infinity;
            for (const move of possibleMoves) {
                const newRemaining = remaining - move;
                const score = this.minmax(newRemaining, depth - 1, true);
                minScore = Math.min(minScore, score);
            }
            return minScore;
        }
    }

    // ========================================
    // NIVEAU DIFFICILE : Negamax + Alpha-Beta
    // ========================================

    /**
     * Choisit le meilleur coup en utilisant Negamax avec élagage Alpha-Beta
     * 
     * Negamax : variante élégante de MinMax où le score est toujours
     * vu du point de vue du joueur courant. On utilise la propriété :
     *   max(a, b) = -min(-a, -b)
     * 
     * Alpha-Beta : élagage des branches qui ne peuvent pas améliorer le résultat
     * 
     * @param {Object} gameState - État du jeu
     * @returns {number} - Meilleur coup trouvé
     */
    negamaxAlphaBetaMove(gameState) {
        const possibleMoves = this.getPossibleMoves(gameState.remaining);
        let bestMove = possibleMoves[0];
        let bestScore = -Infinity;

        for (const move of possibleMoves) {
            // Simuler le coup
            const newRemaining = gameState.remaining - move;
            
            // Évaluer avec Negamax Alpha-Beta
            // On inverse le score car c'est au tour de l'adversaire
            const score = -this.negamaxAlphaBeta(newRemaining, -Infinity, Infinity);

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    /**
     * Algorithme Negamax avec élagage Alpha-Beta
     * 
     * PRINCIPE :
     * - Le score est toujours exprimé du point de vue du joueur courant
     * - Un score positif = bon pour le joueur courant
     * - Un score négatif = mauvais pour le joueur courant
     * - À chaque récursion, on inverse le signe
     * 
     * ÉLAGAGE ALPHA-BETA :
     * - alpha : meilleur score garanti pour le joueur courant
     * - beta : pire score que l'adversaire nous laissera atteindre
     * - Si alpha >= beta, on élague (cut-off)
     * 
     * @param {number} remaining - Objets restants
     * @param {number} alpha - Borne inférieure (meilleur score garanti)
     * @param {number} beta - Borne supérieure (seuil de l'adversaire)
     * @returns {number} - Score de la position (du point de vue du joueur courant)
     */
    negamaxAlphaBeta(remaining, alpha, beta) {
        this.nodesExplored++;

        // Condition terminale : plus d'objets
        if (this.isTerminal(remaining)) {
            // En version misère : celui qui a joué le dernier coup a PERDU
            // Le joueur courant n'a plus rien à jouer -> il a GAGNÉ
            // Score positif = victoire pour le joueur courant
            return 100;
        }

        const possibleMoves = this.getPossibleMoves(remaining);
        let value = -Infinity;

        for (const move of possibleMoves) {
            const newRemaining = remaining - move;
            
            // Récursion : on inverse alpha/beta et le signe du score
            const score = -this.negamaxAlphaBeta(newRemaining, -beta, -alpha);
            
            value = Math.max(value, score);
            alpha = Math.max(alpha, value);
            
            // Élagage Beta : l'adversaire ne nous laissera pas atteindre ce score
            if (alpha >= beta) {
                break; // Cut-off
            }
        }

        return value;
    }

    // ========================================
    // MÉTHODES UTILITAIRES
    // ========================================

    /**
     * Analyse une position et retourne des informations détaillées
     * Utile pour le débogage et l'affichage pédagogique
     * 
     * NOTE : Cette analyse utilise la connaissance théorique du Nim
     * (remaining % 4 === 1) uniquement à des fins pédagogiques.
     * L'IA elle-même n'utilise PAS cette formule.
     * 
     * @param {number} remaining - Objets restants
     * @returns {Object} - Analyse de la position
     */
    analyzePosition(remaining) {
        const possibleMoves = this.getPossibleMoves(remaining);
        
        // Théorie du Nim misère (pour explication uniquement)
        // Position perdante si remaining === 1 (mod 4)
        const isLosingPosition = (remaining % 4 === 1);
        
        const analysis = {
            remaining: remaining,
            possibleMoves: possibleMoves,
            isTerminal: this.isTerminal(remaining),
            // Du point de vue du joueur qui doit jouer :
            isWinningPosition: !isLosingPosition,
            optimalMove: null,
            explanation: ''
        };

        if (analysis.isTerminal) {
            analysis.explanation = "Position terminale : le joueur precedent a pris le dernier objet et a PERDU.";
        } else if (analysis.isWinningPosition) {
            // Position gagnante : on peut forcer une victoire
            // Coup optimal : laisser l'adversaire avec (k*4 + 1) objets
            for (const move of possibleMoves) {
                if ((remaining - move) % 4 === 1) {
                    analysis.optimalMove = move;
                    break;
                }
            }
            // Cas spécial : s'il reste 2, 3 ou 4 objets, prendre pour laisser 1
            if (analysis.optimalMove === null && remaining <= 4) {
                analysis.optimalMove = remaining - 1;
            }
            analysis.explanation = `Position GAGNANTE. Coup optimal : prendre ${analysis.optimalMove} pour laisser ${remaining - analysis.optimalMove} objet(s).`;
        } else {
            // Position perdante : tous les coups mènent à une position gagnante pour l'adversaire
            analysis.optimalMove = 1; // Par convention, on prend le minimum
            analysis.explanation = "Position PERDANTE. Aucun coup ne garantit la victoire contre un adversaire parfait.";
        }

        return analysis;
    }

    /**
     * Change le niveau de difficulté
     * @param {string} newDifficulty - Nouveau niveau ('easy', 'normal', 'hard', 'neural')
     */
    setDifficulty(newDifficulty) {
        if (['easy', 'normal', 'hard', 'neural'].includes(newDifficulty)) {
            this.difficulty = newDifficulty;
            console.log(`[IA] Difficulte changee : ${newDifficulty}`);
        }
    }

    /**
     * Notifie le réseau de neurones du résultat de la partie
     * @param {boolean} aiWon - true si l'IA a gagné
     */
    notifyGameEnd(aiWon) {
        if (this.difficulty === 'neural') {
            const nn = this.neuralNetwork || window.neuralNetwork;
            if (nn) {
                // L'IA joue en tant que maximizer (joueur 1)
                nn.learnFromGame(aiWon ? 1 : -1);
                console.log(`[IA Neural] Apprentissage: ${aiWon ? 'victoire' : 'défaite'}`);
            }
        }
    }

    /**
     * Retourne les statistiques de la dernière recherche
     * @returns {Object} - Statistiques
     */
    getStats() {
        return {
            difficulty: this.difficulty,
            nodesExplored: this.nodesExplored
        };
    }
}

// Export pour utilisation dans game.js
if (typeof window !== 'undefined') {
    window.NimAI = NimAI;
}
