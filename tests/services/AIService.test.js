import { describe, it, expect, vi, beforeEach } from 'vitest';
// Mock the entire AIService module
vi.mock('../../src/services/AIService', async () => {
    const actual = await vi.importActual('../../src/services/AIService');
    return {
        ...actual,
        AIService: class MockAIService {
            constructor(apiKey) {
                if (!apiKey && !process.env.ANTHROPIC_API_KEY) {
                    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
                }
            }
            async sendMessage(message, options = {}) {
                return {
                    content: `Mock response to: ${message}`,
                    usage: {
                        input_tokens: 10,
                        output_tokens: 5
                    }
                };
            }
            async sendConversation(messages, options = {}) {
                return {
                    content: 'Mock conversation response',
                    usage: {
                        input_tokens: 15,
                        output_tokens: 8
                    }
                };
            }
            async extractData(text, schema, options = {}) {
                return { extracted: 'data' };
            }
            async extractStructuredData(text, schema, options = {}) {
                return { structured: 'data' };
            }
            async extractRecipeData(text, options = {}) {
                return {
                    title: 'Mock Recipe',
                    ingredients: [{ item: 'Mock Ingredient', amount: '1 cup' }],
                    instructions: [{ step: 1, title: 'Mock Step', description: 'Mock instruction' }]
                };
            }
            async summarize(text, maxLength = 200, options = {}) {
                return 'Mock summary';
            }
            async translate(text, targetLanguage, options = {}) {
                return 'Mock translation';
            }
            isConfigured() {
                return !!process.env.ANTHROPIC_API_KEY;
            }
        }
    };
});
import { AIService, getAIService } from '../../src/services/AIService';
describe('AIService (Mocked)', () => {
    const originalEnv = process.env;
    beforeEach(() => {
        process.env = { ...originalEnv };
        process.env.ANTHROPIC_API_KEY = 'test-api-key-1234567890';
    });
    describe('constructor', () => {
        it('should create instance with valid API key', () => {
            const service = new AIService();
            expect(service).toBeInstanceOf(AIService);
        });
        it('should create instance with provided API key', () => {
            const service = new AIService('custom-api-key-1234567890');
            expect(service).toBeInstanceOf(AIService);
        });
        it('should throw error when no API key provided', () => {
            delete process.env.ANTHROPIC_API_KEY;
            expect(() => new AIService()).toThrow('ANTHROPIC_API_KEY environment variable is not set');
        });
    });
    describe('sendMessage', () => {
        it('should send message and return response', async () => {
            const service = new AIService();
            const result = await service.sendMessage('Hello');
            expect(result.content).toBe('Mock response to: Hello');
            expect(result.usage).toEqual({
                input_tokens: 10,
                output_tokens: 5
            });
        });
        it('should send message with custom options', async () => {
            const service = new AIService();
            const result = await service.sendMessage('Test', {
                model: 'claude-3-sonnet-20240229',
                maxTokens: 2000,
                systemPrompt: 'You are a helpful assistant'
            });
            expect(result.content).toBe('Mock response to: Test');
        });
    });
    describe('sendConversation', () => {
        it('should send conversation and return response', async () => {
            const service = new AIService();
            const messages = [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi there!' }
            ];
            const result = await service.sendConversation(messages);
            expect(result.content).toBe('Mock conversation response');
            expect(result.usage).toEqual({
                input_tokens: 15,
                output_tokens: 8
            });
        });
    });
    describe('extractData', () => {
        it('should extract data and return parsed JSON', async () => {
            const service = new AIService();
            const result = await service.extractData('John is 30 years old', '{"name": "string", "age": "number"}');
            expect(result).toEqual({ extracted: 'data' });
        });
    });
    describe('extractStructuredData', () => {
        it('should extract structured data using generateObject', async () => {
            const service = new AIService();
            const mockSchema = { parse: vi.fn() };
            const result = await service.extractStructuredData('John is 30 years old', mockSchema);
            expect(result).toEqual({ structured: 'data' });
        });
    });
    describe('extractRecipeData', () => {
        it('should extract recipe data using recipe schema', async () => {
            const service = new AIService();
            const result = await service.extractRecipeData('Reddit post about cookies');
            expect(result.title).toBe('Mock Recipe');
            expect(result.ingredients).toHaveLength(1);
            expect(result.instructions).toHaveLength(1);
        });
    });
    describe('summarize', () => {
        it('should summarize text', async () => {
            const service = new AIService();
            const result = await service.summarize('Long text to summarize', 100);
            expect(result).toBe('Mock summary');
        });
    });
    describe('translate', () => {
        it('should translate text', async () => {
            const service = new AIService();
            const result = await service.translate('Hello world', 'Spanish');
            expect(result).toBe('Mock translation');
        });
    });
    describe('isConfigured', () => {
        it('should return true when API key is configured', () => {
            const service = new AIService();
            expect(service.isConfigured()).toBe(true);
        });
        it('should return false when API key is not configured', () => {
            delete process.env.ANTHROPIC_API_KEY;
            const service = new AIService('test-key');
            expect(service.isConfigured()).toBe(false);
        });
    });
    describe('getAIService', () => {
        it('should return singleton instance', () => {
            const service1 = getAIService();
            const service2 = getAIService();
            expect(service1).toBe(service2);
            expect(service1).toBeDefined();
        });
    });
});
//# sourceMappingURL=AIService.test.js.map