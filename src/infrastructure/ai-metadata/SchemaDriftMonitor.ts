import { GraphQLSchema, introspectionFromSchema } from 'graphql';
import { GraphQLSchemaIntrospector } from './GraphQLSchemaIntrospector';
import { SchemaSyncPipeline } from './SchemaSyncPipeline';
import type { SyncResult } from './SchemaSyncPipeline';

/**
 * Real-time Schema Drift Detection and Monitoring
 * Monitors GraphQL schema changes and triggers synchronization
 */
export class SchemaDriftMonitor {
  private schema: GraphQLSchema;
  private schemaIntrospector: GraphQLSchemaIntrospector;
  private syncPipeline: SchemaSyncPipeline;
  private lastSchemaHash: string | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private driftCallbacks: DriftCallback[] = [];
  private isMonitoring = false;

  private readonly DEFAULT_CHECK_INTERVAL = 30 * 1000; // 30 seconds
  private readonly DRIFT_THRESHOLD = 0.1; // 10% change threshold

  constructor(
    schema: GraphQLSchema,
    syncPipeline: SchemaSyncPipeline,
    checkInterval = this.DEFAULT_CHECK_INTERVAL
  ) {
    this.schema = schema;
    this.schemaIntrospector = new GraphQLSchemaIntrospector(schema);
    this.syncPipeline = syncPipeline;
    this.DEFAULT_CHECK_INTERVAL = checkInterval;
  }

  /**
   * Start monitoring for schema changes
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.warn('⚠️ Schema drift monitoring already active');
      return;
    }

    console.log('🔍 Starting schema drift monitoring...');

    // Initialize baseline schema hash
    await this.updateSchemaBaseline();

    // Start monitoring interval
    this.monitoringInterval = setInterval(async () => {
      await this.checkForDrift();
    }, this.DEFAULT_CHECK_INTERVAL);

    this.isMonitoring = true;
    console.log(`✅ Schema drift monitoring active (check interval: ${this.DEFAULT_CHECK_INTERVAL}ms)`);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    console.log('🔴 Schema drift monitoring stopped');
  }

  /**
   * Register callback for drift detection
   */
  onDriftDetected(callback: DriftCallback): void {
    this.driftCallbacks.push(callback);
  }

  /**
   * Remove drift callback
   */
  removeDriftCallback(callback: DriftCallback): void {
    const index = this.driftCallbacks.indexOf(callback);
    if (index > -1) {
      this.driftCallbacks.splice(index, 1);
    }
  }

  /**
   * Manually check for schema drift
   */
  async checkForDrift(): Promise<DriftDetectionResult> {
    try {
      const currentSchemaHash = await this.generateSchemaHash();

      if (this.lastSchemaHash === null) {
        // First check - establish baseline
        this.lastSchemaHash = currentSchemaHash;
        return {
          driftDetected: false,
          timestamp: new Date().toISOString(),
          message: 'Baseline schema hash established'
        };
      }

      if (currentSchemaHash !== this.lastSchemaHash) {
        console.log('🚨 Schema drift detected!');

        const driftAnalysis = await this.analyzeDrift(this.lastSchemaHash, currentSchemaHash);
        const result: DriftDetectionResult = {
          driftDetected: true,
          timestamp: new Date().toISOString(),
          previousHash: this.lastSchemaHash,
          currentHash: currentSchemaHash,
          analysis: driftAnalysis,
          message: `Schema changed: ${driftAnalysis.changeDescription}`
        };

        // Update baseline
        this.lastSchemaHash = currentSchemaHash;

        // Notify callbacks
        await this.notifyDriftCallbacks(result);

        // Auto-trigger sync if significant drift
        if (driftAnalysis.severity === 'HIGH' || driftAnalysis.affectsAIMetadata) {
          console.log('🔄 Auto-triggering schema synchronization...');
          await this.triggerAutoSync(driftAnalysis);
        }

        return result;
      }

      return {
        driftDetected: false,
        timestamp: new Date().toISOString(),
        message: 'No schema changes detected'
      };

    } catch (error) {
      console.error('❌ Error checking for schema drift:', error);
      return {
        driftDetected: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Drift check failed'
      };
    }
  }

  /**
   * Update schema reference and reset baseline
   */
  async updateSchema(newSchema: GraphQLSchema): Promise<void> {
    console.log('🔄 Updating schema reference...');

    this.schema = newSchema;
    this.schemaIntrospector = new GraphQLSchemaIntrospector(newSchema);

    // Reset baseline
    await this.updateSchemaBaseline();

    console.log('✅ Schema reference updated');
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus(): MonitoringStatus {
    return {
      isMonitoring: this.isMonitoring,
      lastSchemaHash: this.lastSchemaHash,
      checkInterval: this.DEFAULT_CHECK_INTERVAL,
      callbackCount: this.driftCallbacks.length,
      lastCheck: new Date().toISOString()
    };
  }

  /**
   * Force synchronization for specific tables
   */
  async forceSyncTables(tableIds: string[]): Promise<SyncResult[]> {
    console.log(`🔄 Force synchronizing ${tableIds.length} tables...`);

    const results: SyncResult[] = [];

    for (const tableId of tableIds) {
      try {
        const result = await this.syncPipeline.runFullSync(tableId);
        results.push(result);
        console.log(`✅ Table ${tableId}: ${result.success ? 'Success' : 'Failed'}`);
      } catch (error) {
        console.error(`❌ Table ${tableId} sync failed:`, error);
        results.push({
          tableId,
          timestamp: new Date().toISOString(),
          duration: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          recommendations: []
        });
      }
    }

    return results;
  }

  /**
   * Private methods
   */
  private async generateSchemaHash(): Promise<string> {
    const introspection = introspectionFromSchema(this.schema);
    const schemaString = JSON.stringify(introspection, null, 0);

    // Generate hash
    let hash = 0;
    for (let i = 0; i < schemaString.length; i++) {
      const char = schemaString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(16);
  }

  private async updateSchemaBaseline(): Promise<void> {
    this.lastSchemaHash = await this.generateSchemaHash();
    console.log(`📊 Schema baseline updated: ${this.lastSchemaHash}`);
  }

  private async analyzeDrift(previousHash: string, currentHash: string): Promise<DriftAnalysis> {
    // Get detailed introspection data
    const currentIntrospection = await this.schemaIntrospector.getSchemaIntrospection();

    // For detailed analysis, we would need to store previous introspection
    // For now, provide basic analysis based on hash change
    const analysis: DriftAnalysis = {
      severity: 'MEDIUM', // Default severity
      changeDescription: 'Schema structure modified',
      affectsAIMetadata: true, // Assume true for safety
      changes: [],
      impactAssessment: {
        queries: 'UNKNOWN',
        mutations: 'UNKNOWN',
        types: 'UNKNOWN',
        aiMetadata: 'LIKELY_AFFECTED'
      },
      recommendations: [
        'Review AI metadata compatibility',
        'Validate existing templates',
        'Update schema documentation'
      ]
    };

    // Detect change types based on introspection
    const queryCount = currentIntrospection.queries.length;
    const mutationCount = currentIntrospection.mutations.length;
    const typeCount = currentIntrospection.types.length;

    if (queryCount > 0 || mutationCount > 0) {
      analysis.changes.push('Operations added or modified');
      analysis.severity = 'HIGH';
    }

    if (typeCount > 10) { // Arbitrary threshold
      analysis.changes.push('Type definitions changed');
    }

    return analysis;
  }

  private async notifyDriftCallbacks(result: DriftDetectionResult): Promise<void> {
    for (const callback of this.driftCallbacks) {
      try {
        await callback(result);
      } catch (error) {
        console.error('❌ Error in drift callback:', error);
      }
    }
  }

  private async triggerAutoSync(driftAnalysis: DriftAnalysis): Promise<void> {
    // For now, we don't have a list of active tables
    // In a real implementation, this would get the list from a service
    console.log('🔄 Auto-sync would trigger for affected tables');

    // Example: sync a test table
    try {
      await this.syncPipeline.runFullSync('265'); // Use our test table
      console.log('✅ Auto-sync completed for table 265');
    } catch (error) {
      console.error('❌ Auto-sync failed:', error);
    }
  }
}

// Type definitions
export interface DriftDetectionResult {
  driftDetected: boolean;
  timestamp: string;
  previousHash?: string;
  currentHash?: string;
  analysis?: DriftAnalysis;
  message: string;
  error?: string;
}

export interface DriftAnalysis {
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  changeDescription: string;
  affectsAIMetadata: boolean;
  changes: string[];
  impactAssessment: {
    queries: 'UNKNOWN' | 'AFFECTED' | 'UNAFFECTED';
    mutations: 'UNKNOWN' | 'AFFECTED' | 'UNAFFECTED';
    types: 'UNKNOWN' | 'AFFECTED' | 'UNAFFECTED';
    aiMetadata: 'LIKELY_AFFECTED' | 'POSSIBLY_AFFECTED' | 'UNAFFECTED';
  };
  recommendations: string[];
}

export interface MonitoringStatus {
  isMonitoring: boolean;
  lastSchemaHash: string | null;
  checkInterval: number;
  callbackCount: number;
  lastCheck: string;
}

export type DriftCallback = (result: DriftDetectionResult) => Promise<void> | void;

/**
 * Helper factory for creating pre-configured drift monitors
 */
export class SchemaDriftMonitorFactory {
  static createDefaultMonitor(
    schema: GraphQLSchema,
    syncPipeline: SchemaSyncPipeline,
    options?: {
      checkInterval?: number;
      autoStart?: boolean;
    }
  ): SchemaDriftMonitor {
    const monitor = new SchemaDriftMonitor(
      schema,
      syncPipeline,
      options?.checkInterval
    );

    // Add default callbacks
    monitor.onDriftDetected(async (result) => {
      console.log(`📊 Drift Detection Result:`, {
        detected: result.driftDetected,
        timestamp: result.timestamp,
        message: result.message
      });

      if (result.analysis) {
        console.log(`📈 Drift Analysis:`, {
          severity: result.analysis.severity,
          changes: result.analysis.changes,
          recommendations: result.analysis.recommendations
        });
      }
    });

    if (options?.autoStart !== false) {
      // Auto-start monitoring
      setImmediate(() => {
        monitor.startMonitoring().catch(console.error);
      });
    }

    return monitor;
  }

  static createProductionMonitor(
    schema: GraphQLSchema,
    syncPipeline: SchemaSyncPipeline,
    logger: (message: string, data?: any) => void
  ): SchemaDriftMonitor {
    const monitor = new SchemaDriftMonitor(schema, syncPipeline, 60 * 1000); // 1 minute

    monitor.onDriftDetected(async (result) => {
      logger('Schema drift detected', {
        timestamp: result.timestamp,
        severity: result.analysis?.severity,
        changes: result.analysis?.changes
      });

      // In production, could trigger alerts, notifications, etc.
    });

    return monitor;
  }
}