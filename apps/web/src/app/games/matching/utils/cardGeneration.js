"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAbacusNumeralCards = generateAbacusNumeralCards;
exports.generateComplementCards = generateComplementCards;
exports.generateGameCards = generateGameCards;
exports.getGridConfiguration = getGridConfiguration;
exports.generateCardId = generateCardId;
// Utility function to generate unique random numbers
function generateUniqueNumbers(count, options) {
    const numbers = new Set();
    const { min, max } = options;
    while (numbers.size < count) {
        const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
        numbers.add(randomNum);
    }
    return Array.from(numbers);
}
// Utility function to shuffle an array
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
// Generate cards for abacus-numeral game mode
function generateAbacusNumeralCards(pairs) {
    // Generate unique numbers based on difficulty
    // For easier games, use smaller numbers; for harder games, use larger ranges
    const numberRanges = {
        6: { min: 1, max: 50 }, // 6 pairs: 1-50
        8: { min: 1, max: 100 }, // 8 pairs: 1-100
        12: { min: 1, max: 200 }, // 12 pairs: 1-200
        15: { min: 1, max: 300 }, // 15 pairs: 1-300
    };
    const range = numberRanges[pairs];
    const numbers = generateUniqueNumbers(pairs, range);
    const cards = [];
    numbers.forEach((number) => {
        // Abacus representation card
        cards.push({
            id: `abacus_${number}`,
            type: 'abacus',
            number,
            matched: false,
        });
        // Numerical representation card
        cards.push({
            id: `number_${number}`,
            type: 'number',
            number,
            matched: false,
        });
    });
    return shuffleArray(cards);
}
// Generate cards for complement pairs game mode
function generateComplementCards(pairs) {
    // Define complement pairs for friends of 5 and friends of 10
    const complementPairs = [
        // Friends of 5
        { pair: [0, 5], targetSum: 5 },
        { pair: [1, 4], targetSum: 5 },
        { pair: [2, 3], targetSum: 5 },
        // Friends of 10
        { pair: [0, 10], targetSum: 10 },
        { pair: [1, 9], targetSum: 10 },
        { pair: [2, 8], targetSum: 10 },
        { pair: [3, 7], targetSum: 10 },
        { pair: [4, 6], targetSum: 10 },
        { pair: [5, 5], targetSum: 10 },
        // Additional pairs for higher difficulties
        { pair: [6, 4], targetSum: 10 },
        { pair: [7, 3], targetSum: 10 },
        { pair: [8, 2], targetSum: 10 },
        { pair: [9, 1], targetSum: 10 },
        { pair: [10, 0], targetSum: 10 },
        // More challenging pairs (can be used for expert mode)
        { pair: [11, 9], targetSum: 20 },
        { pair: [12, 8], targetSum: 20 },
    ];
    // Select the required number of complement pairs
    const selectedPairs = complementPairs.slice(0, pairs);
    const cards = [];
    selectedPairs.forEach(({ pair: [num1, num2], targetSum }, index) => {
        // First number in the pair
        cards.push({
            id: `comp1_${index}_${num1}`,
            type: 'complement',
            number: num1,
            complement: num2,
            targetSum,
            matched: false,
        });
        // Second number in the pair
        cards.push({
            id: `comp2_${index}_${num2}`,
            type: 'complement',
            number: num2,
            complement: num1,
            targetSum,
            matched: false,
        });
    });
    return shuffleArray(cards);
}
// Main card generation function
function generateGameCards(gameType, difficulty) {
    switch (gameType) {
        case 'abacus-numeral':
            return generateAbacusNumeralCards(difficulty);
        case 'complement-pairs':
            return generateComplementCards(difficulty);
        default:
            throw new Error(`Unknown game type: ${gameType}`);
    }
}
// Utility function to get responsive grid configuration based on difficulty and screen size
function getGridConfiguration(difficulty) {
    const configs = {
        6: {
            totalCards: 12,
            mobileColumns: 3, // 3x4 grid in portrait
            tabletColumns: 4, // 4x3 grid on tablet
            desktopColumns: 4, // 4x3 grid on desktop
            landscapeColumns: 6, // 6x2 grid in landscape
            cardSize: { width: '140px', height: '180px' },
            gridTemplate: 'repeat(3, 1fr)',
        },
        8: {
            totalCards: 16,
            mobileColumns: 3, // 3x6 grid in portrait (some spillover)
            tabletColumns: 4, // 4x4 grid on tablet
            desktopColumns: 4, // 4x4 grid on desktop
            landscapeColumns: 6, // 6x3 grid in landscape (some spillover)
            cardSize: { width: '120px', height: '160px' },
            gridTemplate: 'repeat(3, 1fr)',
        },
        12: {
            totalCards: 24,
            mobileColumns: 3, // 3x8 grid in portrait
            tabletColumns: 4, // 4x6 grid on tablet
            desktopColumns: 6, // 6x4 grid on desktop
            landscapeColumns: 6, // 6x4 grid in landscape (changed from 8x3)
            cardSize: { width: '100px', height: '140px' },
            gridTemplate: 'repeat(3, 1fr)',
        },
        15: {
            totalCards: 30,
            mobileColumns: 3, // 3x10 grid in portrait
            tabletColumns: 5, // 5x6 grid on tablet
            desktopColumns: 6, // 6x5 grid on desktop
            landscapeColumns: 10, // 10x3 grid in landscape
            cardSize: { width: '90px', height: '120px' },
            gridTemplate: 'repeat(3, 1fr)',
        },
    };
    return configs[difficulty];
}
// Generate a unique ID for cards
function generateCardId(type, identifier) {
    return `${type}_${identifier}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
