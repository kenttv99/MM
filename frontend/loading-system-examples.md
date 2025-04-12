# Loading System Implementation Examples

This document provides practical code examples for implementing the loading system properly in different scenarios.

## 1. Context Usage Examples

### Using the Specialized Contexts

```tsx
import React from 'react';
import { useLoadingStage } from '@/contexts/loading/LoadingStageContext';
import { useLoadingFlags } from '@/contexts/loading/LoadingFlagsContext';
import { useLoadingError } from '@/contexts/loading/LoadingErrorContext';
import { useLoadingProgress } from '@/contexts/loading/LoadingProgressContext';

const MyComponent: React.FC = () => {
  // Access specific context functionality
  const { currentStage, setStage } = useLoadingStage();
  const { isStaticLoading, setDynamicLoading } = useLoadingFlags();
  const { error, setError } = useLoadingError();
  const { progress, setProgress } = useLoadingProgress();
  
  // Use context values and functions
  const handleLoadData = async () => {
    setDynamicLoading(true);
    setProgress(0);
    
    try {
      // Load data with progress updates
      setProgress(50);
      // ...more loading
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setDynamicLoading(false);
    }
  };
  
  return (
    <div>
      {isStaticLoading && <LoadingIndicator />}
      {error && <ErrorDisplay message={error} />}
      <div>Current progress: {progress}%</div>
      <button onClick={handleLoadData}>Load Data</button>
    </div>
  );
};
```

### Using the Unified Context (Backward Compatibility)

```tsx
import React from 'react';
import { useLoading, LoadingStage } from '@/contexts/LoadingContextLegacy';

const MyLegacyComponent: React.FC = () => {
  const { 
    currentStage, 
    setStage, 
    isStaticLoading, 
    isDynamicLoading,
    setStaticLoading,
    setDynamicLoading,
    error,
    setError,
    progress,
    setProgress
  } = useLoading();
  
  // Use the unified context API
  const handleLoadData = async () => {
    setDynamicLoading(true);
    
    try {
      // Load data
      if (currentStage === LoadingStage.AUTHENTICATION) {
        setStage(LoadingStage.STATIC_CONTENT);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setDynamicLoading(false);
    }
  };
  
  return (
    <div>
      {/* Component implementation */}
    </div>
  );
};
```

## 2. Type-Safe API Request Examples

### Basic API Request Pattern

```tsx
import { apiFetch } from '@/utils/api';
import { ApiAbortedResponse, ApiErrorResponse } from '@/types/api';
import { createLogger } from '@/utils/logger';

const logger = createLogger('MyComponent');

const fetchData = async () => {
  try {
    const response = await apiFetch<MyDataType>('/api/data', {
      method: 'GET',
      bypassLoadingStageCheck: false
    });
    
    if ('aborted' in response) {
      const abortedResponse = response as unknown as ApiAbortedResponse;
      logger.warn('Request was aborted', { reason: abortedResponse.reason });
      return null;
    }
    
    if ('error' in response) {
      const errorResponse = response as unknown as ApiErrorResponse;
      logger.error('Error fetching data', { 
        error: errorResponse.error,
        status: errorResponse.status
      });
      return null;
    }
    
    // Process successful response
    logger.info('Data fetched successfully', { dataSize: Object.keys(response).length });
    return response;
  } catch (err) {
    logger.error('Unexpected error fetching data', { 
      error: err instanceof Error ? err.message : String(err)
    });
    return null;
  }
};
```

### Component Integration Example

```tsx
import React, { useState, useEffect } from 'react';
import { useLoadingFlags } from '@/contexts/loading/LoadingFlagsContext';
import { useLoadingError } from '@/contexts/loading/LoadingErrorContext';
import { apiFetch } from '@/utils/api';
import { ApiAbortedResponse, ApiErrorResponse } from '@/types/api';

const DataComponent: React.FC = () => {
  const { setDynamicLoading } = useLoadingFlags();
  const { setError } = useLoadingError();
  const [data, setData] = useState<DataType | null>(null);
  
  useEffect(() => {
    const fetchData = async () => {
      setDynamicLoading(true);
      
      try {
        const response = await apiFetch<DataType>('/api/data', {
          bypassLoadingStageCheck: false
        });
        
        if ('aborted' in response) {
          const abortedResponse = response as unknown as ApiAbortedResponse;
          setError(`Request aborted: ${abortedResponse.reason || 'Unknown reason'}`);
          return;
        }
        
        if ('error' in response) {
          const errorResponse = response as unknown as ApiErrorResponse;
          setError(typeof errorResponse.error === 'string' ? 
            errorResponse.error : 'Error fetching data');
          return;
        }
        
        setData(response);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unexpected error');
      } finally {
        setDynamicLoading(false);
      }
    };
    
    fetchData();
  }, [setDynamicLoading, setError]);
  
  return (
    <div>
      {data ? (
        <DataDisplay data={data} />
      ) : (
        <LoadingPlaceholder />
      )}
    </div>
  );
};
```

## 3. Stage Transition Examples

### Proper Stage Transition Logic

```tsx
import { useLoadingStage } from '@/contexts/loading/LoadingStageContext';
import { LoadingStage } from '@/contexts/loading/types';
import { createLogger } from '@/utils/logger';

const logger = createLogger('MyComponent');

// Example function that needs to manage loading stages
const initializeApplication = async () => {
  const { currentStage, setStage, stageHistory } = useLoadingStage();
  
  // Start with authentication
  if (currentStage === LoadingStage.INITIAL) {
    setStage(LoadingStage.AUTHENTICATION);
  }
  
  try {
    // Load authentication data
    await loadAuthenticationData();
    
    // Progress to static content loading
    // canChangeStage is called internally by setStage
    setStage(LoadingStage.STATIC_CONTENT);
    
    // Load static content
    await loadStaticContent();
    
    // Progress to dynamic content
    setStage(LoadingStage.DYNAMIC_CONTENT);
    
    // Load dynamic content
    await loadDynamicContent();
    
    // Complete loading
    setStage(LoadingStage.COMPLETED);
  } catch (err) {
    logger.error('Error during application initialization', {
      error: err instanceof Error ? err.message : String(err),
      currentStage
    });
    
    // Handle error - only go to ERROR stage if appropriate
    if (currentStage !== LoadingStage.COMPLETED) {
      setStage(LoadingStage.ERROR);
    }
  }
};
```

### Error Handling with Stage Management

```tsx
import { LoadingStage } from '@/contexts/loading/types';
import { useLoadingStage } from '@/contexts/loading/LoadingStageContext';
import { useLoadingError } from '@/contexts/loading/LoadingErrorContext';

const errorHandler = (error: unknown) => {
  const { currentStage, setStage } = useLoadingStage();
  const { setError } = useLoadingError();
  
  // Format error message
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Set error message
  setError(errorMessage);
  
  // Only go to ERROR stage if not already in COMPLETED
  if (currentStage !== LoadingStage.COMPLETED) {
    setStage(LoadingStage.ERROR);
  }
  
  // Log error
  console.error('Application error:', {
    message: errorMessage,
    previousStage: currentStage
  });
};
```

## 4. Logging Examples

### Configuring Module Logging

```tsx
import { LogLevel, configureModuleLogging, createLogger } from '@/utils/logger';

// Configure module-specific logging
configureModuleLogging('UserService', {
  level: process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.INFO,
  enabled: true,
  persistentContext: {
    module: 'user-service',
    version: '1.2.0'
  }
});

// Create a logger for a specific component
const userProfileLogger = createLogger('UserProfile');

// Create child loggers for specific functions
const updateProfileLogger = userProfileLogger.child('UpdateProfile');
const authenticateLogger = userProfileLogger.child('Authenticate');

// Usage examples
userProfileLogger.info('User profile loaded', { userId: 123 });
updateProfileLogger.warn('Profile update validation warning', { fields: ['email'] });
authenticateLogger.error('Authentication failed', { reason: 'Invalid token' });
```

### Context-Based Logging

```tsx
import { createLogger } from '@/utils/logger';

// Component-specific logger
const logger = createLogger('MyComponent');

// Function with contextual logging
const processUserData = (userData: UserData) => {
  // Create a context for this execution
  const context = {
    userId: userData.id,
    dataSize: Object.keys(userData).length
  };
  
  logger.debug('Starting user data processing', context);
  
  try {
    // Process data
    const result = doProcessing(userData);
    
    logger.info('User data processed successfully', {
      ...context,
      processingTime: performance.now() - startTime
    });
    
    return result;
  } catch (err) {
    logger.error('Error processing user data', {
      ...context,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
};
```

## 5. Performance Optimized Component

```tsx
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useLoadingFlags } from '@/contexts/loading/LoadingFlagsContext';
import { apiFetch } from '@/utils/api';
import { ApiAbortedResponse, ApiErrorResponse } from '@/types/api';
import { createLogger } from '@/utils/logger';

const logger = createLogger('OptimizedComponent');

const OptimizedComponent: React.FC = () => {
  // Use specialized context
  const { setDynamicLoading } = useLoadingFlags();
  
  // State
  const [data, setData] = useState<DataType | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for tracking
  const isMounted = useRef(true);
  const abortController = useRef<AbortController | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Cleanup function
  const cleanup = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    
    if (abortController.current) {
      abortController.current.abort();
      abortController.current = null;
    }
  }, []);
  
  // Debounced fetch function
  const debouncedFetch = useCallback((query: string) => {
    // Clear existing timeout
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Set new timeout
    debounceTimer.current = setTimeout(() => {
      fetchData(query);
    }, 300);
  }, []);
  
  // Fetch data function
  const fetchData = useCallback(async (query: string) => {
    // Cleanup previous request
    cleanup();
    
    // Exit if component unmounted
    if (!isMounted.current) return;
    
    // Create abort controller
    abortController.current = new AbortController();
    
    // Update loading state
    setDynamicLoading(true);
    
    try {
      const response = await apiFetch<DataType>(`/api/data?q=${query}`, {
        signal: abortController.current.signal,
        bypassLoadingStageCheck: false
      });
      
      // Exit if component unmounted
      if (!isMounted.current) return;
      
      if ('aborted' in response) {
        const abortedResponse = response as unknown as ApiAbortedResponse;
        if (abortedResponse.reason !== 'component_unmounted') {
          setError(`Request aborted: ${abortedResponse.reason || 'Unknown reason'}`);
        }
        return;
      }
      
      if ('error' in response) {
        const errorResponse = response as unknown as ApiErrorResponse;
        setError(typeof errorResponse.error === 'string' ? 
          errorResponse.error : 'Error fetching data');
        return;
      }
      
      // Update state with data
      setData(response);
      setError(null);
    } catch (err) {
      // Only update error if component still mounted
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Unexpected error');
      }
    } finally {
      // Update loading state if still mounted
      if (isMounted.current) {
        setDynamicLoading(false);
      }
    }
  }, [setDynamicLoading, cleanup]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      cleanup();
      
      // Cancel any pending requests
      if (abortController.current) {
        abortController.current.abort('component_unmounted');
      }
    };
  }, [cleanup]);
  
  return (
    <div>
      <input 
        type="text" 
        onChange={(e) => debouncedFetch(e.target.value)} 
        placeholder="Search..."
      />
      
      {error && <div className="error">{error}</div>}
      
      {data && (
        <div className="results">
          {/* Render data */}
        </div>
      )}
    </div>
  );
};
```

These examples demonstrate the best practices for implementing the loading system in different scenarios. Use them as a reference when implementing new features or refactoring existing code. 