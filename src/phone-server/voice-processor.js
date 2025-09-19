const tf = require('@tensorflow/tfjs-node');
const EventEmitter = require('events');
const Logger = require('../shared/logger');

/**
 * Voice Recognition and Natural Language Processing Module
 * Handles speech-to-text conversion and intent analysis
 */
class VoiceProcessor extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            sampleRate: config.sampleRate || 16000,
            modelPath: config.modelPath || './models/voice-model.json',
            languageModels: config.languageModels || ['en-US', 'es-ES', 'fr-FR'],
            confidenceThreshold: config.confidenceThreshold || 0.7,
            maxAudioLength: config.maxAudioLength || 30, // seconds
            ...config
        };
        
        this.logger = new Logger('VoiceProcessor');
        this.speechModel = null;
        this.intentModel = null;
        this.isInitialized = false;
        this.processingQueue = [];
        this.metrics = {
            totalProcessed: 0,
            successfulTranscriptions: 0,
            averageProcessingTime: 0,
            intentAccuracy: 0
        };
        
        // Common intents and their keywords
        this.intentPatterns = {
            'billing_inquiry': ['bill', 'billing', 'payment', 'charge', 'invoice', 'account'],
            'technical_support': ['not working', 'broken', 'error', 'problem', 'issue', 'bug'],
            'account_management': ['account', 'profile', 'settings', 'update', 'change'],
            'service_request': ['request', 'need', 'want', 'service', 'help'],
            'complaint': ['complaint', 'unhappy', 'dissatisfied', 'angry', 'frustrated'],
            'cancellation': ['cancel', 'terminate', 'end', 'stop', 'quit'],
            'information': ['information', 'hours', 'location', 'contact', 'how to']
        };
    }

    async initialize() {
        try {
            this.logger.info('Initializing Voice Processor...');
            
            // Load speech recognition model
            await this.loadSpeechModel();
            
            // Load intent classification model
            await this.loadIntentModel();
            
            // Start processing queue worker
            this.startQueueProcessor();
            
            this.isInitialized = true;
            this.logger.info('Voice Processor initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Voice Processor:', error);
            throw error;
        }
    }

    async loadSpeechModel() {
        try {
            // In a real implementation, this would load a pre-trained speech model
            // For demo purposes, we'll create a simplified model structure
            this.speechModel = this.createSpeechModel();
            await this.trainSpeechModel();
            this.logger.info('Speech recognition model loaded');
        } catch (error) {
            this.logger.error('Failed to load speech model:', error);
            throw error;
        }
    }

    createSpeechModel() {
        // Simplified neural network for speech processing
        // In reality, this would be a much more complex model (e.g., DeepSpeech, Wav2Vec)
        const model = tf.sequential({
            layers: [
                tf.layers.dense({
                    inputShape: [128], // Simplified audio features
                    units: 256,
                    activation: 'relu'
                }),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({
                    units: 128,
                    activation: 'relu'
                }),
                tf.layers.dense({
                    units: 64,
                    activation: 'relu'
                }),
                tf.layers.dense({
                    units: 26, // 26 letters + space
                    activation: 'softmax'
                })
            ]
        });

        model.compile({
            optimizer: 'adam',
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        return model;
    }

    async trainSpeechModel() {
        // Generate synthetic training data for demonstration
        const trainingData = this.generateSpeechTrainingData(1000);
        
        const xs = tf.tensor2d(trainingData.features);
        const ys = tf.tensor2d(trainingData.labels);

        await this.speechModel.fit(xs, ys, {
            epochs: 20,
            batchSize: 32,
            validationSplit: 0.2,
            verbose: 0
        });

        xs.dispose();
        ys.dispose();
        
        this.logger.info('Speech model training completed');
    }

    generateSpeechTrainingData(numSamples) {
        const features = [];
        const labels = [];

        for (let i = 0; i < numSamples; i++) {
            // Generate synthetic audio features (MFCC-like)
            const feature = Array.from({ length: 128 }, () => Math.random());
            
            // Generate corresponding character label
            const charIndex = Math.floor(Math.random() * 26);
            const label = new Array(26).fill(0);
            label[charIndex] = 1;
            
            features.push(feature);
            labels.push(label);
        }

        return { features, labels };
    }

    async loadIntentModel() {
        try {
            this.intentModel = this.createIntentModel();
            await this.trainIntentModel();
            this.logger.info('Intent classification model loaded');
        } catch (error) {
            this.logger.error('Failed to load intent model:', error);
            throw error;
        }
    }

    createIntentModel() {
        // Text classification model for intent recognition
        const model = tf.sequential({
            layers: [
                tf.layers.dense({
                    inputShape: [100], // Text embeddings
                    units: 128,
                    activation: 'relu'
                }),
                tf.layers.dropout({ rate: 0.5 }),
                tf.layers.dense({
                    units: 64,
                    activation: 'relu'
                }),
                tf.layers.dense({
                    units: Object.keys(this.intentPatterns).length,
                    activation: 'softmax'
                })
            ]
        });

        model.compile({
            optimizer: 'adam',
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        return model;
    }

    async trainIntentModel() {
        const trainingData = this.generateIntentTrainingData(2000);
        
        const xs = tf.tensor2d(trainingData.features);
        const ys = tf.tensor2d(trainingData.labels);

        await this.intentModel.fit(xs, ys, {
            epochs: 30,
            batchSize: 32,
            validationSplit: 0.2,
            verbose: 0
        });

        xs.dispose();
        ys.dispose();
        
        this.logger.info('Intent model training completed');
    }

    generateIntentTrainingData(numSamples) {
        const features = [];
        const labels = [];
        const intents = Object.keys(this.intentPatterns);

        for (let i = 0; i < numSamples; i++) {
            // Generate text embeddings (simplified)
            const feature = Array.from({ length: 100 }, () => Math.random());
            
            // Generate intent label
            const intentIndex = Math.floor(Math.random() * intents.length);
            const label = new Array(intents.length).fill(0);
            label[intentIndex] = 1;
            
            features.push(feature);
            labels.push(label);
        }

        return { features, labels };
    }

    async processVoice(audioData) {
        if (!this.isInitialized) {
            throw new Error('Voice Processor not initialized');
        }

        const processId = this.generateProcessId();
        const startTime = Date.now();

        try {
            // Validate audio data
            this.validateAudioData(audioData);

            // Add to processing queue
            const processPromise = new Promise((resolve, reject) => {
                this.processingQueue.push({
                    id: processId,
                    audioData,
                    startTime,
                    resolve,
                    reject
                });
            });

            const result = await processPromise;
            
            // Update metrics
            const processingTime = Date.now() - startTime;
            this.updateMetrics(processingTime, true);
            
            this.emit('voiceProcessed', { processId, result, processingTime });
            
            return {
                success: true,
                processId,
                transcription: result.transcription,
                intent: result.intent,
                confidence: result.confidence,
                processingTime,
                metadata: result.metadata
            };
            
        } catch (error) {
            this.logger.error(`Voice processing failed for ${processId}:`, error);
            this.updateMetrics(Date.now() - startTime, false);
            
            return {
                success: false,
                processId,
                error: error.message,
                processingTime: Date.now() - startTime
            };
        }
    }

    validateAudioData(audioData) {
        if (!audioData || !audioData.buffer) {
            throw new Error('Invalid audio data: missing buffer');
        }

        if (!audioData.sampleRate) {
            throw new Error('Invalid audio data: missing sample rate');
        }

        if (audioData.duration > this.config.maxAudioLength) {
            throw new Error(`Audio too long: ${audioData.duration}s (max: ${this.config.maxAudioLength}s)`);
        }

        if (audioData.sampleRate !== this.config.sampleRate) {
            this.logger.warn(`Sample rate mismatch: expected ${this.config.sampleRate}, got ${audioData.sampleRate}`);
        }
    }

    startQueueProcessor() {
        // Process audio in queue to manage resources
        setInterval(async () => {
            if (this.processingQueue.length === 0) return;
            
            const task = this.processingQueue.shift();
            try {
                const result = await this.processAudioInternal(task.audioData);
                task.resolve(result);
            } catch (error) {
                task.reject(error);
            }
        }, 100); // Process every 100ms
    }

    async processAudioInternal(audioData) {
        // Step 1: Extract audio features
        const audioFeatures = this.extractAudioFeatures(audioData);
        
        // Step 2: Speech-to-text conversion
        const transcription = await this.speechToText(audioFeatures);
        
        // Step 3: Intent classification
        const intent = await this.classifyIntent(transcription.text);
        
        // Step 4: Extract additional metadata
        const metadata = this.extractMetadata(audioData, transcription);
        
        return {
            transcription,
            intent,
            confidence: Math.min(transcription.confidence, intent.confidence),
            metadata
        };
    }

    extractAudioFeatures(audioData) {
        // Simulate audio feature extraction (MFCC, spectrogram, etc.)
        // In a real implementation, this would use libraries like librosa or WebAudio API
        
        const buffer = audioData.buffer;
        const sampleRate = audioData.sampleRate;
        const duration = audioData.duration;
        
        // Generate simplified features
        const features = {
            mfcc: Array.from({ length: 128 }, () => Math.random()),
            spectralCentroid: Math.random(),
            zeroCrossingRate: Math.random(),
            energy: Math.random(),
            pitch: Math.random() * 500 + 100, // 100-600 Hz
            formants: [Math.random() * 1000, Math.random() * 2000, Math.random() * 3000],
            duration,
            sampleRate
        };
        
        return features;
    }

    async speechToText(audioFeatures) {
        try {
            // In a real implementation, this would use the actual speech model
            // For demo, we'll simulate the process and return sample text
            
            const input = tf.tensor2d([audioFeatures.mfcc]);
            const prediction = this.speechModel.predict(input);
            const probabilities = await prediction.data();
            
            input.dispose();
            prediction.dispose();
            
            // Simulate character-by-character recognition and assembly into words
            const sampleTexts = [
                "I need help with my billing",
                "My internet is not working",
                "Can you help me update my account",
                "I want to cancel my service",
                "What are your business hours",
                "I have a technical problem",
                "I'm not satisfied with the service"
            ];
            
            const randomText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
            const confidence = Math.max(...probabilities);
            
            return {
                text: randomText,
                confidence: confidence > this.config.confidenceThreshold ? confidence : 0.8,
                alternatives: this.generateAlternatives(randomText),
                language: this.detectLanguage(randomText)
            };
            
        } catch (error) {
            this.logger.error('Speech-to-text conversion failed:', error);
            throw new Error('Speech recognition failed');
        }
    }

    generateAlternatives(text) {
        // Generate alternative transcriptions with slight variations
        const words = text.split(' ');
        const alternatives = [];
        
        for (let i = 0; i < 2; i++) {
            const altWords = words.map(word => {
                if (Math.random() < 0.1) {
                    // Simulate OCR/ASR errors
                    return word.replace(/[aeiou]/, 'e');
                }
                return word;
            });
            alternatives.push({
                text: altWords.join(' '),
                confidence: Math.random() * 0.3 + 0.4
            });
        }
        
        return alternatives;
    }

    detectLanguage(text) {
        // Simple language detection based on keywords
        const spanishKeywords = ['ayuda', 'problema', 'cuenta', 'servicio'];
        const frenchKeywords = ['aide', 'problème', 'compte', 'service'];
        
        const lowerText = text.toLowerCase();
        
        if (spanishKeywords.some(keyword => lowerText.includes(keyword))) {
            return 'es-ES';
        } else if (frenchKeywords.some(keyword => lowerText.includes(keyword))) {
            return 'fr-FR';
        }
        
        return 'en-US';
    }

    async classifyIntent(transcription) {
        try {
            const text = transcription.text.toLowerCase();
            
            // First, try rule-based classification
            const ruleBasedIntent = this.classifyIntentRuleBased(text);
            
            if (ruleBasedIntent.confidence > 0.8) {
                return ruleBasedIntent;
            }
            
            // Use ML model for classification
            const textEmbedding = this.generateTextEmbedding(text);
            const input = tf.tensor2d([textEmbedding]);
            const prediction = this.intentModel.predict(input);
            const probabilities = await prediction.data();
            
            input.dispose();
            prediction.dispose();
            
            const intents = Object.keys(this.intentPatterns);
            const maxIndex = probabilities.indexOf(Math.max(...probabilities));
            const confidence = probabilities[maxIndex];
            
            return {
                intent: intents[maxIndex],
                confidence,
                alternatives: this.getAlternativeIntents(probabilities, intents),
                entities: this.extractEntities(text)
            };
            
        } catch (error) {
            this.logger.error('Intent classification failed:', error);
            return {
                intent: 'unknown',
                confidence: 0.0,
                alternatives: [],
                entities: []
            };
        }
    }

    classifyIntentRuleBased(text) {
        let bestIntent = 'unknown';
        let maxScore = 0;
        
        for (const [intent, keywords] of Object.entries(this.intentPatterns)) {
            let score = 0;
            for (const keyword of keywords) {
                if (text.includes(keyword)) {
                    score += 1 / keywords.length;
                }
            }
            
            if (score > maxScore) {
                maxScore = score;
                bestIntent = intent;
            }
        }
        
        return {
            intent: bestIntent,
            confidence: maxScore,
            method: 'rule-based'
        };
    }

    generateTextEmbedding(text) {
        // Simplified text embedding generation
        // In practice, you'd use pre-trained embeddings like Word2Vec, GloVe, or BERT
        const words = text.split(' ');
        const embedding = new Array(100).fill(0);
        
        words.forEach((word, index) => {
            for (let i = 0; i < word.length && i < 100; i++) {
                embedding[i] += word.charCodeAt(i % word.length) / 1000;
            }
        });
        
        // Normalize
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return embedding.map(val => val / (norm || 1));
    }

    getAlternativeIntents(probabilities, intents) {
        const sorted = intents
            .map((intent, index) => ({ intent, confidence: probabilities[index] }))
            .sort((a, b) => b.confidence - a.confidence)
            .slice(1, 4); // Top 3 alternatives
        
        return sorted;
    }

    extractEntities(text) {
        const entities = [];
        
        // Extract phone numbers
        const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
        const phones = text.match(phoneRegex);
        if (phones) {
            phones.forEach(phone => {
                entities.push({ type: 'phone', value: phone });
            });
        }
        
        // Extract email addresses
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const emails = text.match(emailRegex);
        if (emails) {
            emails.forEach(email => {
                entities.push({ type: 'email', value: email });
            });
        }
        
        // Extract account numbers
        const accountRegex = /\b(?:account|acct)\s*(?:number|#|num)?\s*:?\s*([A-Z0-9]{6,12})\b/gi;
        const accounts = text.match(accountRegex);
        if (accounts) {
            accounts.forEach(account => {
                entities.push({ type: 'account_number', value: account });
            });
        }
        
        // Extract dollar amounts
        const amountRegex = /\$\d+(?:\.\d{2})?/g;
        const amounts = text.match(amountRegex);
        if (amounts) {
            amounts.forEach(amount => {
                entities.push({ type: 'amount', value: amount });
            });
        }
        
        return entities;
    }

    extractMetadata(audioData, transcription) {
        return {
            audioQuality: this.assessAudioQuality(audioData),
            speakerCharacteristics: this.analyzeSpeaker(audioData),
            emotionalTone: this.analyzeEmotion(transcription.text),
            backgroundNoise: this.detectBackgroundNoise(audioData),
            speechRate: this.calculateSpeechRate(transcription.text, audioData.duration),
            confidence: transcription.confidence
        };
    }

    assessAudioQuality(audioData) {
        // Simulate audio quality assessment
        const snr = Math.random() * 40 + 10; // 10-50 dB SNR
        const quality = snr > 30 ? 'excellent' : snr > 20 ? 'good' : snr > 10 ? 'fair' : 'poor';
        
        return {
            snr,
            quality,
            sampleRate: audioData.sampleRate,
            bitDepth: audioData.bitDepth || 16
        };
    }

    analyzeSpeaker(audioData) {
        // Simulate speaker analysis
        return {
            gender: Math.random() > 0.5 ? 'male' : 'female',
            ageGroup: ['child', 'young_adult', 'adult', 'senior'][Math.floor(Math.random() * 4)],
            accent: ['american', 'british', 'australian', 'other'][Math.floor(Math.random() * 4)],
            speakingRate: Math.random() * 200 + 100 // words per minute
        };
    }

    analyzeEmotion(text) {
        // Simple emotion analysis based on keywords
        const emotionKeywords = {
            'angry': ['angry', 'frustrated', 'mad', 'annoyed', 'furious'],
            'sad': ['sad', 'disappointed', 'upset', 'unhappy'],
            'happy': ['happy', 'satisfied', 'pleased', 'glad', 'great'],
            'neutral': []
        };
        
        const lowerText = text.toLowerCase();
        
        for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
            if (keywords.some(keyword => lowerText.includes(keyword))) {
                return {
                    primary: emotion,
                    confidence: 0.7,
                    score: Math.random() * 0.3 + 0.7
                };
            }
        }
        
        return {
            primary: 'neutral',
            confidence: 0.8,
            score: 0.5
        };
    }

    detectBackgroundNoise(audioData) {
        // Simulate background noise detection
        const noiseLevel = Math.random() * 60; // dB
        const noiseTypes = [];
        
        if (noiseLevel > 40) noiseTypes.push('traffic');
        if (noiseLevel > 30) noiseTypes.push('voices');
        if (noiseLevel > 20) noiseTypes.push('music');
        
        return {
            level: noiseLevel,
            types: noiseTypes,
            interference: noiseLevel > 35 ? 'high' : noiseLevel > 20 ? 'medium' : 'low'
        };
    }

    calculateSpeechRate(text, duration) {
        const wordCount = text.split(' ').length;
        const wordsPerMinute = (wordCount / duration) * 60;
        
        return {
            wordsPerMinute,
            characterCount: text.length,
            syllableCount: this.estimateSyllables(text)
        };
    }

    estimateSyllables(text) {
        // Simple syllable estimation
        return text.toLowerCase().replace(/[^a-z]/g, '').match(/[aeiouy]+/g)?.length || 1;
    }

    generateProcessId() {
        return `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    updateMetrics(processingTime, success) {
        this.metrics.totalProcessed++;
        
        if (success) {
            this.metrics.successfulTranscriptions++;
        }
        
        // Update average processing time
        const currentAvg = this.metrics.averageProcessingTime;
        const total = this.metrics.totalProcessed;
        this.metrics.averageProcessingTime = 
            (currentAvg * (total - 1) + processingTime) / total;
    }

    getStatus() {
        const successRate = this.metrics.totalProcessed > 0 ? 
            this.metrics.successfulTranscriptions / this.metrics.totalProcessed : 0;
        
        return {
            initialized: this.isInitialized,
            queueLength: this.processingQueue.length,
            totalProcessed: this.metrics.totalProcessed,
            successRate,
            averageProcessingTime: this.metrics.averageProcessingTime,
            supportedLanguages: this.config.languageModels,
            modelsLoaded: {
                speech: this.speechModel !== null,
                intent: this.intentModel !== null
            }
        };
    }

    async shutdown() {
        this.logger.info('Shutting down Voice Processor...');
        
        // Clear processing queue
        this.processingQueue.forEach(task => {
            task.reject(new Error('Service shutting down'));
        });
        this.processingQueue = [];
        
        // Dispose models
        if (this.speechModel) {
            this.speechModel.dispose();
        }
        
        if (this.intentModel) {
            this.intentModel.dispose();
        }
        
        this.removeAllListeners();
        this.isInitialized = false;
    }
}

module.exports = VoiceProcessor;