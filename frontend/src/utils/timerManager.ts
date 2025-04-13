import React from 'react';
import { createLogger } from './logger';
import { LoadingStage } from '@/contexts/loading/types';

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

// Типы таймеров для отслеживания
type TimerType = 'timeout' | 'interval';

// Интерфейс для хранения информации о таймере
interface TimerInfo {
  id: number;
  type: TimerType;
  name?: string;
  componentName?: string;
  createdAt: number;
  cleanedUp: boolean;
}

// Отслеживаемые таймеры
const timers = new Map<number, TimerInfo>();

// Получение текущей стадии загрузки из глобального объекта
const getCurrentLoadingStage = (): LoadingStage | undefined => {
  if (typeof window !== 'undefined') {
    return window.__loading_stage__;
  }
  return undefined;
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

// Создание таймаута с отслеживанием
export function createSafeTimeout(
  callback: () => void, 
  delay: number,
  options: { name?: string; componentName?: string } = {}
): number {
  const { name, componentName } = options;
  
  // Создаем обертку для callback, которая удалит таймер из отслеживаемых
  const wrappedCallback = () => {
    try {
      callback();
    } catch (error) {
      logger.error('Ошибка в callback таймаута', { error, name, componentName });
    } finally {
      const timer = timers.get(id);
      if (timer) {
        timer.cleanedUp = true;
      }
    }
  };
  
  // Создаем таймаут
  const id = window.setTimeout(wrappedCallback, delay);
  
  // Фиксируем информацию о таймере
  timers.set(id, {
    id,
    type: 'timeout',
    name,
    componentName,
    createdAt: Date.now(),
    cleanedUp: false
  });
  
  // Если имя указано, логируем создание таймера
  if (name) {
    logger.debug(`Создан таймаут "${name}"`, { 
      id, 
      delay, 
      componentName, 
      stage: getCurrentLoadingStage() 
    });
  }
  
  return id;
}

// Создание интервала с отслеживанием
export function createSafeInterval(
  callback: () => void, 
  delay: number,
  options: { name?: string; componentName?: string } = {}
): number {
  const { name, componentName } = options;
  
  // Создаем обертку для callback с обработкой ошибок
  const wrappedCallback = () => {
    try {
      callback();
    } catch (error) {
      logger.error('Ошибка в callback интервала', { error, name, componentName });
      // При ошибке в интервале останавливаем его для предотвращения повторения ошибок
      clearSafeInterval(id);
    }
  };
  
  // Создаем интервал
  const id = window.setInterval(wrappedCallback, delay);
  
  // Фиксируем информацию об интервале
  timers.set(id, {
    id,
    type: 'interval',
    name,
    componentName,
    createdAt: Date.now(),
    cleanedUp: false
  });
  
  // Если имя указано, логируем создание интервала
  if (name) {
    logger.debug(`Создан интервал "${name}"`, { 
      id, 
      delay, 
      componentName, 
      stage: getCurrentLoadingStage() 
    });
  }
  
  return id;
}

// Очистка таймаута с отслеживанием
export function clearSafeTimeout(id: number): void {
  clearSafeTimer(id, 'timeout');
}

// Очистка интервала с отслеживанием
export function clearSafeInterval(id: number): void {
  clearSafeTimer(id, 'interval');
}

// Общая функция очистки таймера
function clearSafeTimer(id: number, expectedType: TimerType): void {
  // Проверяем, что таймер существует
  const timer = timers.get(id);
  
  if (!timer) {
    return;
  }
  
  // Проверяем тип таймера
  if (timer.type !== expectedType) {
    logger.warn(`Попытка очистить ${expectedType} с ID ${id}, но это ${timer.type}`, { timer });
    return;
  }
  
  // Очищаем таймер соответствующей функцией
  if (timer.type === 'timeout') {
    window.clearTimeout(id);
  } else {
    window.clearInterval(id);
  }
  
  // Обновляем статус таймера
  timer.cleanedUp = true;
  
  // Если имя указано, логируем очистку таймера
  if (timer.name) {
    logger.debug(`Очищен ${timer.type} "${timer.name}"`, { 
      id, 
      componentName: timer.componentName, 
      lifetime: Date.now() - timer.createdAt 
    });
  }
}

// Очистка всех таймеров для компонента
export function clearAllTimersForComponent(componentName: string): void {
  let clearedCount = 0;
  
  // Находим и очищаем все таймеры для указанного компонента
  timers.forEach((timer, id) => {
    if (timer.componentName === componentName && !timer.cleanedUp) {
      if (timer.type === 'timeout') {
        window.clearTimeout(id);
      } else {
        window.clearInterval(id);
      }
      
      timer.cleanedUp = true;
      clearedCount++;
    }
  });
  
  if (clearedCount > 0) {
    logger.info(`Очищено ${clearedCount} таймеров для компонента "${componentName}"`);
  }
}

// Получение статистики таймеров
export function getTimerStats(): { total: number; active: number; byComponent: Record<string, number> } {
  const stats = {
    total: timers.size,
    active: 0,
    byComponent: {} as Record<string, number>
  };
  
  timers.forEach(timer => {
    if (!timer.cleanedUp) {
      stats.active++;
      
      // Группируем по компонентам
      const componentName = timer.componentName || 'unknown';
      stats.byComponent[componentName] = (stats.byComponent[componentName] || 0) + 1;
    }
  });
  
  return stats;
}

// Поиск утечек таймеров (таймеры, которые работают слишком долго)
export function detectTimerLeaks(thresholdMs: number = 60000): TimerInfo[] {
  const now = Date.now();
  const leaks: TimerInfo[] = [];
  
  timers.forEach(timer => {
    if (!timer.cleanedUp && now - timer.createdAt > thresholdMs) {
      leaks.push({ ...timer });
    }
  });
  
  if (leaks.length > 0) {
    logger.warn(`Обнаружено ${leaks.length} потенциальных утечек таймеров`, { leaks });
  }
  
  return leaks;
}

// Периодическая очистка завершенных таймеров из мапы для предотвращения утечек памяти
function cleanupTimersMap() {
  const now = Date.now();
  const idsToRemove: number[] = [];
  
  timers.forEach((timer, id) => {
    // Удаляем завершенные таймеры старше 5 минут
    if (timer.cleanedUp && now - timer.createdAt > 300000) {
      idsToRemove.push(id);
    }
  });
  
  idsToRemove.forEach(id => timers.delete(id));
  
  if (idsToRemove.length > 0) {
    logger.debug(`Удалено ${idsToRemove.length} завершенных таймеров из памяти`);
  }
}

// Запускаем периодическую очистку каждые 5 минут
if (typeof window !== 'undefined') {
  setInterval(cleanupTimersMap, 300000);
}

// Хук для использования в функциональных компонентах React
export const useTimersManager = (componentName: string) => {
  // При размонтировании компонента очищаем все его таймеры
  React.useEffect(() => {
    return () => {
      clearAllTimersForComponent(componentName);
    };
  }, [componentName]);
  
  // Возвращаем функции создания таймеров с предустановленным именем компонента
  return {
    setTimeout: (callback: () => void, delay: number, name?: string) => 
      createSafeTimeout(callback, delay, { name, componentName }),
    
    setInterval: (callback: () => void, delay: number, name?: string) => 
      createSafeInterval(callback, delay, { name, componentName }),
    
    clearTimeout: clearSafeTimeout,
    clearInterval: clearSafeInterval
  };
}; 