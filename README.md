# Recipies

First dataset is Reddit Recipes from [kaggle](https://www.kaggle.com/datasets/michau96/recipes-from-reddit)
I'm just playing with some AI tools to parse the data.

## Tech (so far)
- Typescript
- Postgres
- Vercel AI
    - standardized interaction with AI models
- Zod
    - Typescript schema validation

## Ideas

### Extract
- category
- ingredients
- relative amounts
- description

### Recommender
- how to train and use models
    - ingredients
    - nutrition
    - variety
    - cost
        - grocery prices
        - sales of the week

- feedback loop
    - family preferences
    - rating after meal

- cooking skill level required
    - how many times have I cooked this before

## Workflows

### May use Temporal or similar for orchestration

### Get raw recipe data from Reddit
- Poll for new posts
    - note popularity (comments, likes?)
- Download data to "raw" s3 bucket (or local storage)
- CSV will be another source of the same data (from kaggle)
- turn into an Agent

### Transform
- take text from a comment on r/recipes and transform into a structured JSON

### Clean data
- dedupe (esp when starting to get from multiple sources)

### Load into DB
- load data from 

### Add to Search Index
- simple schema to start
- vector based recommendation
- add feedback loops to improve relevance




