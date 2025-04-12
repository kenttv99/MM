# Loading System Implementation Principles

This document outlines the core principles and standards for implementing and maintaining the loading system in our application.

## 1. Modular Context Architecture

The loading system follows a modular architecture with specialized contexts:

- **LoadingStageContext**: Manages loading stages and transitions
- **LoadingFlagsContext**: Handles loading flags and indicators
- **LoadingErrorContext**: Manages error states and reporting
- **LoadingProgressContext**: Tracks and updates loading progress
- **LoadingContextProvider**: Combines all contexts with a unified API

This modular approach allows for:
- Better separation of concerns
- Reduced complexity in individual components
- Improved testability
- More granular performance optimization

## 2. Type Safety Standards

All API interactions must follow strict type safety patterns:

```typescript
// Type-safe response handling pattern
if ('aborted' in response) {
  const abortedResponse = response as unknown as ApiAbortedResponse;
  // Handle aborted response
}

if ('error' in response) {
  const errorResponse = response as unknown as ApiErrorResponse;
  // Handle error response
}
```

Key principles:
- Always use property checking with the `in` operator
- Use the two-step casting pattern `as unknown as Type`
- Never access properties without proper type checking
- Define and use appropriate interfaces for all response types

## 3. Stage Transition Rules

Stage transitions must follow these rules:

1. **No Regression**: Higher stages cannot regress to AUTHENTICATION
2. **Cycle Prevention**: Detect and prevent rapid transitions between the same stages
3. **Validation**: All stage changes must pass through `canChangeStage` validation
4. **Auto-Progression**: Implement timeouts to prevent getting stuck in intermediate stages
5. **Error Handling**: Allow ERROR stage to transition back to AUTHENTICATION

## 4. API Request Management

All API requests must follow these principles:

1. **Stage Awareness**: Respect current loading stage restrictions
2. **Critical Requests**: Use `bypassLoadingStageCheck` for essential operations
3. **Caching**: Implement appropriate caching for GET requests
4. **Deduplication**: Prevent duplicate requests within the defined window
5. **Queue Management**: Properly handle request queuing and priorities
6. **Error Handling**: Follow the standard error handling pattern for all responses

## 5. Centralized Logging

All logging must use the centralized logging system:

```typescript
// Configure module-specific logging
configureModuleLogging('ModuleName', {
  level: process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.INFO,
  enabled: true,
  persistentContext: { /* context info */ }
});

// Create and use loggers consistently
const logger = createLogger('ComponentName');
logger.info('Message', { contextData });
```

Logging guidelines:
- Use appropriate log levels (TRACE, DEBUG, INFO, WARN, ERROR)
- Include relevant context with each log
- Configure module-specific log levels
- Implement rate limiting for high-frequency logs
- Use consistent naming conventions

## 6. Performance Optimization

Follow these performance optimization principles:

1. **Selective Rendering**: Use specialized contexts to minimize re-renders
2. **State References**: Use `useRef` for tracking state that doesn't need re-renders
3. **Debounce**: Implement appropriate debouncing for rapid state changes
4. **Cleanup**: Properly clean up resources on component unmount
5. **Request Management**: Cancel outdated requests and use AbortController
6. **Caching**: Implement intelligent caching with appropriate TTL

## 7. Error Handling Strategy

Implement a consistent error handling strategy:

1. **Type Safety**: Always use proper type casting for error responses
2. **User Experience**: Convert technical errors to user-friendly messages
3. **Recovery**: Implement automatic recovery mechanisms where possible
4. **Fallbacks**: Provide fallback UI for all error states
5. **Logging**: Log all errors with appropriate context

## 8. Testing Requirements

All loading system components must be tested for:

1. **Stage Transitions**: Verify all stage transition rules are enforced
2. **Error Handling**: Test all error handling paths
3. **Edge Cases**: Cover edge cases like rapid state changes
4. **Performance**: Verify optimizations work as expected
5. **Integration**: Test integration with API and other systems

## 9. Backward Compatibility

When updating the loading system:

1. **Legacy Support**: Maintain backward compatibility with existing code
2. **Migration Path**: Provide clear migration paths for deprecated features
3. **Documentation**: Update documentation to reflect changes
4. **Versioning**: Use appropriate version management for significant changes

## 10. Code Organization

Follow these organization principles:

1. **File Structure**: Keep related code in the same directory
2. **Naming**: Use consistent and descriptive naming
3. **Interfaces**: Define and export interfaces for all public APIs
4. **Documentation**: Document complex logic and implementation details
5. **Example Usage**: Provide example usage in documentation

These principles ensure a consistent, maintainable, and performant loading system implementation across the application. 