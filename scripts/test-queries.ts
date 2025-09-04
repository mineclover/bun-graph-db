#!/usr/bin/env bun

/**
 * GraphQL Query Testing Script
 * 
 * 자주 사용하는 GraphQL 쿼리들을 테스트하고 실행할 수 있는 스크립트입니다.
 * 
 * Usage:
 *   bun run scripts/test-queries.ts [query-name] [tableId]
 * 
 * Examples:
 *   bun run scripts/test-queries.ts minimal 1
 *   bun run scripts/test-queries.ts detailed 54
 */

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

// Query Samples
const QUERIES = {
  minimal: {
    name: 'MinimalTableWithNodes',
    query: `
      query MinimalTableWithNodes($tableId: ID!) {
        table(id: $tableId) {
          identifier
          description
        }
        
        nodes(tableId: $tableId) {
          nodes {
            id
            content
            attributes {
              value
              attribute {
                identifier
              }
            }
          }
          totalCount
        }
      }
    `
  },
  
  detailed: {
    name: 'DetailedTableWithNodes',
    query: `
      query DetailedTableWithNodes($tableId: ID!) {
        table(id: $tableId) {
          id
          identifier
          description
          nodeCount
          attributeCount
        }
        
        nodes(tableId: $tableId) {
          nodes {
            id
            content
            title
            description
            attributes {
              id
              value
              attribute {
                identifier
                description
                attributeType {
                  identifier
                  jsonType
                }
              }
            }
          }
          totalCount
          hasNextPage
        }
      }
    `
  },

  single: {
    name: 'BasicNodeWithAttributes',
    query: `
      query BasicNodeWithAttributes($nodeId: ID!) {
        node(id: $nodeId) {
          id
          content
          title
          attributes {
            id
            value
            attribute {
              identifier
              description
            }
          }
        }
      }
    `,
    variables: { nodeId: '1' }
  },

  overview: {
    name: 'TablesOverview',
    query: `
      query TablesOverview {
        tables {
          nodes {
            id
            identifier
            description
            nodeCount
            attributeCount
          }
          totalCount
        }
      }
    `,
    variables: {}
  }
};

async function executeQuery(queryKey: string, tableId?: string) {
  const queryConfig = QUERIES[queryKey as keyof typeof QUERIES];
  
  if (!queryConfig) {
    console.error(`❌ Unknown query: ${queryKey}`);
    console.log('Available queries:', Object.keys(QUERIES).join(', '));
    process.exit(1);
  }

  const variables = queryConfig.variables || { tableId: tableId || '1' };
  
  console.log(`🚀 Executing: ${queryConfig.name}`);
  console.log(`📝 Variables:`, variables);
  console.log('---');

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: queryConfig.query.trim(),
        variables
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('❌ GraphQL Errors:');
      data.errors.forEach((error: any) => {
        console.error(`  - ${error.message}`);
      });
      return;
    }

    console.log('✅ Query executed successfully');
    console.log('📊 Result:');
    console.log(JSON.stringify(data.data, null, 2));
    
  } catch (error) {
    console.error('❌ Failed to execute query:', error);
  }
}

// Script execution
async function main() {
  const [queryKey, tableId] = process.argv.slice(2);
  
  if (!queryKey) {
    console.log('📚 Available queries:');
    Object.entries(QUERIES).forEach(([key, config]) => {
      console.log(`  ${key}: ${config.name}`);
    });
    console.log('\nUsage: bun run scripts/test-queries.ts [query-name] [tableId]');
    return;
  }

  await executeQuery(queryKey, tableId);
}

main().catch(console.error);