# Project Structure

This document describes the improved project structure for the Reddit Recipes application.

## 📁 Directory Structure

```
reddit-recipes/
├── src/                          # Source code
│   ├── models/                   # Data models and interfaces
│   │   └── Recipe.ts
│   ├── schemas/                  # Zod validation schemas
│   │   ├── recipe-extraction.ts
│   │   ├── recipe-schema.ts
│   │   └── validate-sample.ts
│   ├── services/                 # Business logic services
│   │   ├── AIService.ts
│   │   ├── IngredientService.ts
│   │   └── RecipeService.ts
│   ├── utils/                    # Utility functions
│   │   └── csv_to_json.ts
│   ├── database.ts               # Database connection
│   └── main.ts                   # Application entry point
├── tests/                        # Test files (mirrors src structure)
│   ├── models/
│   │   └── Recipe.test.ts
│   ├── schemas/
│   │   └── recipe-schema.test.ts
│   └── services/
│       └── AIService.test.ts
├── scripts/                      # Utility scripts and examples
│   ├── examples/
│   │   └── recipe-extraction-example.ts
│   ├── test-db.ts
│   └── setup-db.sh
├── data/                         # Data files
│   ├── raw/                      # Raw CSV data
│   ├── samples/                  # Sample JSON data
│   └── stage/                    # Staging area
├── db/                           # Database files
│   ├── init-db.sql
│   └── schema.sql
├── docs/                         # Documentation
│   └── AGENTS.md
├── dist/                         # Compiled output (generated)
├── coverage/                     # Test coverage reports (generated)
├── node_modules/                 # Dependencies (generated)
├── package.json                  # Project configuration
├── tsconfig.json                 # TypeScript configuration
├── vitest.config.ts              # Test configuration
├── docker-compose.yml            # Docker configuration
├── README.md                     # Project documentation
├── TESTING.md                    # Testing documentation
└── PROJECT_STRUCTURE.md          # This file
```

## 🎯 Benefits of This Structure

### 1. **Clear Separation of Concerns**
- **`src/`**: All source code in one place
- **`tests/`**: Test files mirror the source structure
- **`scripts/`**: Utility scripts and examples separated
- **`data/`**: Data files organized by type
- **`docs/`**: Documentation centralized

### 2. **Scalability**
- Easy to add new modules in `src/`
- Test files automatically follow the same structure
- Clear boundaries between different types of files

### 3. **Developer Experience**
- Intuitive file locations
- Easy to find related files
- Consistent import paths
- Clear build output in `dist/`

### 4. **Maintainability**
- Logical grouping of related functionality
- Easy to refactor and reorganize
- Clear dependencies between modules

## 📝 Import Paths

### From Source Files
```typescript
// Import from models
import { Recipe } from '../models/Recipe';

// Import from services
import { RecipeService } from './RecipeService';

// Import from schemas
import { RecipeSchema } from '../schemas/recipe-schema';
```

### From Test Files
```typescript
// Import from source
import { Recipe } from '../../src/models/Recipe';
import { RecipeService } from '../../src/services/RecipeService';
```

### From Scripts
```typescript
// Import from source
import { RecipeService } from '../src/services/RecipeService';
import { RecipeSchema } from '../src/schemas/recipe-schema';
```

## 🛠️ Build and Development

### Development
```bash
npm run dev          # Run main application
npm test             # Run tests in watch mode
npm run test:ui      # Open test UI
```

### Building
```bash
npm run build        # Compile TypeScript to dist/
npm run test:run     # Run tests once
npm run test:coverage # Run tests with coverage
```

### Database
```bash
npm run setup-db     # Setup database
npm run test-db      # Test database connection
npm run docker:start # Start Docker services
```

## 🔧 Configuration Files

- **`tsconfig.json`**: TypeScript compiler configuration
- **`vitest.config.ts`**: Test runner configuration
- **`docker-compose.yml`**: Docker services configuration
- **`package.json`**: Project metadata and scripts

## 📊 Testing Structure

Tests are organized to mirror the source code structure:

- **`tests/models/`**: Tests for data models
- **`tests/services/`**: Tests for business logic
- **`tests/schemas/`**: Tests for validation schemas

This makes it easy to:
- Find tests for specific modules
- Maintain test coverage
- Add new tests following the same pattern

## 🚀 Migration Benefits

The new structure provides:

1. **Better Organization**: Clear separation of source, tests, scripts, and data
2. **Improved Maintainability**: Logical grouping and consistent patterns
3. **Enhanced Developer Experience**: Intuitive file locations and import paths
4. **Scalability**: Easy to add new features and modules
5. **Professional Standards**: Follows industry best practices for TypeScript projects

## 📋 File Naming Conventions

- **Source files**: `PascalCase.ts` (e.g., `RecipeService.ts`)
- **Test files**: `PascalCase.test.ts` (e.g., `RecipeService.test.ts`)
- **Utility files**: `snake_case.ts` (e.g., `csv_to_json.ts`)
- **Configuration files**: `kebab-case` (e.g., `docker-compose.yml`)
- **Documentation**: `UPPERCASE.md` (e.g., `README.md`)
