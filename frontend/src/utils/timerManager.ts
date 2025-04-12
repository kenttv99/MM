import React from 'react';
import { createLogger } from './logger';

const logger = createLogger('TimerManager');

// Map to store all active timers
type TimerStore = Map<string, {
  timerId: NodeJS.Timeout,
  createdAt: number,
  description: string
}>;

// Create separate stores for different timer types
const timeoutStore: TimerStore = new Map();
const intervalStore: TimerStore = new Map();

// Global reference to track if the manager was initialized
let isInitialized = false;

// Configuration
const CONFIG = {
  debugMode: process.env.NODE_ENV !== 'production',
  maxTimersWarningThreshold: 50,
  cleanupInterval: 60000, // 1 minute
};

/**
 * Initialize the timer manager
 */
export function initializeTimerManager() {
  if (isInitialized) return;
  
  logger.info('Initializing timer manager');
  
  // Set up periodic cleanup to catch any missed timers
  if (typeof window !== 'undefined') {
    setInterval(() => {
      const timeoutCount = timeoutStore.size;
      const intervalCount = intervalStore.size;
      
      if (CONFIG.debugMode) {
        logger.debug('Timer stats', { timeouts: timeoutCount, intervals: intervalCount });
      }
      
      // Warn if too many timers are active
      if (timeoutCount + intervalCount > CONFIG.maxTimersWarningThreshold) {
        logger.warn('Too many active timers, possible memory leak', { 
          timeouts: timeoutCount,
          intervals: intervalCount,
          threshold: CONFIG.maxTimersWarningThreshold
        });
      }
    }, CONFIG.cleanupInterval);
  }
  
  isInitialized = true;
}

/**
 * Generate a unique timer ID
 */
function generateTimerId(category: string, name: string): string {
  return `${category}:${name}:${Date.now()}:${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Set a timeout with tracking
 * @param category Category name for timer grouping
 * @param name Specific timer name
 * @param callback Function to execute
 * @param delay Delay in milliseconds
 * @param description Optional description for debugging
 * @returns A timer ID that can be used to clear the timeout
 */
export function setManagedTimeout(
  category: string,
  name: string,
  callback: () => void,
  delay: number,
  description = ''
): string {
  if (!isInitialized) {
    initializeTimerManager();
  }
  
  // Create a wrapper that cleans up after execution
  const wrappedCallback = () => {
    try {
      callback();
    } catch (error) {
      logger.error(`Error in timeout callback (${category}:${name})`, error);
    } finally {
      clearManagedTimeout(timerId);
    }
  };
  
  const timerId = generateTimerId(category, name);
  const timer = setTimeout(wrappedCallback, delay);
  
  timeoutStore.set(timerId, {
    timerId: timer,
    createdAt: Date.now(),
    description
  });
  
  if (CONFIG.debugMode) {
    logger.debug(`Timeout created: ${category}:${name}`, { 
      delay, 
      timerId, 
      totalActive: timeoutStore.size 
    });
  }
  
  return timerId;
}

/**
 * Clear a managed timeout
 * @param timerId The timer ID returned from setManagedTimeout
 * @returns Boolean indicating if the timer was found and cleared
 */
export function clearManagedTimeout(timerId: string): boolean {
  if (!timeoutStore.has(timerId)) return false;
  
  const timerInfo = timeoutStore.get(timerId)!;
  clearTimeout(timerInfo.timerId);
  timeoutStore.delete(timerId);
  
  if (CONFIG.debugMode) {
    logger.debug(`Timeout cleared: ${timerId}`, { 
      totalActive: timeoutStore.size,
      duration: Date.now() - timerInfo.createdAt
    });
  }
  
  return true;
}

/**
 * Set an interval with tracking
 * @param category Category name for timer grouping
 * @param name Specific timer name
 * @param callback Function to execute
 * @param delay Delay in milliseconds
 * @param description Optional description for debugging
 * @returns A timer ID that can be used to clear the interval
 */
export function setManagedInterval(
  category: string,
  name: string,
  callback: () => void,
  delay: number,
  description = ''
): string {
  if (!isInitialized) {
    initializeTimerManager();
  }
  
  // Create a wrapper that catches errors
  const wrappedCallback = () => {
    try {
      callback();
    } catch (error) {
      logger.error(`Error in interval callback (${category}:${name})`, error);
    }
  };
  
  const timerId = generateTimerId(category, name);
  const timer = setInterval(wrappedCallback, delay);
  
  intervalStore.set(timerId, {
    timerId: timer,
    createdAt: Date.now(),
    description
  });
  
  if (CONFIG.debugMode) {
    logger.debug(`Interval created: ${category}:${name}`, { 
      delay, 
      timerId, 
      totalActive: intervalStore.size 
    });
  }
  
  return timerId;
}

/**
 * Clear a managed interval
 * @param timerId The timer ID returned from setManagedInterval
 * @returns Boolean indicating if the timer was found and cleared
 */
export function clearManagedInterval(timerId: string): boolean {
  if (!intervalStore.has(timerId)) return false;
  
  const timerInfo = intervalStore.get(timerId)!;
  clearInterval(timerInfo.timerId);
  intervalStore.delete(timerId);
  
  if (CONFIG.debugMode) {
    logger.debug(`Interval cleared: ${timerId}`, { 
      totalActive: intervalStore.size,
      duration: Date.now() - timerInfo.createdAt
    });
  }
  
  return true;
}

/**
 * Clear all timers in a specific category
 * @param category Category name to clear
 * @returns Number of timers cleared
 */
export function clearTimersByCategory(category: string): number {
  let count = 0;
  
  // Clear timeouts
  for (const timerId of timeoutStore.keys()) {
    if (timerId.startsWith(`${category}:`)) {
      clearManagedTimeout(timerId);
      count++;
    }
  }
  
  // Clear intervals
  for (const timerId of intervalStore.keys()) {
    if (timerId.startsWith(`${category}:`)) {
      clearManagedInterval(timerId);
      count++;
    }
  }
  
  if (count > 0 && CONFIG.debugMode) {
    logger.info(`Cleared ${count} timers for category: ${category}`);
  }
  
  return count;
}

/**
 * Custom React hook for component-bound timers that auto-cleanup
 * @returns Timer utility functions bound to the component lifecycle
 */
export function useTimers() {
  const componentId = React.useId();
  const timersRef = React.useRef<string[]>([]);
  
  React.useEffect(() => {
    return () => {
      // Cleanup all timers when component unmounts
      timersRef.current.forEach(timerId => {
        clearManagedTimeout(timerId);
        clearManagedInterval(timerId);
      });
      
      if (CONFIG.debugMode && timersRef.current.length > 0) {
        logger.debug(`Cleaned up ${timersRef.current.length} timers on component unmount`);
      }
      
      timersRef.current = [];
    };
  }, []);
  
  const setTimeout = React.useCallback((name: string, callback: () => void, delay: number) => {
    const timerId = setManagedTimeout(componentId, name, callback, delay);
    timersRef.current.push(timerId);
    return timerId;
  }, [componentId]);
  
  const clearTimeout = React.useCallback((timerId: string) => {
    const result = clearManagedTimeout(timerId);
    if (result) {
      timersRef.current = timersRef.current.filter(id => id !== timerId);
    }
    return result;
  }, []);
  
  const setInterval = React.useCallback((name: string, callback: () => void, delay: number) => {
    const timerId = setManagedInterval(componentId, name, callback, delay);
    timersRef.current.push(timerId);
    return timerId;
  }, [componentId]);
  
  const clearInterval = React.useCallback((timerId: string) => {
    const result = clearManagedInterval(timerId);
    if (result) {
      timersRef.current = timersRef.current.filter(id => id !== timerId);
    }
    return result;
  }, []);
  
  const clearAllTimers = React.useCallback(() => {
    let count = 0;
    
    timersRef.current.forEach(timerId => {
      const clearedTimeout = clearManagedTimeout(timerId);
      const clearedInterval = clearManagedInterval(timerId);
      if (clearedTimeout || clearedInterval) count++;
    });
    
    timersRef.current = [];
    return count;
  }, []);
  
  return {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    clearAllTimers,
  };
}

// Export a default instance for usage without hook
const defaultTimerManager = {
  setTimeout: setManagedTimeout.bind(null, 'global'),
  clearTimeout: clearManagedTimeout,
  setInterval: setManagedInterval.bind(null, 'global'),
  clearInterval: clearManagedInterval,
  clearTimersByCategory,
};

export default defaultTimerManager; 