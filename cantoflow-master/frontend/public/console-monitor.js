// Browser Console Monitor Client
// This script intercepts console logs and sends them to the MCP server via WebSocket

(function() {
  'use strict';

  const WEBSOCKET_URL = 'ws://localhost:8765';
  let socket = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;

  // Store original console methods
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug
  };

  function initWebSocket() {
    try {
      socket = new WebSocket(WEBSOCKET_URL);

      socket.onopen = function() {
        console.log('🔗 Connected to Console Monitor');
        reconnectAttempts = 0;
      };

      socket.onclose = function() {
        socket = null;
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log(`🔄 Reconnecting to Console Monitor (attempt ${reconnectAttempts})...`);
          setTimeout(initWebSocket, 2000 * reconnectAttempts);
        }
      };

      socket.onerror = function(error) {
        console.error('Console Monitor WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to initialize Console Monitor WebSocket:', error);
    }
  }

  function sendToMonitor(level, args, error = null) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      // Convert arguments to strings
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');

      const logEntry = {
        timestamp: new Date().toISOString(),
        level: level,
        message: message,
        url: window.location.href,
        line: error?.lineno || null,
        column: error?.colno || null,
        stack: error?.error?.stack || null
      };

      socket.send(JSON.stringify({
        type: 'console',
        data: logEntry
      }));

    } catch (error) {
      // Don't log this error to avoid infinite loops
      originalConsole.error('Console Monitor send error:', error);
    }
  }

  // Intercept console methods - Enhanced to capture ALL console methods
  function interceptConsole() {
    // Standard console methods
    ['log', 'warn', 'error', 'info', 'debug'].forEach(level => {
      console[level] = function(...args) {
        // Call original method first
        originalConsole[level].apply(console, args);

        // Send to monitor
        sendToMonitor(level, args);
      };
    });

    // Enhanced console methods with more context
    ['trace', 'assert', 'table', 'group', 'groupCollapsed', 'groupEnd'].forEach(method => {
      if (console[method] && originalConsole[method]) {
        console[method] = function(...args) {
          // Call original method first
          originalConsole[method].apply(console, args);

          // Send to monitor with method type
          sendToMonitor('info', [`[${method.toUpperCase()}]`, ...args]);
        };
      }
    });

    // Time methods
    const timeMap = new Map();
    if (console.time && originalConsole.time) {
      console.time = function(label) {
        originalConsole.time.apply(console, arguments);
        timeMap.set(label, Date.now());
        sendToMonitor('info', [`[TIME START] ${label}`]);
      };
    }

    if (console.timeEnd && originalConsole.timeEnd) {
      console.timeEnd = function(label) {
        originalConsole.timeEnd.apply(console, arguments);
        const startTime = timeMap.get(label);
        if (startTime) {
          const duration = Date.now() - startTime;
          sendToMonitor('info', [`[TIME END] ${label}: ${duration}ms`]);
          timeMap.delete(label);
        }
      };
    }

    // Count method
    const countMap = new Map();
    if (console.count && originalConsole.count) {
      console.count = function(label = 'default') {
        originalConsole.count.apply(console, arguments);
        const current = (countMap.get(label) || 0) + 1;
        countMap.set(label, current);
        sendToMonitor('info', [`[COUNT] ${label}: ${current}`]);
      };
    }

    // Clear method
    if (console.clear && originalConsole.clear) {
      console.clear = function() {
        originalConsole.clear.apply(console, arguments);
        sendToMonitor('info', ['[CLEAR] Console cleared']);
      };
    }
  }

  // Intercept uncaught errors with auto-correction capabilities
  function interceptErrors() {
    window.addEventListener('error', function(event) {
      const errorInfo = {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      };

      // Enhanced error analysis for auto-correction
      const errorAnalysis = analyzeError(event);

      sendToMonitor('error', [
        `🚨 CRITICAL ERROR DETECTED: ${event.message}`,
        `📍 Location: ${event.filename}:${event.lineno}:${event.colno}`,
        `🔍 Analysis: ${errorAnalysis.type}`,
        `💡 Suggested Fix: ${errorAnalysis.suggestion}`,
        `📋 Stack: ${event.error?.stack || 'No stack trace'}`
      ], errorInfo);

      // Trigger auto-correction if enabled
      if (window.AUTO_CORRECTION_ENABLED) {
        triggerAutoCorrection(errorAnalysis, errorInfo);
      }
    });

    window.addEventListener('unhandledrejection', function(event) {
      sendToMonitor('error', [
        `🚨 UNHANDLED PROMISE REJECTION: ${event.reason}`,
        `📋 Stack: ${event.reason?.stack || ''}`
      ]);
    });
  }

  // Enhanced error analysis system
  function analyzeError(event) {
    const message = event.message;
    const filename = event.filename;

    // Detect common React/JavaScript errors
    if (message.includes('is not defined')) {
      const variable = message.match(/(\w+) is not defined/)?.[1];
      return {
        type: 'UNDEFINED_VARIABLE',
        variable: variable,
        suggestion: `Variable '${variable}' needs to be declared or imported`,
        autoFixable: true,
        priority: 'HIGH'
      };
    }

    if (message.includes('Cannot read prop') || message.includes('Cannot read properties')) {
      return {
        type: 'NULL_REFERENCE',
        suggestion: 'Add null/undefined checks or default values',
        autoFixable: true,
        priority: 'HIGH'
      };
    }

    if (filename.includes('KanbanBoard.tsx')) {
      return {
        type: 'KANBAN_COMPONENT_ERROR',
        suggestion: 'Check component state and props initialization',
        autoFixable: true,
        priority: 'CRITICAL'
      };
    }

    return {
      type: 'GENERIC_ERROR',
      suggestion: 'Manual investigation required',
      autoFixable: false,
      priority: 'MEDIUM'
    };
  }

  // Auto-correction trigger system
  function triggerAutoCorrection(analysis, errorInfo) {
    if (!analysis.autoFixable) return;

    sendToMonitor('info', [
      `🤖 AUTO-CORRECTION TRIGGERED`,
      `🎯 Error Type: ${analysis.type}`,
      `⚡ Initiating fix for: ${analysis.variable || 'detected issue'}`
    ]);

    // Send correction request to MCP server
    const correctionRequest = {
      type: 'auto_correction',
      error: errorInfo,
      analysis: analysis,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(correctionRequest));
    }
  }

  // Intercept React errors (if React DevTools are available)
  function interceptReactErrors() {
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      const originalOnErrorOrWarning = hook.onErrorOrWarning;

      if (originalOnErrorOrWarning) {
        hook.onErrorOrWarning = function(...args) {
          originalOnErrorOrWarning.apply(this, args);
          sendToMonitor('error', ['React Error:', ...args]);
        };
      }
    }
  }

  // Initialize when DOM is ready
  function init() {
    originalConsole.log('🔍 Initializing Console Monitor...');

    initWebSocket();
    interceptConsole();
    interceptErrors();
    interceptReactErrors();

    // Start continuous monitoring and auto-correction
    setTimeout(() => {
      startContinuousMonitoring();
    }, 1500);

    // Send initial connection message
    setTimeout(() => {
      console.log('📡 Console Monitor active - all logs will be forwarded to MCP server');
    }, 1000);
  }

  // Start immediately if DOM is already loaded, otherwise wait
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Continuous monitoring and auto-correction system
  function startContinuousMonitoring() {
    // Enable auto-correction by default
    window.AUTO_CORRECTION_ENABLED = true;

    sendToMonitor('info', [
      '🤖 CONTINUOUS AUTO-CORRECTION SYSTEM ACTIVATED',
      '🔄 Monitoring for errors while browser is open',
      '⚡ Auto-fixes will be applied automatically'
    ]);

    // Periodic health check and error sweep
    setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        sendToMonitor('debug', ['🔍 System health check - monitoring active']);
      }
    }, 30000); // Every 30 seconds

    // Monitor for new script loads that might introduce errors
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.tagName === 'SCRIPT') {
            sendToMonitor('info', [`📜 New script loaded: ${node.src || 'inline script'}`]);
          }
        });
      });
    });

    observer.observe(document.head, { childList: true });
    observer.observe(document.body, { childList: true });
  }

  // Expose manual methods for debugging and control
  window.consoleMonitor = {
    sendCustomLog: function(level, message) {
      sendToMonitor(level, [message]);
    },
    reconnect: function() {
      if (socket) {
        socket.close();
      }
      initWebSocket();
    },
    status: function() {
      return {
        connected: socket && socket.readyState === WebSocket.OPEN,
        url: WEBSOCKET_URL,
        reconnectAttempts: reconnectAttempts,
        autoCorrectionEnabled: window.AUTO_CORRECTION_ENABLED
      };
    },
    enableAutoCorrection: function() {
      window.AUTO_CORRECTION_ENABLED = true;
      sendToMonitor('info', ['🤖 Auto-correction ENABLED']);
    },
    disableAutoCorrection: function() {
      window.AUTO_CORRECTION_ENABLED = false;
      sendToMonitor('info', ['🚫 Auto-correction DISABLED']);
    },
    triggerErrorCheck: function() {
      sendToMonitor('info', ['🔍 Manual error check triggered']);
      // Force a check of current DOM state
      setTimeout(() => {
        if (document.querySelector('.error-boundary, [data-error]')) {
          sendToMonitor('warning', ['⚠️ Error indicators found in DOM']);
        }
      }, 100);
    }
  };

})();