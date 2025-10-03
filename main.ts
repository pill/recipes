import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();


/*
File for testing etc
*/

async function main() {
    try {
        // console.log('API Key loaded:', process.env.ANTHROPIC_API_KEY ? 'Yes' : 'No');
        // console.log('API Key length:', process.env.ANTHROPIC_API_KEY?.length);
        // console.log('API Key starts with:', process.env.ANTHROPIC_API_KEY?.substring(0, 20));
        // console.log('API Key ends with:', process.env.ANTHROPIC_API_KEY?.substring(-20));

        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const response = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1000,
            messages: [{ role: 'user', content: 'What is an agent?' }],
        });




        console.log('Response:', response.content[0].text);
    } catch (error) {
        console.error('Error:', error.message);
        console.log('\n💡 Note: Make sure to set your ANTHROPIC_API_KEY environment variable');
        console.log('   Get your API key at: https://console.anthropic.com/');
    }
}

main();