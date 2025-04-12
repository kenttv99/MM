# Loading Context System

This directory contains a modular loading context system that replaces the monolithic `LoadingContext.tsx` with smaller, more focused contexts that are easier to maintain and understand.

## Architecture

The system is composed of several specialized contexts:

- **LoadingStageContext**: Manages the application's loading stage (AUTHENTICATION, STATIC_CONTENT, etc.)
- **LoadingFlagsContext**: Handles loading flags (isStaticLoading, isDynamicLoading)
- **LoadingProgressContext**: Tracks loading progress and provides progress indicators
- **LoadingErrorContext**: Manages loading-related errors
- **LoadingContext**: Combines all contexts into a unified API for backward compatibility

## File Structure

- `types.ts` - Contains all the type definitions for the loading system
- `LoadingStageContext.tsx` - Stage management and transitions
- `LoadingFlagsContext.tsx` - Loading flags management
- `LoadingProgressContext.tsx` - Progress tracking
- `LoadingErrorContext.tsx` - Error handling
- `LoadingContext.tsx` - Combined context provider
- `index.ts` - Exports all the necessary components and functions

## Usage

### Basic Usage (Combined Context)

```tsx
import { useLoading, LoadingStage } from '@/contexts/loading';

function MyComponent() {
  const { 
    currentStage, 
    setStage,
    isStaticLoading,
    setDynamicLoading
  } = useLoading();
  
  // Use loading state
  if (currentStage === LoadingStage.AUTHENTICATION) {
    return <div>Authenticating...</div>;
  }
  
  return <div>Content loaded!</div>;
}
```

### Using Specialized Contexts

```tsx
import { 
  useLoadingStage, 
  useLoadingFlags, 
  useLoadingProgress 
} from '@/contexts/loading';

function MyComponent() {
  const { currentStage, setStage } = useLoadingStage();
  const { setDynamicLoading } = useLoadingFlags();
  const { progress, setProgress } = useLoadingProgress();
  
  // Use specialized contexts
}
```

## Key Features

1. **Stage Management**
   - Strict prevention of regression to AUTHENTICATION stage
   - Automatic stage progression with timeouts
   - Stage history tracking to prevent cycles

2. **Loading Flags**
   - Independent static and dynamic loading flags
   - Specialized handling for admin routes
   - Automatic stage transitions based on flag state

3. **Inconsistency Detection**
   - Automatic detection and fixing of inconsistent states
   - Periodic checks to ensure UI and state are in sync
   - DOM checking for spinner presence

4. **Error Handling**
   - Specialized error context
   - Automatic stage transitions on errors
   - Clear error recovery paths

## Integration with API

The loading system is tightly integrated with the API module, which observes loading stages and manages request processing based on the current stage.

## Migrating from Legacy Code

For legacy code that depends on the monolithic `LoadingContext`, a compatibility layer is provided that maintains the same API surface. 