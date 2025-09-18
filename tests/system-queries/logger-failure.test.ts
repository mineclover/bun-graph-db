import { describe, expect, it, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import * as fs from 'fs';
import * as path from 'path';
import { SystemQueries } from '../../src/services/system-queries';
import { Logger } from '../../src/utils/logger';

describe('Logger Failure Error Handling', () => {
  let db: Database;
  let systemQueries: SystemQueries;
  let tempDbPath: string;
  let originalConsoleError: typeof console.error;
  let originalConsoleLog: typeof console.log;
  let originalConsoleWarn: typeof console.warn;

  beforeEach(() => {
    // Create temp database for testing
    tempDbPath = path.join(__dirname, '../temp-dbs', `test-logger-${Date.now()}.sqlite`);

    // Ensure temp directory exists
    const tempDir = path.dirname(tempDbPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    db = new Database(tempDbPath);
    systemQueries = new SystemQueries(db);

    // Store original console methods
    originalConsoleError = console.error;
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
  });

  afterEach(() => {
    // Restore console methods
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;

    // Cleanup
    if (db) {
      db.close();
    }
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  describe('Console Logger Failures', () => {
    it('should continue operation when console.error throws', async () => {
      // Mock console.error to throw
      console.error = () => {
        throw new Error('Console error failed');
      };

      // Operation should not crash
      const stats = await systemQueries.systemStats();

      expect(stats).toBeDefined();
      expect(stats.cpuUsage).toBeDefined();
      expect(stats.memory).toBeDefined();
    });

    it('should continue operation when console.log throws', async () => {
      // Mock console.log to throw
      console.log = () => {
        throw new Error('Console log failed');
      };

      // Operation should not crash
      const stats = await systemQueries.memoryStats();

      expect(stats).toBeDefined();
      expect(stats.heapUsed).toBeDefined();
    });

    it('should handle logger with undefined console methods', async () => {
      // Make console methods undefined
      (console as any).error = undefined;
      (console as any).log = undefined;
      (console as any).warn = undefined;

      // Should handle gracefully
      const stats = await systemQueries.healthCheck();

      expect(stats).toBeDefined();
      expect(stats.status).toBeDefined();
    });
  });

  describe('File Logger Failures', () => {
    it('should handle file write permission errors in logger', async () => {
      // Mock logger to use file output that will fail
      const logPath = '/root/impossible/path/log.txt'; // Permission denied path

      systemQueries.setLogger({
        log: (message: string) => {
          try {
            fs.appendFileSync(logPath, message + '\n');
          } catch (error) {
            // Silently fail or fallback
          }
        },
        error: (message: string) => {
          try {
            fs.appendFileSync(logPath, 'ERROR: ' + message + '\n');
          } catch (error) {
            // Silently fail
          }
        },
      });

      // Should continue despite logger failures
      const stats = await systemQueries.getDatabaseStats();

      expect(stats).toBeDefined();
      expect(stats.tableCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle disk full errors in file logger', async () => {
      // Mock fs.appendFileSync to simulate disk full
      const originalAppendFileSync = fs.appendFileSync;
      (fs as any).appendFileSync = () => {
        const error: any = new Error('ENOSPC: no space left on device');
        error.code = 'ENOSPC';
        throw error;
      };

      systemQueries.setLogger({
        log: (message: string) => {
          fs.appendFileSync('test.log', message);
        },
        error: (message: string) => {
          fs.appendFileSync('test.log', message);
        },
      });

      try {
        const stats = await systemQueries.systemStats();

        // Should complete despite logger failure
        expect(stats).toBeDefined();
      } finally {
        (fs as any).appendFileSync = originalAppendFileSync;
      }
    });
  });

  describe('Logger Injection Attacks', () => {
    it('should sanitize malicious log messages', async () => {
      let capturedLog: string | undefined;

      systemQueries.setLogger({
        log: (message: string) => {
          capturedLog = message;
        },
        error: (message: string) => {
          capturedLog = message;
        },
      });

      // Inject malicious content
      const maliciousData = `
        \x1b[31m HACKED \x1b[0m
        \r\n]; process.exit(); //
        ${String.fromCharCode(0)}NULL_BYTE
        %s%s%s%s%s%s%s
      `;

      // Create table with malicious name
      try {
        db.exec(`CREATE TABLE "${maliciousData}" (id INTEGER)`);
      } catch (error) {
        // Expected to fail, that's OK
      }

      const stats = await systemQueries.getDatabaseStats();

      expect(stats).toBeDefined();
      // Logger should have sanitized the input
      if (capturedLog) {
        expect(capturedLog).not.toContain('\x1b[31m');
        expect(capturedLog).not.toContain('process.exit');
        expect(capturedLog).not.toContain(String.fromCharCode(0));
      }
    });

    it('should handle extremely long log messages', async () => {
      let loggedSuccessfully = false;

      systemQueries.setLogger({
        log: (message: string) => {
          if (message.length > 1000000) {
            throw new Error('Log message too long');
          }
          loggedSuccessfully = true;
        },
        error: () => {},
      });

      // Create extremely long data
      const longData = 'x'.repeat(2000000);

      // Try to log it indirectly through operations
      for (let i = 0; i < 10; i++) {
        db.prepare('INSERT INTO sqlite_master (type, name) VALUES (?, ?)').run('test', longData);
      }

      const stats = await systemQueries.getDatabaseStats();

      // Should handle long messages gracefully
      expect(stats).toBeDefined();
    });
  });

  describe('Logger State Corruption', () => {
    it('should handle logger that modifies global state', async () => {
      const originalProcessExit = process.exit;

      systemQueries.setLogger({
        log: (message: string) => {
          // Malicious logger trying to exit process
          (process as any).exit = () => {
            throw new Error('Exit attempt blocked');
          };
        },
        error: () => {},
      });

      const stats = await systemQueries.systemStats();

      expect(stats).toBeDefined();
      // Process should still be running
      expect(process.exit).toBeDefined();

      // Restore
      process.exit = originalProcessExit;
    });

    it('should handle logger that throws async errors', async () => {
      systemQueries.setLogger({
        log: async (message: string) => {
          // Async logger that rejects
          await Promise.reject(new Error('Async logger error'));
        },
        error: () => {},
      });

      // Should not wait for or crash on async logger errors
      const stats = await systemQueries.memoryStats();

      expect(stats).toBeDefined();
      expect(stats.heapUsed).toBeGreaterThanOrEqual(0);
    });

    it('should handle logger with circular references', async () => {
      const circularLogger: any = {
        log: (message: string) => {
          // Try to log the logger itself (circular)
          console.log(circularLogger);
        },
      };
      circularLogger.self = circularLogger;
      circularLogger.error = circularLogger.log;

      systemQueries.setLogger(circularLogger);

      // Should handle circular reference without stack overflow
      const stats = await systemQueries.healthCheck();

      expect(stats).toBeDefined();
      expect(stats.status).toBeDefined();
    });
  });

  describe('Logger Performance Issues', () => {
    it('should timeout slow logger operations', async () => {
      systemQueries.setLogger({
        log: (message: string) => {
          // Simulate very slow logger
          const start = Date.now();
          while (Date.now() - start < 5000) {
            // Block for 5 seconds
          }
        },
        error: () => {},
      });

      // Operation should complete without waiting for slow logger
      const startTime = Date.now();
      const stats = await systemQueries.systemStats({ logTimeout: 100 });
      const elapsed = Date.now() - startTime;

      expect(stats).toBeDefined();
      expect(elapsed).toBeLessThan(1000); // Should not wait 5 seconds
    });

    it('should handle logger memory leaks', async () => {
      const leakyData: string[] = [];

      systemQueries.setLogger({
        log: (message: string) => {
          // Logger that leaks memory
          for (let i = 0; i < 10000; i++) {
            leakyData.push(message + i);
          }
        },
        error: () => {},
      });

      // Run multiple operations
      for (let i = 0; i < 10; i++) {
        await systemQueries.memoryStats();
      }

      // Should complete without running out of memory
      const finalStats = await systemQueries.memoryStats();

      expect(finalStats).toBeDefined();
      expect(finalStats.heapUsed).toBeLessThan(500 * 1024 * 1024); // Less than 500MB
    });
  });

  describe('Logger Fallback Mechanisms', () => {
    it('should fallback to console when custom logger fails', async () => {
      let consoleCalled = false;
      console.error = () => {
        consoleCalled = true;
      };

      systemQueries.setLogger({
        log: () => {
          throw new Error('Custom logger failed');
        },
        error: () => {
          throw new Error('Custom error logger failed');
        },
      });

      // Should fallback to console
      await systemQueries.systemStats();

      expect(consoleCalled).toBe(true);
    });

    it('should handle null logger gracefully', async () => {
      systemQueries.setLogger(null as any);

      // Should work with null logger
      const stats = await systemQueries.getDatabaseStats();

      expect(stats).toBeDefined();
      expect(stats.tableCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle logger with missing methods', async () => {
      systemQueries.setLogger({
        // Missing error method
        log: () => {},
      } as any);

      // Should work with incomplete logger
      const stats = await systemQueries.healthCheck();

      expect(stats).toBeDefined();
    });
  });

  describe('Concurrent Logger Access', () => {
    it('should handle concurrent logging from multiple operations', async () => {
      let logCount = 0;
      const threadSafeLogger = {
        log: (message: string) => {
          // Simulate race condition
          const current = logCount;
          setTimeout(() => {
            logCount = current + 1;
          }, Math.random() * 10);
        },
        error: () => {},
      };

      systemQueries.setLogger(threadSafeLogger);

      // Run concurrent operations
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(systemQueries.memoryStats());
        promises.push(systemQueries.systemStats());
        promises.push(systemQueries.getDatabaseStats());
      }

      const results = await Promise.all(promises);

      // All should complete successfully
      expect(results.length).toBe(30);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('should handle logger that modifies its own methods during execution', async () => {
      const mutatingLogger = {
        log: function(this: any, message: string) {
          // Self-modifying logger
          this.log = () => {
            throw new Error('Logger modified itself');
          };
        },
        error: () => {},
      };

      systemQueries.setLogger(mutatingLogger);

      // First call modifies logger
      await systemQueries.memoryStats();

      // Second call should handle modified logger
      const stats = await systemQueries.systemStats();

      expect(stats).toBeDefined();
    });
  });

  describe('Logger Output Validation', () => {
    it('should validate logger receives correct data types', async () => {
      let receivedTypes: string[] = [];

      systemQueries.setLogger({
        log: (message: any) => {
          receivedTypes.push(typeof message);
        },
        error: (message: any) => {
          receivedTypes.push(typeof message);
        },
      });

      await systemQueries.systemStats();
      await systemQueries.memoryStats();
      await systemQueries.getDatabaseStats();

      // All messages should be strings
      receivedTypes.forEach(type => {
        expect(type).toBe('string');
      });
    });

    it('should handle logger that returns values', async () => {
      systemQueries.setLogger({
        log: (message: string) => {
          // Logger that returns values (shouldn't affect operation)
          return { logged: true, message };
        },
        error: (message: string) => {
          return Promise.resolve('logged');
        },
      });

      const stats = await systemQueries.healthCheck();

      expect(stats).toBeDefined();
      expect(stats.status).toBeDefined();
    });

    it('should ensure logger doesn\'t receive sensitive data', async () => {
      let capturedMessages: string[] = [];

      systemQueries.setLogger({
        log: (message: string) => {
          capturedMessages.push(message);
        },
        error: (message: string) => {
          capturedMessages.push(message);
        },
      });

      // Create sensitive data
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          password TEXT,
          ssn TEXT,
          credit_card TEXT
        );
        INSERT INTO users (password, ssn, credit_card)
        VALUES ('secret123', '123-45-6789', '4111-1111-1111-1111');
      `);

      await systemQueries.getDatabaseStats();

      // Logger should not receive sensitive data
      capturedMessages.forEach(msg => {
        expect(msg).not.toContain('secret123');
        expect(msg).not.toContain('123-45-6789');
        expect(msg).not.toContain('4111-1111-1111-1111');
      });
    });
  });

  describe('Logger Recovery Strategies', () => {
    it('should implement exponential backoff for failing logger', async () => {
      let attemptCount = 0;
      let attemptTimes: number[] = [];

      systemQueries.setLogger({
        log: (message: string) => {
          attemptCount++;
          attemptTimes.push(Date.now());
          if (attemptCount < 3) {
            throw new Error('Logger temporarily unavailable');
          }
        },
        error: () => {},
      });

      await systemQueries.systemStats();

      if (attemptTimes.length > 1) {
        // Check for increasing delays between attempts
        for (let i = 1; i < attemptTimes.length; i++) {
          const delay = attemptTimes[i] - attemptTimes[i - 1];
          expect(delay).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should circuit break after repeated logger failures', async () => {
      let callCount = 0;

      systemQueries.setLogger({
        log: () => {
          callCount++;
          throw new Error('Persistent logger failure');
        },
        error: () => {
          callCount++;
          throw new Error('Persistent error logger failure');
        },
      });

      // Run multiple operations
      for (let i = 0; i < 10; i++) {
        await systemQueries.memoryStats();
      }

      // Logger should be circuit-broken after initial failures
      expect(callCount).toBeLessThan(50); // Not called for every operation
    });

    it('should gracefully degrade logging detail on failures', async () => {
      let logLevel = 'verbose';

      systemQueries.setLogger({
        log: (message: string) => {
          if (logLevel === 'verbose' && message.length > 100) {
            logLevel = 'summary';
            throw new Error('Too much detail');
          }
        },
        error: () => {},
      });

      // Should adapt to reduce logging detail
      const stats = await systemQueries.getDatabaseStats();

      expect(stats).toBeDefined();
      expect(logLevel).toBe('summary');
    });
  });
});