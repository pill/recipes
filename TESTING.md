# Testing with Vitest

This project uses [Vitest](https://vitest.dev/) for unit testing, which provides fast test execution and excellent TypeScript support.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test

# Run tests once (CI mode)
npm run test:run

# Run tests with coverage
npm run test:coverage

# Open Vitest UI (interactive test runner)
npm run test:ui
```

## Test Structure

Tests are organized to match the source code structure:

- `models/` - Tests for data models and interfaces
- `schemas/` - Tests for Zod validation schemas
- `services/` - Tests for service classes (with mocked dependencies)

## Test Files

- `models/Recipe.test.ts` - Tests for Recipe, Ingredient, Measurement interfaces
- `schemas/recipe-schema.test.ts` - Tests for Zod validation schemas
- `services/AIService.test.ts` - Tests for AI service functionality

## Coverage

The project includes test coverage reporting using v8. Coverage reports are generated in the `coverage/` directory and can be viewed in HTML format.

Current coverage:
- **Statements**: 6.15%
- **Branches**: 35.71%
- **Functions**: 21.05%
- **Lines**: 6.15%

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect } from 'vitest';

describe('MyClass', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

### Mocking Dependencies

For services that depend on external APIs or databases, use Vitest's mocking capabilities:

```typescript
import { vi } from 'vitest';

// Mock external dependencies
vi.mock('../external-service', () => ({
  ExternalService: {
    method: vi.fn()
  }
}));
```

### Testing Async Code

```typescript
it('should handle async operations', async () => {
  const result = await myAsyncFunction();
  expect(result).toBeDefined();
});
```

## Configuration

Vitest configuration is in `vitest.config.ts`:

- **Environment**: Node.js
- **Globals**: Enabled (no need to import `describe`, `it`, `expect`)
- **Coverage**: v8 provider with HTML, JSON, and text reports
- **File patterns**: `**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}`

## Best Practices

1. **Test Structure**: Follow the AAA pattern (Arrange, Act, Assert)
2. **Descriptive Names**: Use clear, descriptive test names
3. **Mock External Dependencies**: Don't make real API calls in tests
4. **Test Edge Cases**: Include tests for error conditions and edge cases
5. **Keep Tests Fast**: Use mocks to avoid slow operations
6. **One Assertion Per Test**: Each test should verify one specific behavior

## Migration from Jest

This project was migrated from Jest to Vitest for:
- Better TypeScript support
- Faster test execution
- Built-in ESM support
- Better integration with modern tooling
- Smaller bundle size
