import csvParser from 'csv-parser';
import fs from 'fs';
import { config } from 'dotenv';


/*
This script will parse the Reddit recipes dataset into JSON using AI.

It will use the RecipeExtractionSchema to parse the data.
It will use the getAIService to parse the data.
It will use the RecipeSchema to parse the data.
It will use the RecipeIngredientSchema to parse the data.
It will use the RecipeInstructionSchema to parse the data.
It will use the RecipeSchema to parse the data.

*/

// Load environment variables from .env file FIRST
config();

import { getAIService, AIResponse } from '../services/AIService';
import { RecipeExtractionSchema } from '../schemas/recipe-extraction';

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
        const result = await aiService.extractStructuredData(comments[0], RecipeExtractionSchema)
        console.log('result:')
        console.log(result)
    });

}


// Run the function
processRecipes().catch(console.error);




