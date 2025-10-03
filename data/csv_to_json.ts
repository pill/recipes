import csvParser from 'csv-parser';
import fs from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file FIRST
config();

import { getAIService, AIResponse } from '../services/AIService';

// this is the CSV format of the reddit recipes dataset
type RowData = {
  date: string;
  num_comments: string;
  title: string;
  user: string;
  comment: string;
  n_char: string;
};

// first test
const filePath: string = 'data/raw/Reddit_Recipes.csv';

async function processRecipes() {
  const aiService = getAIService();
  
  // Debug environment variables
  console.log('Environment check:');
  console.log('ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);
  console.log('ANTHROPIC_API_KEY length:', process.env.ANTHROPIC_API_KEY?.length || 0);
  console.log('ANTHROPIC_API_KEY starts with:', process.env.ANTHROPIC_API_KEY?.substring(0, 10) || 'undefined');
  
  // Test AI service
  if (aiService.isConfigured()) {
    console.log('AI Service is configured. Testing...');
    try {
      const response = await aiService.sendMessage('What is an agent?');
      console.log('AI Response:', response.content);
    } catch (error) {
      console.error('AI Service Error:', error);
    }
  } else {
    console.log('AI Service not configured. Set ANTHROPIC_API_KEY environment variable.');
  }
  
  // const promises: Promise<AIResponse>[] = [];
  const comments: string[] = [];

  // Process CSV
  fs.createReadStream(filePath)
    .pipe(csvParser())
    .on('data', (row: RowData) => {
      //console.log(row.title);
      if (aiService.isConfigured()) { 
        //
        // promises.push(aiService.sendMessage('Parse the following recipe into json: ' + row.comment));
        comments.push(row.comment);
      }
    })
    .on('end', async () => {
      console.log('finished!');
      //if (promises.length > 0) {
        // only do first one to test
        // const results = await Promise.all([promises[0]]);
    
        // const result = comments[0];
        // console.log(comments[0])
        
        const result = await aiService.sendMessage('Parse the following recipe into json: ' + comments[0])
        console.log('result:')
        console.log(result.content)

        //console.log('AI processing completed:', result, 'recipes processed');
        // console.log(result.content);
      //}
    });

}


// Run the function
processRecipes().catch(console.error);




