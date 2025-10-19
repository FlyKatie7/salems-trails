// Quizzy AI and Quiz Functionality Module
// This module contains only the AI chat and quiz functionality
// Graphics and game scenes are handled by game.js
const CHARACTER_NAME = "Quizzy";
const CHARACTER_DESCRIPTION = `
Quizzy is a witty trivia host who loves surprising players with fun facts.
Tone: upbeat, playful, and concise. Always keep answers under two sentences.
If a player asks for hints, give one playful clue without revealing the answer.
Avoid controversial or inappropriate topics; keep trivia family-friendly.
Ask follow-up questions to keep players engaged.
First Message of Roleplay:
*Welcome to the ultimate trivia challenge! Ready for your first question?*
NOTES:
(Generate trivia questions in categories like history, science, pop culture, or custom themes.)
(Adapt difficulty based on player performance.)
(Always provide the correct answer after the player responds.)
(Keep statements brief so the player can respond quickly.)
`;
// ChatManager class for handling AI conversations and quiz functionality
class QuizChatManager {
    constructor(characterDescription) {
        this.characterDescription = characterDescription;
        this.messages = [];
        this.currentScore = 0;
        this.questionsAsked = 0;
        this.currentDifficulty = 'easy';
        this.categories = ['history', 'science', 'pop culture', 'geography', 'literature'];
        this.currentQuestion = null;
        this.awaitingAnswer = false;
    }
    addMessage(role, content) {
        this.messages.push({ role, content, timestamp: Date.now() });
    }
    async getCharacterResponse(model = 'mistral') {
        const lastUserMessage = this.messages.filter(m => m.role === 'user').pop();
        
        if (this.awaitingAnswer && lastUserMessage) {
            return this.processQuizAnswer(lastUserMessage.content);
        }
        // Generate new trivia question or general response
        if (this.shouldAskTriviaQuestion()) {
            return this.generateTriviaQuestion();
        }
        // General AI responses for non-quiz interactions
        const responses = [
            "*Welcome to the ultimate trivia challenge! Ready for your first question?*",
            "Great question! Let me think about that for a moment...",
            "Here's a fun fact for you!",
            "That's an interesting topic! What else would you like to know?",
            "I love discussing trivia with fellow knowledge seekers!",
            "Ready for another brain teaser?",
            "You're doing great! Keep those questions coming!",
            "That's a tricky one! Let me give you a hint..."
        ];
        
        // Simulate async delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
        // Return a random response for now
        return responses[Math.floor(Math.random() * responses.length)];
    }
    shouldAskTriviaQuestion() {
        // Ask trivia questions based on conversation flow
        const recentMessages = this.messages.slice(-3);
        const hasTriviaTriggers = recentMessages.some(msg => 
            msg.content.toLowerCase().includes('quiz') ||
            msg.content.toLowerCase().includes('question') ||
            msg.content.toLowerCase().includes('trivia') ||
            msg.content.toLowerCase().includes('challenge')
        );
        
        return hasTriviaTriggers || (this.questionsAsked < 3 && Math.random() > 0.5);
    }
    generateTriviaQuestion() {
        const category = this.categories[Math.floor(Math.random() * this.categories.length)];
        const questions = this.getTriviaQuestions(category, this.currentDifficulty);
        this.currentQuestion = questions[Math.floor(Math.random() * questions.length)];
        this.awaitingAnswer = true;
        this.questionsAsked++;
        return `🧠 **TRIVIA TIME!** (${category.toUpperCase()})
${this.currentQuestion.question}
A) ${this.currentQuestion.options.A}
B) ${this.currentQuestion.options.B}  
C) ${this.currentQuestion.options.C}
D) ${this.currentQuestion.options.D}
What's your answer? (Type A, B, C, or D)`;
    }
    processQuizAnswer(userAnswer) {
        if (!this.currentQuestion) {
            return "Hmm, I don't have a question pending. Let's start a new one!";
        }
        const answer = userAnswer.trim().toUpperCase();
        const correctAnswer = this.currentQuestion.correctAnswer;
        this.awaitingAnswer = false;
        if (answer === correctAnswer) {
            this.currentScore += this.getDifficultyPoints();
            const response = `🎉 **CORRECT!** 
${this.currentQuestion.explanation || 'Great job!'}
**Score: ${this.currentScore} points**
Ready for another question?`;
            
            this.adjustDifficulty(true);
            this.currentQuestion = null;
            return response;
        } else {
            const response = `❌ **Not quite!** 
The correct answer was **${correctAnswer}**: ${this.currentQuestion.options[correctAnswer]}
${this.currentQuestion.explanation || ''}
**Score: ${this.currentScore} points**
Don't worry, let's try another one!`;
            
            this.adjustDifficulty(false);
            this.currentQuestion = null;
            return response;
        }
    }
    getTriviaQuestions(category, difficulty) {
        // Sample trivia questions - in a real implementation, this would come from a database
        const questions = {
            history: [
                {
                    question: "Who was the first President of the United States?",
                    options: {
                        A: "Thomas Jefferson",
                        B: "George Washington", 
                        C: "John Adams",
                        D: "Benjamin Franklin"
                    },
                    correctAnswer: "B",
                    explanation: "George Washington served as the first President from 1789 to 1797."
                },
                {
                    question: "In which year did World War II end?",
                    options: {
                        A: "1944",
                        B: "1945",
                        C: "1946", 
                        D: "1947"
                    },
                    correctAnswer: "B",
                    explanation: "World War II ended in 1945 with Japan's surrender in September."
                }
            ],
            science: [
                {
                    question: "What is the chemical symbol for gold?",
                    options: {
                        A: "Go",
                        B: "Gd",
                        C: "Au",
                        D: "Ag"
                    },
                    correctAnswer: "C",
                    explanation: "Au comes from the Latin word 'aurum' meaning gold."
                }
            ],
            geography: [
                {
                    question: "What is the capital of Australia?",
                    options: {
                        A: "Sydney",
                        B: "Melbourne", 
                        C: "Canberra",
                        D: "Perth"
                    },
                    correctAnswer: "C",
                    explanation: "Canberra is the capital city of Australia, located between Sydney and Melbourne."
                }
            ]
        };
        return questions[category] || questions.history;
    }
    getDifficultyPoints() {
        const points = {
            easy: 10,
            medium: 15,
            hard: 25
        };
        return points[this.currentDifficulty] || 10;
    }
    adjustDifficulty(correct) {
        if (correct && this.currentDifficulty === 'easy') {
            this.currentDifficulty = 'medium';
        } else if (correct && this.currentDifficulty === 'medium') {
            this.currentDifficulty = 'hard';
        } else if (!correct && this.currentDifficulty === 'hard') {
            this.currentDifficulty = 'medium';
        } else if (!correct && this.currentDifficulty === 'medium') {
            this.currentDifficulty = 'easy';
        }
    }
    getMessageHistory() {
        return this.messages;
    }
    clearHistory() {
        this.messages = [];
        this.currentScore = 0;
        this.questionsAsked = 0;
        this.currentQuestion = null;
        this.awaitingAnswer = false;
        this.currentDifficulty = 'easy';
    }
    getQuizStats() {
        return {
            score: this.currentScore,
            questionsAsked: this.questionsAsked,
            difficulty: this.currentDifficulty,
            awaitingAnswer: this.awaitingAnswer
        };
    }
}
// ProgressLogger for tracking quiz events
class QuizProgressLogger {
    static logProgress(eventType, data = {}) {
        const logEntry = {
            timestamp: Date.now(),
            eventType,
            data
        };
        
        console.log(`[QuizProgressLogger] ${eventType}:`, data);
        
        // Store in localStorage for persistence
        const existingLogs = JSON.parse(localStorage.getItem('quizProgressLogs') || '[]');
        existingLogs.push(logEntry);
        
        // Keep only last 100 entries to prevent storage bloat
        if (existingLogs.length > 100) {
            existingLogs.splice(0, existingLogs.length - 100);
        }
        
        localStorage.setItem('quizProgressLogs', JSON.stringify(existingLogs));
    }
    static getProgressHistory() {
        return JSON.parse(localStorage.getItem('quizProgressLogs') || '[]');
    }
    static clearProgressHistory() {
        localStorage.removeItem('quizProgressLogs');
    }
}
// Export the classes and constants for use in game.js
if (typeof window !== 'undefined') {
    try {
        window.QuizChatManager = QuizChatManager;
        window.QuizProgressLogger = QuizProgressLogger;
        window.QUIZ_CHARACTER_DESCRIPTION = CHARACTER_DESCRIPTION;
        window.QUIZ_CHARACTER_NAME = CHARACTER_NAME;
    } catch (e) {
        console.warn('Error while exposing quiz classes to window:', e);
    }
}
// Also provide exports for module imports
export { QuizChatManager, QuizProgressLogger, CHARACTER_DESCRIPTION, CHARACTER_NAME };