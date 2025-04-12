export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5 // Adding TRACE as the most verbose level
}

// Interface for context information that can be attached to logs
export interface LogContext {
  [key: string]: unknown;
}

// Module configuration for targeted logging
interface ModuleConfig {
  level: LogLevel;
  enabled: boolean;
  persistentContext?: LogContext; // Context that will be included in all logs from this module
}

// Performance metric tracking
interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  context?: LogContext;
}

// Default log level based on environment
let globalLogLevel = process.env.NODE_ENV === 'production' 
  ? LogLevel.WARN 
  : LogLevel.INFO;

// Module-specific overrides
const moduleConfigs: Record<string, ModuleConfig> = {};

// Log history for high-frequency events
interface LogEntry {
  level: LogLevel;
  prefix: string;
  message: string;
  data?: unknown;
  context?: LogContext;
  timestamp: number;
}

// Keep limited log history for diagnostics
const logHistory: LogEntry[] = [];
const MAX_LOG_HISTORY = 100;

// For batching high-frequency logs
const logBatch: Record<string, { count: number, lastMessage: string, lastTimestamp: number }> = {};
const BATCH_INTERVAL = 500; // ms
let batchingEnabled = false;

// Performance metrics tracking
const performanceMetrics: Record<string, PerformanceMetric[]> = {};
const MAX_METRICS_PER_NAME = 100;

// Rate limiting for high-frequency logs
interface RateLimitConfig {
  interval: number; // ms
  maxCount: number;
}
const defaultRateLimit: RateLimitConfig = { interval: 1000, maxCount: 5 };
const moduleRateLimits: Record<string, RateLimitConfig> = {};
const rateLimitCounters: Record<string, { count: number, resetTime: number }> = {};

// Module-specific log settings
export const configureModuleLogging = (
  moduleName: string, 
  config: Partial<ModuleConfig>
) => {
  moduleConfigs[moduleName] = {
    level: config.level ?? globalLogLevel,
    enabled: config.enabled ?? true,
    persistentContext: config.persistentContext ?? {}
  };
};

// Set persistent context for a module
export const setModuleContext = (
  moduleName: string,
  context: LogContext
) => {
  if (!moduleConfigs[moduleName]) {
    moduleConfigs[moduleName] = {
      level: globalLogLevel,
      enabled: true,
      persistentContext: context
    };
  } else {
    moduleConfigs[moduleName].persistentContext = {
      ...moduleConfigs[moduleName].persistentContext,
      ...context
    };
  }
};

// Set rate limit for a specific module
export const setModuleRateLimit = (
  moduleName: string, 
  config: Partial<RateLimitConfig>
) => {
  moduleRateLimits[moduleName] = {
    interval: config.interval ?? defaultRateLimit.interval,
    maxCount: config.maxCount ?? defaultRateLimit.maxCount
  };
};

// Global log level setter
export const setLogLevel = (level: LogLevel) => {
  globalLogLevel = level;
};

// Toggle batching for high-frequency logs
export const enableBatchLogging = (enabled: boolean) => {
  batchingEnabled = enabled;
};

// Check if log should be allowed based on rate limits
const shouldAllowLog = (key: string): boolean => {
  const now = Date.now();
  const counter = rateLimitCounters[key] || { count: 0, resetTime: now + defaultRateLimit.interval };
  const limit = moduleRateLimits[key.split(':')[0]] || defaultRateLimit;
  
  // Reset counter if interval passed
  if (now > counter.resetTime) {
    counter.count = 0;
    counter.resetTime = now + limit.interval;
  }
  
  // Increment counter
  counter.count++;
  rateLimitCounters[key] = counter;
  
  // Check if under limit
  return counter.count <= limit.maxCount;
};

// Handle batched logging
const processBatchedLog = (level: LogLevel, prefix: string, message: string, data?: unknown, context?: LogContext) => {
  const key = `${prefix}:${message}`;
  const now = Date.now();
  
  if (!logBatch[key]) {
    logBatch[key] = { count: 1, lastMessage: message, lastTimestamp: now };
    // Print first occurrence immediately
    actualLog(level, prefix, message, data, context);
    return;
  }
  
  logBatch[key].count++;
  
  // If batch interval exceeded, log accumulated count
  if (now - logBatch[key].lastTimestamp > BATCH_INTERVAL) {
    if (logBatch[key].count > 1) {
      actualLog(level, prefix, `${message} (repeated ${logBatch[key].count} times)`, data, context);
    }
    logBatch[key] = { count: 0, lastMessage: message, lastTimestamp: now };
  }
};

// Format log message with context information
const formatLogMessage = (message: string, data?: unknown, context?: LogContext): string => {
  let formattedMessage = message;
  
  // Add structured data if present
  if (context && Object.keys(context).length > 0) {
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
      .join(' ');
    formattedMessage = `${message} [${contextStr}]`;
  }
  
  return formattedMessage;
};

// Actual logging function
const actualLog = (level: LogLevel, prefix: string, message: string, data?: unknown, context?: LogContext) => {
  // Add to history
  if (logHistory.length >= MAX_LOG_HISTORY) {
    logHistory.shift();
  }
  logHistory.push({ level, prefix, message, data, context, timestamp: Date.now() });
  
  const formattedMessage = formatLogMessage(message, data, context);
  
  // Console output with appropriate level
  switch (level) {
    case LogLevel.TRACE:
      console.log(`TRACE ${prefix}:`, formattedMessage, data !== undefined ? data : '');
      break;
    case LogLevel.DEBUG:
      console.log(`${prefix}:`, formattedMessage, data !== undefined ? data : '');
      break;
    case LogLevel.INFO:
      console.info(`${prefix}:`, formattedMessage, data !== undefined ? data : '');
      break;
    case LogLevel.WARN:
      console.warn(`⚠️ ${prefix}:`, formattedMessage, data !== undefined ? data : '');
      break;
    case LogLevel.ERROR:
      console.error(`⛔ ${prefix}:`, formattedMessage, data !== undefined ? data : '');
      break;
  }
};

// Core logging functions
const internalLog = (level: LogLevel, prefix: string, message: string, data?: unknown, context?: LogContext) => {
  // Check module-specific config
  const moduleConfig = moduleConfigs[prefix];
  const effectiveLevel = moduleConfig?.level ?? globalLogLevel;
  const isModuleEnabled = moduleConfig?.enabled ?? true;
  
  // Skip if module disabled or level too high
  if (!isModuleEnabled || level > effectiveLevel) {
    return;
  }
  
  // Merge module's persistent context with the provided context
  const mergedContext = {
    ...moduleConfig?.persistentContext,
    ...context
  };
  
  // Rate limiting check
  const rateLimitKey = `${prefix}:${level}:${message}`;
  if (!shouldAllowLog(rateLimitKey)) {
    return;
  }
  
  // Handle batching for high frequency logs if enabled
  if (batchingEnabled && (level === LogLevel.DEBUG || level === LogLevel.TRACE)) {
    processBatchedLog(level, prefix, message, data, mergedContext);
    return;
  }
  
  // Regular logging
  actualLog(level, prefix, message, data, mergedContext);
};

// Public logging functions
export const logTrace = (prefix: string, message: string, data?: unknown, context?: LogContext) => {
  internalLog(LogLevel.TRACE, prefix, message, data, context);
};

export const logDebug = (prefix: string, message: string, data?: unknown, context?: LogContext) => {
  internalLog(LogLevel.DEBUG, prefix, message, data, context);
};

export const logInfo = (prefix: string, message: string, data?: unknown, context?: LogContext) => {
  internalLog(LogLevel.INFO, prefix, message, data, context);
};

export const logWarn = (prefix: string, message: string, data?: unknown, context?: LogContext) => {
  internalLog(LogLevel.WARN, prefix, message, data, context);
};

export const logError = (prefix: string, message: string, data?: unknown, context?: LogContext) => {
  internalLog(LogLevel.ERROR, prefix, message, data, context);
};

// Conditional logging based on value change
export const logOnChange = <T>(
  level: LogLevel, 
  prefix: string, 
  message: string, 
  newValue: T, 
  oldValue: T, 
  context?: LogContext,
  deep = false
) => {
  // Skip if values are the same
  const hasChanged = deep 
    ? JSON.stringify(newValue) !== JSON.stringify(oldValue)
    : newValue !== oldValue;
    
  if (!hasChanged) return;
  
  const changeData = { prev: oldValue, current: newValue };
  internalLog(level, prefix, message, changeData, context);
};

// Function to log only when value changes
export const logInfoOnChange = (prefix: string, message: string, newValue: unknown, oldValue: unknown, context?: LogContext, forceLog: boolean = false) => {
  // Skip logging if values are the same and not forcing
  if (!forceLog && JSON.stringify(newValue) === JSON.stringify(oldValue)) {
    return;
  }
  
  // Include the old and new values in context
  const changeContext = {
    ...context,
    oldValue,
    newValue,
    changed: true
  };
  
  internalLog(LogLevel.INFO, prefix, message, undefined, changeContext);
};

// Performance monitoring functions
export const startMetric = (prefix: string, metricName: string, context?: LogContext): string => {
  const now = Date.now();
  const metricId = `${prefix}:${metricName}:${now}:${Math.random().toString(36).substring(2, 9)}`;
  
  // Initialize module in performance metrics if not exists
  if (!performanceMetrics[prefix]) {
    performanceMetrics[prefix] = [];
  }
  
  // Create the metric
  const metric: PerformanceMetric = {
    name: metricName,
    startTime: now,
    context
  };
  
  // Add to the metrics array, maintain max size
  if (performanceMetrics[prefix].length >= MAX_METRICS_PER_NAME) {
    performanceMetrics[prefix].shift();
  }
  performanceMetrics[prefix].push(metric);
  
  // Log metric start
  logDebug(prefix, `Started metric ${metricName}`, undefined, {
    metricId,
    ...context
  });
  
  return metricId;
};

export const endMetric = (metricId: string, additionalContext?: LogContext): number | undefined => {
  const [prefix, metricName, startTimeStr] = metricId.split(':');
  const now = Date.now();
  
  if (!prefix || !metricName || !startTimeStr) {
    logWarn('METRICS', `Invalid metric ID: ${metricId}`);
    return undefined;
  }
  
  // Find the metric in the collection
  const metricModule = performanceMetrics[prefix];
  if (!metricModule) {
    logWarn('METRICS', `No metrics found for module: ${prefix}`);
    return undefined;
  }
  
  const startTime = parseInt(startTimeStr, 10);
  const duration = now - startTime;
  
  // Find the metric by name and start time
  const metricIndex = metricModule.findIndex(m => 
    m.name === metricName && m.startTime === startTime && !m.endTime
  );
  
  if (metricIndex === -1) {
    logWarn('METRICS', `Metric not found: ${metricId}`);
    return undefined;
  }
  
  // Update the metric
  metricModule[metricIndex].endTime = now;
  metricModule[metricIndex].duration = duration;
  
  if (additionalContext) {
    metricModule[metricIndex].context = {
      ...metricModule[metricIndex].context,
      ...additionalContext
    };
  }
  
  // Log metric end
  logDebug(prefix, `Ended metric ${metricName}`, undefined, {
    metricId,
    duration: `${duration}ms`,
    ...metricModule[metricIndex].context
  });
  
  return duration;
};

// Get log history for diagnostics
export const getLogHistory = (limit: number = MAX_LOG_HISTORY): LogEntry[] => {
  return [...logHistory].slice(-limit);
};

// Get performance metrics summary
export const getPerformanceMetricsSummary = (prefix?: string, metricName?: string): unknown => {
  const relevantMetrics = prefix 
    ? (performanceMetrics[prefix] || [])
    : Object.values(performanceMetrics).flat();
  
  // Filter by metric name if provided
  const filteredMetrics = metricName
    ? relevantMetrics.filter(m => m.name === metricName)
    : relevantMetrics;
    
  // Only include completed metrics (with duration)
  const completedMetrics = filteredMetrics.filter(m => m.duration !== undefined);
  
  if (completedMetrics.length === 0) {
    return { count: 0 };
  }
  
  // Calculate statistics
  const durations = completedMetrics.map(m => m.duration!);
  const total = durations.reduce((sum, dur) => sum + dur, 0);
  const average = total / durations.length;
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  
  // Group metrics by name
  const metricsByName: Record<string, { count: number, total: number, avg: number, min: number, max: number }> = {};
  
  completedMetrics.forEach(m => {
    if (!metricsByName[m.name]) {
      metricsByName[m.name] = { count: 0, total: 0, avg: 0, min: Infinity, max: 0 };
    }
    
    const stats = metricsByName[m.name];
    stats.count++;
    stats.total += m.duration!;
    stats.min = Math.min(stats.min, m.duration!);
    stats.max = Math.max(stats.max, m.duration!);
    stats.avg = stats.total / stats.count;
  });
  
  return {
    count: completedMetrics.length,
    total,
    average,
    min,
    max,
    byName: metricsByName,
    // Include the 10 most recent metrics
    recent: completedMetrics.slice(-10).map(m => ({
      name: m.name,
      duration: m.duration,
      context: m.context
    }))
  };
};

// Enhanced logger factory with additional methods
export interface Logger {
  trace: (message: string, data?: unknown, context?: LogContext) => void;
  debug: (message: string, data?: unknown, context?: LogContext) => void;
  info: (message: string, data?: unknown, context?: LogContext) => void;
  warn: (message: string, data?: unknown, context?: LogContext) => void;
  error: (message: string, data?: unknown, context?: LogContext) => void;
  withContext: (context: LogContext) => Logger;
  traceOnChange: <T>(message: string, newValue: T, oldValue: T, context?: LogContext, deep?: boolean) => void;
  debugOnChange: <T>(message: string, newValue: T, oldValue: T, context?: LogContext, deep?: boolean) => void;
  infoOnChange: <T>(message: string, newValue: T, oldValue: T, context?: LogContext, deep?: boolean) => void;
  warnOnChange: <T>(message: string, newValue: T, oldValue: T, context?: LogContext, deep?: boolean) => void;
  errorOnChange: <T>(message: string, newValue: T, oldValue: T, context?: LogContext, deep?: boolean) => void;
  startMetric: (metricName: string, context?: LogContext) => string;
  endMetric: (id: string, additionalContext?: LogContext) => number | undefined;
  child: (subPrefix: string) => Logger;
}

// Enhanced logger factory
export const createLogger = (prefix: string): Logger => {
  // Initialize module config if not exists
  if (!moduleConfigs[prefix]) {
    moduleConfigs[prefix] = {
      level: globalLogLevel,
      enabled: true
    };
  }

  const logger: Logger = {
    trace: (message: string, data?: unknown, context?: LogContext) => 
      logTrace(prefix, message, data, context),
    debug: (message: string, data?: unknown, context?: LogContext) => 
      logDebug(prefix, message, data, context),
    info: (message: string, data?: unknown, context?: LogContext) => 
      logInfo(prefix, message, data, context),
    warn: (message: string, data?: unknown, context?: LogContext) => 
      logWarn(prefix, message, data, context),
    error: (message: string, data?: unknown, context?: LogContext) => 
      logError(prefix, message, data, context),
      
    // Create a new logger with pre-defined context
    withContext: (context: LogContext): Logger => {
      const contextLogger: Logger = {
        ...logger,
        trace: (message: string, data?: unknown, additionalContext?: LogContext) => 
          logTrace(prefix, message, data, { ...context, ...additionalContext }),
        debug: (message: string, data?: unknown, additionalContext?: LogContext) => 
          logDebug(prefix, message, data, { ...context, ...additionalContext }),
        info: (message: string, data?: unknown, additionalContext?: LogContext) => 
          logInfo(prefix, message, data, { ...context, ...additionalContext }),
        warn: (message: string, data?: unknown, additionalContext?: LogContext) => 
          logWarn(prefix, message, data, { ...context, ...additionalContext }),
        error: (message: string, data?: unknown, additionalContext?: LogContext) => 
          logError(prefix, message, data, { ...context, ...additionalContext }),
        withContext: (nestedContext: LogContext): Logger => 
          logger.withContext({ ...context, ...nestedContext })
      };
      // Add other methods by calling back to the original logger
      return {
        ...contextLogger,
        traceOnChange: <T>(message: string, newValue: T, oldValue: T, additionalContext?: LogContext, deep = false) => 
          logOnChange(LogLevel.TRACE, prefix, message, newValue, oldValue, { ...context, ...additionalContext }, deep),
        debugOnChange: <T>(message: string, newValue: T, oldValue: T, additionalContext?: LogContext, deep = false) => 
          logOnChange(LogLevel.DEBUG, prefix, message, newValue, oldValue, { ...context, ...additionalContext }, deep),
        infoOnChange: <T>(message: string, newValue: T, oldValue: T, additionalContext?: LogContext, deep = false) => 
          logOnChange(LogLevel.INFO, prefix, message, newValue, oldValue, { ...context, ...additionalContext }, deep),
        warnOnChange: <T>(message: string, newValue: T, oldValue: T, additionalContext?: LogContext, deep = false) => 
          logOnChange(LogLevel.WARN, prefix, message, newValue, oldValue, { ...context, ...additionalContext }, deep),
        errorOnChange: <T>(message: string, newValue: T, oldValue: T, additionalContext?: LogContext, deep = false) => 
          logOnChange(LogLevel.ERROR, prefix, message, newValue, oldValue, { ...context, ...additionalContext }, deep),
        startMetric: (metricName: string, additionalContext?: LogContext) => 
          startMetric(prefix, metricName, { ...context, ...additionalContext }),
        endMetric: (id: string, additionalContext?: LogContext) => 
          endMetric(id, { ...context, ...additionalContext }),
        child: (subPrefix: string) => 
          createLogger(`${prefix}:${subPrefix}`).withContext(context)
      };
    },
    
    // Add conditional logging
    traceOnChange: <T>(message: string, newValue: T, oldValue: T, context?: LogContext, deep = false) => 
      logOnChange(LogLevel.TRACE, prefix, message, newValue, oldValue, context, deep),
    debugOnChange: <T>(message: string, newValue: T, oldValue: T, context?: LogContext, deep = false) => 
      logOnChange(LogLevel.DEBUG, prefix, message, newValue, oldValue, context, deep),
    infoOnChange: <T>(message: string, newValue: T, oldValue: T, context?: LogContext, deep = false) => 
      logOnChange(LogLevel.INFO, prefix, message, newValue, oldValue, context, deep),
    warnOnChange: <T>(message: string, newValue: T, oldValue: T, context?: LogContext, deep = false) => 
      logOnChange(LogLevel.WARN, prefix, message, newValue, oldValue, context, deep),
    errorOnChange: <T>(message: string, newValue: T, oldValue: T, context?: LogContext, deep = false) => 
      logOnChange(LogLevel.ERROR, prefix, message, newValue, oldValue, context, deep),
      
    // Performance metrics
    startMetric: (metricName: string, context?: LogContext) => 
      startMetric(prefix, metricName, context),
    endMetric: (id: string, additionalContext?: LogContext) => 
      endMetric(id, additionalContext),
      
    // Add the ability to create a child logger with sub-prefix
    child: (subPrefix: string) => createLogger(`${prefix}:${subPrefix}`)
  };
  
  return logger;
}; 