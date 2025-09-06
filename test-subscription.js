#!/usr/bin/env bun

/**
 * Simple subscription test for executeTemplateStream
 * Now with configurable port management
 */

import WebSocket from 'ws';
import { PortManager } from './src/core/config/PortConfiguration.js';

// Get port from command line or environment
const PORT = process.argv[2] || process.env.GRAPHQL_PORT || 4110;
const portConfig = PortManager.generatePortConfig(PORT, 'development');
const WS_URL = `ws://localhost:${portConfig.websocket}/graphql`;
const SUBSCRIPTION_QUERY = {
  id: '1',
  type: 'start',
  payload: {
    query: `
      subscription {
        executeTemplateStream(
          templateIdentifier: "test-health-query"
          trackUsage: true
        ) {
          status
          data
          progress
          metadata {
            templateId
            templateName
            executionTime
          }
          timestamp
          error
        }
      }
    `
  }
};

console.log('📍 Port Configuration:');
console.log(`   HTTP Port: ${portConfig.http}`);
console.log(`   WebSocket Port: ${portConfig.websocket}`);
console.log(`   Environment: ${portConfig.environment}`);
console.log('');
console.log(`🔌 Connecting to WebSocket server at ${WS_URL}...`);
const ws = new WebSocket(WS_URL, 'graphql-ws');

ws.on('open', function open() {
  console.log('✅ WebSocket connected');
  
  // Send connection init
  ws.send(JSON.stringify({ type: 'connection_init' }));
  
  setTimeout(() => {
    console.log('📤 Sending subscription query...');
    ws.send(JSON.stringify(SUBSCRIPTION_QUERY));
  }, 100);
});

ws.on('message', function message(data) {
  console.log('📨 Received:', JSON.parse(data.toString()));
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close() {
  console.log('🔌 WebSocket connection closed');
});

// Close connection after 10 seconds
setTimeout(() => {
  console.log('⏰ Closing connection...');
  ws.close();
  process.exit(0);
}, 10000);