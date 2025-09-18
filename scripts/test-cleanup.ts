#!/usr/bin/env bun

/**
 * Test Environment Cleanup Script
 *
 * Utility script to clean up test databases, processes, and temporary files
 * Used for manual cleanup and CI/CD pipeline maintenance
 */

import { TestIsolationHelpers } from '../tests/fixtures/test-isolation-helpers'
import { GraphQLTestServerManager } from '../tests/fixtures/test-graphql-server'
import { TestDatabaseFactory } from '../tests/fixtures/test-database-factory'
import { spawn } from 'bun'
import * as fs from 'node:fs'
import * as path from 'node:path'

interface CleanupOptions {
  force: boolean
  verbose: boolean
  dryRun: boolean
  includeTemp: boolean
  includePorts: boolean
  includeProcesses: boolean
}

class TestCleanupManager {
  private options: CleanupOptions

  constructor(options: Partial<CleanupOptions> = {}) {
    this.options = {
      force: false,
      verbose: false,
      dryRun: false,
      includeTemp: true,
      includePorts: true,
      includeProcesses: true,
      ...options
    }
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Starting test environment cleanup...')

    if (this.options.dryRun) {
      console.log('🔍 DRY RUN MODE - No actual cleanup will be performed')
    }

    let cleanupCount = 0

    // 1. Cleanup test isolation helpers
    try {
      if (!this.options.dryRun) {
        await TestIsolationHelpers.cleanupAll()
      }
      this.log('✅ Test isolation helpers cleaned up')
      cleanupCount++
    } catch (error) {
      this.log(`⚠️ Test isolation cleanup failed: ${error}`)
    }

    // 2. Cleanup GraphQL test servers
    try {
      if (!this.options.dryRun) {
        await GraphQLTestServerManager.stopAllServers()
      }
      this.log('✅ GraphQL test servers stopped')
      cleanupCount++
    } catch (error) {
      this.log(`⚠️ GraphQL server cleanup failed: ${error}`)
    }

    // 3. Cleanup test databases
    try {
      if (!this.options.dryRun) {
        await TestDatabaseFactory.cleanupAll()
      }
      this.log('✅ Test databases cleaned up')
      cleanupCount++
    } catch (error) {
      this.log(`⚠️ Database cleanup failed: ${error}`)
    }

    // 4. Cleanup temporary files
    if (this.options.includeTemp) {
      await this.cleanupTempFiles()
      cleanupCount++
    }

    // 5. Cleanup processes
    if (this.options.includeProcesses) {
      await this.cleanupProcesses()
      cleanupCount++
    }

    // 6. Cleanup ports
    if (this.options.includePorts) {
      await this.cleanupPorts()
      cleanupCount++
    }

    console.log(`\n✅ Cleanup completed! ${cleanupCount} categories processed`)
  }

  private async cleanupTempFiles(): Promise<void> {
    const tempDirs = [
      '/tmp/bun-graph-db-tests',
      path.join(process.cwd(), 'temp-dbs'),
      path.join(process.cwd(), 'logs'),
      '/var/tmp/bun-graph-db'
    ]

    for (const dir of tempDirs) {
      try {
        if (fs.existsSync(dir)) {
          const files = await this.findTempFiles(dir)

          if (files.length > 0) {
            this.log(`📁 Found ${files.length} temp files in ${dir}`)

            if (!this.options.dryRun) {
              for (const file of files) {
                try {
                  fs.unlinkSync(file)
                  this.log(`  🗑️ Removed: ${path.basename(file)}`)
                } catch (error) {
                  this.log(`  ⚠️ Failed to remove ${file}: ${error}`)
                }
              }

              // Remove empty directories
              try {
                const remainingFiles = fs.readdirSync(dir)
                if (remainingFiles.length === 0) {
                  fs.rmdirSync(dir)
                  this.log(`  📂 Removed empty directory: ${dir}`)
                }
              } catch (_error) {
                // Directory not empty or other error
              }
            }
          } else {
            this.log(`📁 No temp files found in ${dir}`)
          }
        }
      } catch (error) {
        this.log(`⚠️ Error cleaning ${dir}: ${error}`)
      }
    }
  }

  private async findTempFiles(dir: string): Promise<string[]> {
    const files: string[] = []

    try {
      const entries = fs.readdirSync(dir)

      for (const entry of entries) {
        const fullPath = path.join(dir, entry)
        const stat = fs.statSync(fullPath)

        if (stat.isFile()) {
          // Clean up SQLite files and logs
          if (entry.match(/\.(sqlite|sqlite-wal|sqlite-shm|log|tmp)$/)) {
            files.push(fullPath)
          }
          // Clean up old test files (older than 1 hour)
          else if (entry.startsWith('test-') &&
                   Date.now() - stat.mtime.getTime() > 3600000) {
            files.push(fullPath)
          }
        } else if (stat.isDirectory() && entry.startsWith('test-')) {
          // Recursively clean test directories
          const subFiles = await this.findTempFiles(fullPath)
          files.push(...subFiles)
        }
      }
    } catch (_error) {
      // Directory doesn't exist or permission error
    }

    return files
  }

  private async cleanupProcesses(): Promise<void> {
    const processPatterns = [
      'bun.*test',
      'node.*graphql',
      'bun.*src/main.ts'
    ]

    for (const pattern of processPatterns) {
      try {
        const proc = spawn(['pgrep', '-f', pattern], { stdout: 'pipe' })
        const output = await new Response(proc.stdout).text()

        if (output.trim()) {
          const pids = output.trim().split('\n').filter(Boolean)
          this.log(`🔍 Found ${pids.length} processes matching "${pattern}"`)

          if (!this.options.dryRun) {
            for (const pid of pids) {
              try {
                process.kill(parseInt(pid, 10), 'SIGTERM')
                this.log(`  💀 Terminated process ${pid}`)

                // Wait a bit then force kill if still running
                await new Promise(resolve => setTimeout(resolve, 1000))

                try {
                  process.kill(parseInt(pid, 10), 0) // Check if still running
                  process.kill(parseInt(pid, 10), 'SIGKILL')
                  this.log(`  💀 Force killed process ${pid}`)
                } catch {
                  // Process already terminated
                }
              } catch (error) {
                this.log(`  ⚠️ Failed to kill process ${pid}: ${error}`)
              }
            }
          } else {
            this.log(`  Would terminate ${pids.length} processes`)
          }
        } else {
          this.log(`🔍 No processes found matching "${pattern}"`)
        }
      } catch (_error) {
        // pgrep failed or no processes found
      }
    }
  }

  private async cleanupPorts(): Promise<void> {
    const testPortRange = { start: 14000, end: 14100 }
    const busyPorts: number[] = []

    for (let port = testPortRange.start; port <= testPortRange.end; port++) {
      try {
        const proc = spawn(['lsof', '-i', `:${port}`], { stdout: 'pipe', stderr: 'pipe' })
        const output = await new Response(proc.stdout).text()

        if (output.trim()) {
          busyPorts.push(port)
          this.log(`🔌 Port ${port} is in use`)
        }
      } catch {
        // Port is free or lsof failed
      }
    }

    if (busyPorts.length > 0) {
      this.log(`🔌 Found ${busyPorts.length} busy test ports`)

      if (!this.options.dryRun && this.options.force) {
        for (const port of busyPorts) {
          try {
            // Kill processes using the port
            const proc = spawn(['lsof', '-ti', `:${port}`], { stdout: 'pipe' })
            const pids = await new Response(proc.stdout).text()

            for (const pid of pids.trim().split('\n').filter(Boolean)) {
              process.kill(parseInt(pid, 10), 'SIGTERM')
              this.log(`  💀 Killed process ${pid} using port ${port}`)
            }
          } catch (error) {
            this.log(`  ⚠️ Failed to free port ${port}: ${error}`)
          }
        }
      } else if (!this.options.force) {
        this.log('  ℹ️ Use --force to kill processes using test ports')
      }
    } else {
      this.log('🔌 All test ports are free')
    }
  }

  private log(message: string): void {
    if (this.options.verbose || this.options.dryRun) {
      console.log(message)
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)

  const options: Partial<CleanupOptions> = {
    force: args.includes('--force') || args.includes('-f'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    dryRun: args.includes('--dry-run') || args.includes('-n'),
    includeTemp: !args.includes('--no-temp'),
    includePorts: !args.includes('--no-ports'),
    includeProcesses: !args.includes('--no-processes')
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🧹 Test Environment Cleanup Script

Usage:
  bun run scripts/test-cleanup.ts [options]

Options:
  --force, -f         Force cleanup (kill processes, remove locked files)
  --verbose, -v       Show detailed cleanup progress
  --dry-run, -n       Show what would be cleaned without doing it
  --no-temp          Skip temporary file cleanup
  --no-ports         Skip port cleanup
  --no-processes     Skip process cleanup
  --help, -h         Show this help message

Examples:
  bun run scripts/test-cleanup.ts                    # Normal cleanup
  bun run scripts/test-cleanup.ts --verbose          # Verbose cleanup
  bun run scripts/test-cleanup.ts --dry-run          # See what would be cleaned
  bun run scripts/test-cleanup.ts --force --verbose  # Aggressive cleanup

What gets cleaned:
  • Test isolation helpers and contexts
  • GraphQL test server instances
  • Isolated test databases
  • Temporary SQLite files and logs
  • Test processes (bun test, graphql servers)
  • Test ports (14000-14100 range)
`)
    return
  }

  try {
    const manager = new TestCleanupManager(options)
    await manager.cleanup()
  } catch (error) {
    console.error(`❌ Cleanup failed: ${error}`)
    process.exit(1)
  }
}

// Execute if run directly
if (import.meta.main) {
  main().catch(console.error)
}