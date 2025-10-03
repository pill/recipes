import Anthropic from '@anthropic-ai/sdk';
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AIService {
  private anthropic: Anthropic;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    // More aggressive trimming to handle any whitespace issues
    const cleanKey = key.replace(/\s/g, '').trim();
    if (!cleanKey || cleanKey.length < 10) {
      throw new Error('ANTHROPIC_API_KEY appears to be invalid or empty');
    }
    
    this.anthropic = new Anthropic({
      apiKey: cleanKey,
    });
  }

  /**
   * Send a single message to Claude and get a response
   */
  async sendMessage(
    message: string,
    options: {
      model?: string;
      maxTokens?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<AIResponse> {
    const {
      model = 'claude-3-haiku-20240307',
      maxTokens = 1000,
      systemPrompt
    } = options;

    const messages: AIMessage[] = [
      { role: 'user', content: message }
    ];

    const requestBody: any = {
      model,
      max_tokens: maxTokens,
      messages
    };

    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    try {
      const response = await this.anthropic.messages.create(requestBody);
      
      return {
        content: response.content[0].type === 'text' ? response.content[0].text : '',
        usage: response.usage ? {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens
        } : undefined
      };
    } catch (error) {
      console.error('AI Service Error:', error);
      throw new Error(`Failed to get AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send a conversation (multiple messages) to Claude
   */
  async sendConversation(
    messages: AIMessage[],
    options: {
      model?: string;
      maxTokens?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<AIResponse> {
    const {
      model = 'claude-3-haiku-20240307',
      maxTokens = 1000,
      systemPrompt
    } = options;

    const requestBody: any = {
      model,
      max_tokens: maxTokens,
      messages
    };

    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    try {
      const response = await this.anthropic.messages.create(requestBody);
      
      return {
        content: response.content[0].type === 'text' ? response.content[0].text : '',
        usage: response.usage ? {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens
        } : undefined
      };
    } catch (error) {
      console.error('AI Service Error:', error);
      throw new Error(`Failed to get AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract structured data from text using AI (legacy method using sendMessage)
   */
  async extractData<T>(
    text: string,
    schema: string,
    options: {
      model?: string;
      maxTokens?: number;
    } = {}
  ): Promise<T> {
    const prompt = `Please extract the following information from the text and return it as valid JSON matching this schema: ${schema}

Text to analyze:
${text}

Return only the JSON object, no additional text.`;

    const response = await this.sendMessage(prompt, options);
    
    try {
      return JSON.parse(response.content);
    } catch (error) {
      throw new Error(`Failed to parse AI response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract structured data from text using generateObject (recommended)
   */
  async extractStructuredData<T>(
    text: string,
    schema: z.ZodSchema<T>,
    options: {
      model?: string;
      maxTokens?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<T> {
    const {
      model = 'claude-3-haiku-20240307',
      maxTokens = 1000,
      systemPrompt
    } = options;

    try {
      const result = await generateObject({
        model: anthropic(model),
        schema,
        prompt: `Extract the following information from the text:

${text}`,
        system: systemPrompt || 'You are an expert at extracting structured data from text. Return only the requested information in the exact format specified.',
        maxTokens
      });

      return result.object;
    } catch (error) {
      console.error('Structured data extraction error:', error);
      throw new Error(`Failed to extract structured data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract recipe data from Reddit post text using the standardized recipe schema
   */
  async extractRecipeData(
    redditPostText: string,
    options: {
      model?: string;
      maxTokens?: number;
    } = {}
  ): Promise<import('../schemas/recipe-schema').Recipe> {
    const { RecipeSchema } = await import('../schemas/recipe-schema');
    
    return this.extractStructuredData(
      redditPostText,
      RecipeSchema,
      {
        ...options,
        systemPrompt: `You are an expert at extracting detailed recipe information from Reddit posts. 

Focus on:
- Accurate ingredient names and amounts
- Clear, step-by-step instructions with descriptive titles
- Proper timing information (prep time, chill time, etc.)
- Equipment requirements (pan sizes, etc.)

Extract all available information and structure it according to the provided schema.`
      }
    );
  }

  /**
   * Summarize text content
   */
  async summarize(
    text: string,
    maxLength: number = 200,
    options: {
      model?: string;
      maxTokens?: number;
    } = {}
  ): Promise<string> {
    const prompt = `Please summarize the following text in approximately ${maxLength} characters or less:

${text}`;

    const response = await this.sendMessage(prompt, options);
    return response.content;
  }

  /**
   * Translate text to another language
   */
  async translate(
    text: string,
    targetLanguage: string,
    options: {
      model?: string;
      maxTokens?: number;
    } = {}
  ): Promise<string> {
    const prompt = `Please translate the following text to ${targetLanguage}:

${text}`;

    const response = await this.sendMessage(prompt, options);
    return response.content;
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }
}

// Export a function to get the service instance
let _aiService: AIService | null = null;

export function getAIService(): AIService {
  if (!_aiService) {
    _aiService = new AIService();
  }
  return _aiService;
}
