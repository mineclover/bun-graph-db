/**
 * AIMetadata Documentation E2E Tests
 *
 * End-to-end tests for AIMetadata documentation quality:
 * - Information completeness validation
 * - Documentation accuracy verification
 * - User experience testing
 * - Cross-system integration testing
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import {
  enableLegacyAiMetadataCompatibility,
  type IsolatedTestContext,
  setupIntegrationTest,
} from '../fixtures/test-isolation-helpers'
import {
  insertAttribute,
  insertNode,
  insertNodeAttributes,
  insertTable,
  insertTemplate,
} from '../fixtures/ai-metadata-fixtures'

const SUITE_NAME = 'ai-metadata-documentation-e2e'
let testContext: IsolatedTestContext
let comprehensiveTableId: string

describe('AIMetadata Documentation E2E Tests', () => {
  beforeAll(async () => {
    console.log('🚀 Setting up AIMetadata documentation E2E test environment...')
    testContext = await setupIntegrationTest(SUITE_NAME)
    enableLegacyAiMetadataCompatibility(testContext.database?.database.getConnection())
    console.log('✅ AIMetadata documentation E2E environment ready')
    console.log(`🌐 GraphQL Server: ${testContext.server?.url}`)
    console.log(`💾 Database: ${testContext.database?.databasePath}`)

    // Setup comprehensive test data
    await setupComprehensiveTestData()
  }, 60000)

  afterAll(async () => {
    console.log('🧹 Cleaning up AIMetadata documentation E2E environment...')
    await testContext.cleanup()
    console.log('✅ E2E Cleanup completed')
  }, 10000)

  async function setupComprehensiveTestData() {
    const db = testContext.database?.database.getConnection()

    // Create comprehensive test table with full metadata
    const table = insertTable(db as any, {
      identifier: 'comprehensive_users',
      description: 'Complete user profile management system with all metadata features',
    })
    const tableId = table.id
    comprehensiveTableId = tableId

    // Create diverse attribute types
    const attributeData = [
      // Required + Searchable
      ['user-id', 'user_id', 'User ID', 'uuid', 1, 1, 'Unique identifier for user'],
      ['full-name', 'full_name', 'Full Name', 'text', 1, 1, 'Complete user name'],
      ['email', 'email', 'Email Address', 'email', 1, 1, 'Primary contact email'],

      // Required only
      ['password-hash', 'password_hash', 'Password Hash', 'text', 1, 0, 'Encrypted password'],
      ['created-date', 'created_date', 'Account Created', 'datetime', 1, 0, 'Account creation timestamp'],

      // Searchable only
      ['username', 'username', 'Username', 'text', 0, 1, 'Public username'],
      ['department', 'department', 'Department', 'select', 0, 1, 'User department'],
      ['skills', 'skills', 'Skills', 'multiselect', 0, 1, 'User skill tags'],

      // Optional fields
      ['bio', 'bio', 'Biography', 'textarea', 0, 0, 'User biography'],
      ['birth-date', 'birth_date', 'Birth Date', 'date', 0, 0, 'Date of birth'],
      ['salary', 'salary', 'Salary', 'number', 0, 0, 'Annual salary'],
      ['is-active', 'is_active', 'Account Active', 'boolean', 0, 0, 'Account status flag'],
      ['profile-image', 'profile_image', 'Profile Image', 'file', 0, 0, 'User profile photo'],
      ['location', 'location', 'Location', 'location', 0, 1, 'User geographic location'],
      ['website', 'website', 'Website', 'url', 0, 0, 'Personal website URL'],
    ]

    for (const [_id, identifier, name, type, required, searchable, description] of attributeData) {
      insertAttribute(db as any, {
        tableId,
        identifier: identifier as string,
        name: name as string,
        attributeTypeIdentifier: type as string,
        required: Boolean(required),
        searchable: Boolean(searchable),
        description: description as string,
      })
    }

    // Create comprehensive template set
    const templateData = [
      // CRUD operations
      [
        'create-user',
        'Create User Profile',
        'Creates a new user with complete profile information',
        'INSERT INTO users...',
        'create,user,profile',
      ],
      [
        'update-user',
        'Update User Profile',
        'Updates existing user profile information',
        'UPDATE users SET...',
        'update,user,profile',
      ],
      [
        'delete-user',
        'Delete User Account',
        'Safely removes user account and related data',
        'DELETE FROM users...',
        'delete,user,account',
      ],
      [
        'get-user',
        'Get User Details',
        'Retrieves complete user profile information',
        'SELECT * FROM users WHERE...',
        'read,user,profile',
      ],

      // Search operations
      [
        'search-users-by-name',
        'Search Users by Name',
        'Find users by name pattern matching',
        'SELECT * FROM users WHERE full_name LIKE...',
        'search,name,user',
      ],
      [
        'search-users-by-email',
        'Search Users by Email',
        'Find users by email address',
        'SELECT * FROM users WHERE email LIKE...',
        'search,email,user',
      ],
      [
        'search-users-by-department',
        'Search Users by Department',
        'Find all users in specific department',
        'SELECT * FROM users WHERE department...',
        'search,department,user',
      ],
      [
        'search-users-by-skills',
        'Search Users by Skills',
        'Find users with specific skills',
        'SELECT * FROM users WHERE skills CONTAINS...',
        'search,skills,user',
      ],

      // Analytics operations
      [
        'user-count-by-department',
        'User Count by Department',
        'Count users grouped by department',
        'SELECT department, COUNT(*) FROM users...',
        'analytics,count,department',
      ],
      [
        'active-users-report',
        'Active Users Report',
        'Generate report of active users',
        'SELECT COUNT(*) FROM users WHERE is_active...',
        'analytics,active,report',
      ],
      [
        'user-registration-trends',
        'User Registration Trends',
        'Analyze user registration over time',
        'SELECT DATE(created_date), COUNT(*) FROM users...',
        'analytics,trends,registration',
      ],

      // Advanced operations
      [
        'bulk-update-department',
        'Bulk Update Department',
        'Update department for multiple users',
        'UPDATE users SET department = ? WHERE...',
        'bulk,update,department',
      ],
      [
        'export-user-list',
        'Export User List',
        'Export filtered user list with selected fields',
        'SELECT full_name, email, department FROM users...',
        'export,users,list',
      ],
      [
        'user-audit-log',
        'User Audit Log',
        'Generate audit trail for user changes',
        'SELECT * FROM user_audit WHERE user_id...',
        'audit,log,history',
      ],
    ]

    for (let i = 0; i < templateData.length; i++) {
      const [identifier, name, description, query, tags] = templateData[i]
      insertTemplate(db as any, {
        identifier: identifier as string,
        name: name as string,
        description: description as string,
        query: query as string,
        tableId,
        tableIdentifier: table.identifier,
        tags: String(tags).split(','),
      })
    }

    // Create diverse sample data
    const sampleUsers = [
      ['John Doe', 'Senior Software Engineer', 'john.doe@company.com', 'Engineering', 'JavaScript,TypeScript,React'],
      ['Jane Smith', 'Product Manager', 'jane.smith@company.com', 'Product', 'Product Strategy,Analytics,Agile'],
      ['Mike Johnson', 'DevOps Engineer', 'mike.johnson@company.com', 'Engineering', 'Docker,Kubernetes,AWS'],
      ['Sarah Wilson', 'UX Designer', 'sarah.wilson@company.com', 'Design', 'Figma,User Research,Prototyping'],
      ['Tom Brown', 'Data Scientist', 'tom.brown@company.com', 'Data', 'Python,Machine Learning,Statistics'],
      [
        'Lisa Davis',
        'Marketing Manager',
        'lisa.davis@company.com',
        'Marketing',
        'Digital Marketing,SEO,Content Strategy',
      ],
      ['Alex Chen', 'Frontend Developer', 'alex.chen@company.com', 'Engineering', 'Vue.js,CSS,HTML'],
      [
        'Emily Rodriguez',
        'Backend Developer',
        'emily.rodriguez@company.com',
        'Engineering',
        'Node.js,PostgreSQL,GraphQL',
      ],
      ['David Kim', 'QA Engineer', 'david.kim@company.com', 'Quality', 'Test Automation,Selenium,Jest'],
      [
        'Maria Garcia',
        'Business Analyst',
        'maria.garcia@company.com',
        'Business',
        'SQL,Requirements Analysis,Process Modeling',
      ],
    ]

    for (let i = 0; i < sampleUsers.length; i++) {
      const [name, title, email, department, skills] = sampleUsers[i]
      const node = insertNode(db as any, {
        tableId,
        title: name as string,
        content: title as string,
      })

      insertNodeAttributes(db as any, {
        nodeId: node.id,
        tableId,
        values: {
          full_name: String(name),
          email: String(email),
          department: String(department),
          skills: String(skills),
          is_active: i % 8 !== 0 ? 'true' : 'false',
        },
      })
    }

    console.log('✅ Comprehensive test data setup completed')
  }

  describe('Documentation Completeness Validation', () => {
    test('should provide complete schema information for complex table', async () => {
      const query = `
        query ComprehensiveSchemaTest {
          table(id: "${comprehensiveTableId}") {
            id
            identifier
            name
            description
            aiMetadata {
              schemaInfo {
                dataTypes
                requiredFields
                searchableFields
                relationshipCapabilities
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)

      expect(result.errors).toBeUndefined()
      expect(result.data.table).toBeDefined()

      const schemaInfo = result.data.table.aiMetadata.schemaInfo

      // Verify comprehensive data types coverage
      expect(Object.keys(schemaInfo.dataTypes).length).toBeGreaterThanOrEqual(15)

      // Check for diverse data types
      const dataTypes = Object.values(schemaInfo.dataTypes)
      expect(dataTypes).toContain('text')
      expect(dataTypes).toContain('email')
      expect(dataTypes).toContain('number')
      expect(dataTypes).toContain('boolean')
      expect(dataTypes).toContain('date')
      expect(dataTypes).toContain('datetime')
      expect(dataTypes).toContain('url')
      expect(dataTypes).toContain('file')

      // Verify required fields identification
      expect(schemaInfo.requiredFields.length).toBe(5) // user_id, full_name, email, password_hash, created_date
      expect(schemaInfo.requiredFields).toContain('user_id')
      expect(schemaInfo.requiredFields).toContain('full_name')
      expect(schemaInfo.requiredFields).toContain('email')

      // Verify searchable fields identification
      expect(schemaInfo.searchableFields.length).toBe(7) // All searchable fields
      expect(schemaInfo.searchableFields).toContain('full_name')
      expect(schemaInfo.searchableFields).toContain('email')
      expect(schemaInfo.searchableFields).toContain('username')
      expect(schemaInfo.searchableFields).toContain('department')
      expect(schemaInfo.searchableFields).toContain('skills')

      // Verify relationship capabilities
      expect(Array.isArray(schemaInfo.relationshipCapabilities)).toBe(true)

      console.log('✅ Schema information completeness validated')
    })

    test('should provide comprehensive usage patterns documentation', async () => {
      const query = `
        query ComprehensiveUsagePatternsTest {
          table(id: "${comprehensiveTableId}") {
            aiMetadata {
              usagePatterns {
                commonQueries {
                  pattern
                  description
                  example
                }
                templateRecommendations {
                  templateId
                  useCase
                }
                queryComplexity
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)

      const usagePatterns = result.data.table.aiMetadata.usagePatterns

      // Verify common queries generation
      expect(Array.isArray(usagePatterns.commonQueries)).toBe(true)
      expect(usagePatterns.commonQueries.length).toBeGreaterThan(5)

      // Validate query pattern structure
      usagePatterns.commonQueries.forEach((query: any) => {
        expect(query).toHaveProperty('pattern')
        expect(query).toHaveProperty('description')
        expect(query).toHaveProperty('example')
        expect(typeof query.pattern).toBe('string')
        expect(typeof query.description).toBe('string')
        expect(typeof query.example).toBe('string')
        expect(query.pattern.length).toBeGreaterThan(0)
        expect(query.description.length).toBeGreaterThan(0)
        expect(query.example.length).toBeGreaterThan(0)
      })

      // Verify template recommendations
      expect(Array.isArray(usagePatterns.templateRecommendations)).toBe(true)
      expect(usagePatterns.templateRecommendations.length).toBe(14) // All templates created

      // Validate template recommendation structure
      usagePatterns.templateRecommendations.forEach((template: any) => {
        expect(template).toHaveProperty('templateId')
        expect(template).toHaveProperty('useCase')
        expect(typeof template.templateId).toBe('string')
        expect(typeof template.useCase).toBe('string')
        expect(template.templateId.length).toBeGreaterThan(0)
        expect(template.useCase.length).toBeGreaterThan(0)
      })

      // Verify complexity assessment
      expect(['simple', 'moderate', 'complex']).toContain(usagePatterns.queryComplexity)
      expect(usagePatterns.queryComplexity).toBe('complex') // Should be complex due to many templates

      console.log('✅ Usage patterns documentation completeness validated')
    })

    test('should provide rich sample data with attributes', async () => {
      const query = `
        query ComprehensiveSampleDataTest {
          table(id: "${comprehensiveTableId}") {
            aiMetadata {
              sampleData {
                entries {
                  nodeId
                  title
                  content
                  attributes
                }
                totalCount
                hasMore
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)

      const sampleData = result.data.table.aiMetadata.sampleData

      // Verify sample data structure
      expect(Array.isArray(sampleData.entries)).toBe(true)
      expect(sampleData.entries.length).toBeGreaterThan(0)
      expect(sampleData.entries.length).toBeLessThanOrEqual(5) // Default limit
      expect(typeof sampleData.totalCount).toBe('number')
      expect(typeof sampleData.hasMore).toBe('boolean')

      // Verify sample entry completeness
      sampleData.entries.forEach((entry: any) => {
        expect(entry).toHaveProperty('nodeId')
        expect(entry).toHaveProperty('title')
        expect(entry).toHaveProperty('content')
        expect(entry).toHaveProperty('attributes')

        expect(typeof entry.nodeId).toBe('string')
        expect(typeof entry.title).toBe('string')
        expect(typeof entry.content).toBe('string')
        expect(typeof entry.attributes).toBe('object')

        // Verify attributes are populated
        expect(Object.keys(entry.attributes).length).toBeGreaterThan(0)

        // Check for expected attribute fields
        if (entry.attributes.full_name) {
          expect(typeof entry.attributes.full_name).toBe('string')
        }
        if (entry.attributes.email) {
          expect(entry.attributes.email).toContain('@')
        }
        if (entry.attributes.department) {
          expect(['Engineering', 'Product', 'Design', 'Data', 'Marketing', 'Quality', 'Business']).toContain(
            entry.attributes.department,
          )
        }
      })

      console.log('✅ Sample data completeness and quality validated')
    })
  })

  describe('Documentation Accuracy Verification', () => {
    test('should accurately reflect table structure in schema info', async () => {
      const db = testContext.database?.database.getConnection()

      // Get actual table structure from database
      const actualAttributes = db
        .prepare(`
        SELECT a.identifier, at.identifier as attribute_type_id, a.required, a.searchable
        FROM attributes a
        LEFT JOIN attribute_types at ON at.id = a.attribute_type_id
        WHERE a.table_id = '${comprehensiveTableId}'
        ORDER BY a.identifier
      `)
        .all()

      // Get AIMetadata schema info
      const query = `
        query AccuracyVerification {
          table(id: "${comprehensiveTableId}") {
            aiMetadata {
              schemaInfo {
                dataTypes
                requiredFields
                searchableFields
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)
      const schemaInfo = result.data.table.aiMetadata.schemaInfo

      // Verify data types accuracy
      for (const attr of actualAttributes) {
        expect(schemaInfo.dataTypes).toHaveProperty(attr.identifier)
        expect(schemaInfo.dataTypes[attr.identifier]).toBe(attr.attribute_type_id)
      }

      // Verify required fields accuracy
      const actualRequiredFields = actualAttributes.filter((attr) => attr.required === 1).map((attr) => attr.identifier)
      expect(schemaInfo.requiredFields.sort()).toEqual(actualRequiredFields.sort())

      // Verify searchable fields accuracy
      const actualSearchableFields = actualAttributes
        .filter((attr) => attr.searchable === 1)
        .map((attr) => attr.identifier)
      expect(schemaInfo.searchableFields.sort()).toEqual(actualSearchableFields.sort())

      console.log('✅ Schema info accuracy verified against database')
    })

    test('should accurately count templates in usage patterns', async () => {
      const db = testContext.database?.database.getConnection()

      // Get actual template count
      const actualTemplateCount = db
        .prepare(`
        SELECT COUNT(*) as count
        FROM templates
        WHERE table_id = '${comprehensiveTableId}'
      `)
        .get().count

      // Get AIMetadata usage patterns
      const query = `
        query TemplateCountVerification {
          table(id: "${comprehensiveTableId}") {
            aiMetadata {
              usagePatterns {
                templateRecommendations {
                  templateId
                  useCase
                }
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)
      const templateRecommendations = result.data.table.aiMetadata.usagePatterns.templateRecommendations

      // Verify template count matches
      expect(templateRecommendations.length).toBe(actualTemplateCount)

      // Verify template IDs are valid
      const actualTemplateIds = db
        .prepare(`
        SELECT identifier
        FROM templates
        WHERE table_id = '${comprehensiveTableId}'
      `)
        .all()
        .map((t) => t.identifier)

      for (const rec of templateRecommendations) {
        expect(actualTemplateIds).toContain(rec.templateId)
      }

      console.log('✅ Template usage patterns accuracy verified')
    })

    test('should accurately reflect sample data from actual nodes', async () => {
      const db = testContext.database?.database.getConnection()

      // Get actual sample nodes
      const actualNodes = db
        .prepare(`
        SELECT id, title, content
        FROM nodes
        WHERE table_id = '${comprehensiveTableId}'
        ORDER BY created_at DESC, id ASC
        LIMIT 5
      `)
        .all()

      // Get AIMetadata sample data
      const query = `
        query SampleDataAccuracy {
          table(id: "${comprehensiveTableId}") {
            aiMetadata {
              sampleData {
                entries {
                  nodeId
                  title
                  content
                }
                totalCount
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)
      const sampleData = result.data.table.aiMetadata.sampleData

      // Verify sample entries match actual nodes
      const actualNodeIds = actualNodes.map((n) => String(n.id))
      const sampleNodeIds = sampleData.entries.map((e: any) => e.nodeId)

      for (const nodeId of sampleNodeIds) {
        expect(actualNodeIds).toContain(nodeId)
      }

      // Verify node details accuracy
      for (const entry of sampleData.entries) {
        const actualNode = actualNodes.find((n) => n.id === entry.nodeId)
        if (actualNode) {
          expect(entry.title).toBe(actualNode.title)
          expect(entry.content).toBe(actualNode.content)
        }
      }

      console.log('✅ Sample data accuracy verified against actual nodes')
    })
  })

  describe('User Experience and Information Quality', () => {
    test('should provide actionable template recommendations', async () => {
      const query = `
        query ActionableRecommendations {
          table(id: "${comprehensiveTableId}") {
            aiMetadata {
              usagePatterns {
                templateRecommendations {
                  templateId
                  useCase
                }
                commonQueries {
                  pattern
                  description
                  example
                }
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)
      const usagePatterns = result.data.table.aiMetadata.usagePatterns

      // Verify template recommendations are actionable
      for (const rec of usagePatterns.templateRecommendations) {
        // Use case should be descriptive and actionable
        expect(rec.useCase.length).toBeGreaterThan(10)
        expect(rec.useCase).toMatch(/[A-Z].*/) // Should start with capital letter
        expect(rec.templateId).toMatch(/^[a-z0-9\-_]+$/) // Should be valid identifier
      }

      // Verify common queries provide useful patterns
      for (const query of usagePatterns.commonQueries) {
        // Pattern should be SQL-like or GraphQL-like
        expect(query.pattern.length).toBeGreaterThan(5)

        // Description should be helpful
        expect(query.description.length).toBeGreaterThan(10)
        expect(query.description).toMatch(/[A-Z].*/) // Should start with capital letter

        // Example should be concrete
        expect(query.example.length).toBeGreaterThan(5)
        expect(query.example).not.toBe(query.pattern) // Should be different from pattern
      }

      console.log('✅ Template recommendations actionability validated')
    })

    test('should provide appropriate query complexity assessment', async () => {
      // Test with different table complexities
      const testCases = [
        {
          tableId: comprehensiveTableId,
          expectedComplexity: 'complex', // Many templates and attributes
          minTemplates: 10,
        },
      ]

      for (const testCase of testCases) {
        const query = `
          query ComplexityAssessment($tableId: ID!) {
            table(id: $tableId) {
              aiMetadata {
                usagePatterns {
                  queryComplexity
                  templateRecommendations {
                    templateId
                  }
                }
                schemaInfo {
                  dataTypes
                }
              }
            }
          }
        `

        const result = await testContext.graphqlRequest?.(query, {
          tableId: testCase.tableId,
        })

        const aiMetadata = result.data.table.aiMetadata

        // Verify complexity matches expectations based on data
        expect(aiMetadata.usagePatterns.queryComplexity).toBe(testCase.expectedComplexity)
        expect(aiMetadata.usagePatterns.templateRecommendations.length).toBeGreaterThanOrEqual(testCase.minTemplates)
        expect(Object.keys(aiMetadata.schemaInfo.dataTypes).length).toBeGreaterThan(5)
      }

      console.log('✅ Query complexity assessment accuracy validated')
    })

    test('should provide comprehensive relationship capabilities', async () => {
      const query = `
        query RelationshipCapabilities {
          table(id: "${comprehensiveTableId}") {
            aiMetadata {
              schemaInfo {
                relationshipCapabilities
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)
      const relationshipCapabilities = result.data.table.aiMetadata.schemaInfo.relationshipCapabilities

      // Verify relationship capabilities are informative
      expect(Array.isArray(relationshipCapabilities)).toBe(true)
      expect(relationshipCapabilities.length).toBeGreaterThan(0)

      // Should include common relationship types
      const expectedCapabilities = ['one-to-many', 'many-to-one', 'many-to-many', 'self-referential']
      const hasBasicCapabilities = expectedCapabilities.some((cap) =>
        relationshipCapabilities.some((rc: string) => rc.toLowerCase().includes(cap.split('-')[0])),
      )
      expect(hasBasicCapabilities).toBe(true)

      console.log('✅ Relationship capabilities comprehensiveness validated')
    })
  })

  describe('Cross-System Integration Quality', () => {
    test('should maintain consistency across multiple queries', async () => {
      // Query the same table multiple times and verify consistency
      const query = `
        query ConsistencyTest {
          table(id: "${comprehensiveTableId}") {
            aiMetadata {
              schemaInfo {
                dataTypes
                requiredFields
                searchableFields
              }
              usagePatterns {
                queryComplexity
              }
              sampleData {
                totalCount
              }
            }
          }
        }
      `

      // Execute multiple queries concurrently
      const results = await Promise.all([
        testContext.graphqlRequest?.(query),
        testContext.graphqlRequest?.(query),
        testContext.graphqlRequest?.(query),
      ])

      // Verify all results are identical
      const firstResult = results[0].data.table.aiMetadata
      for (let i = 1; i < results.length; i++) {
        const currentResult = results[i].data.table.aiMetadata

        // Deep comparison of key properties
        expect(currentResult.schemaInfo.dataTypes).toEqual(firstResult.schemaInfo.dataTypes)
        expect(currentResult.schemaInfo.requiredFields).toEqual(firstResult.schemaInfo.requiredFields)
        expect(currentResult.schemaInfo.searchableFields).toEqual(firstResult.schemaInfo.searchableFields)
        expect(currentResult.usagePatterns.queryComplexity).toBe(firstResult.usagePatterns.queryComplexity)
        expect(currentResult.sampleData.totalCount).toBe(firstResult.sampleData.totalCount)
      }

      console.log('✅ Cross-query consistency validated')
    })

    test('should integrate well with table documentation flow', async () => {
      const query = `
        query IntegratedDocumentationFlow {
          table(id: "${comprehensiveTableId}") {
            id
            identifier
            name
            description
            createdAt
            updatedAt
            nodeCount
            attributeCount
            attributes {
              id
              identifier
              name
              attributeType {
                dataType
              }
              required
              searchable
            }
            aiMetadata {
              schemaInfo {
                dataTypes
                requiredFields
                searchableFields
              }
              usagePatterns {
                templateRecommendations {
                  templateId
                  useCase
                }
              }
              sampleData {
                entries {
                  nodeId
                  title
                  attributes
                }
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)
      const table = result.data.table

      // Verify integration between table data and AIMetadata
      expect(table.attributes.length).toBe(Object.keys(table.aiMetadata.schemaInfo.dataTypes).length)

      // Verify attribute consistency
      for (const attr of table.attributes) {
        expect(table.aiMetadata.schemaInfo.dataTypes).toHaveProperty(attr.identifier)
        expect(typeof table.aiMetadata.schemaInfo.dataTypes[attr.identifier]).toBe('string')

        if (attr.required) {
          expect(table.aiMetadata.schemaInfo.requiredFields).toContain(attr.identifier)
        }

        if (attr.searchable) {
          expect(table.aiMetadata.schemaInfo.searchableFields).toContain(attr.identifier)
        }
      }

      console.log('✅ Integrated documentation flow validated')
    })

    test('should provide complete documentation for AI systems', async () => {
      const query = `
        query AISystemDocumentation {
          table(id: "${comprehensiveTableId}") {
            # Basic table info for context
            identifier
            name
            description

            # Complete attribute information
            attributes {
              identifier
              name
              attributeType {
                dataType
              }
              required
              searchable
              description
            }

            # AI-optimized metadata
            aiMetadata {
              schemaInfo {
                dataTypes
                requiredFields
                searchableFields
                relationshipCapabilities
              }
              usagePatterns {
                commonQueries {
                  pattern
                  description
                  example
                }
                templateRecommendations {
                  templateId
                  useCase
                }
                queryComplexity
              }
              sampleData {
                entries {
                  nodeId
                  title
                  content
                  attributes
                }
                totalCount
                hasMore
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)
      const table = result.data.table

      // Comprehensive validation for AI system consumption

      // 1. Basic context information
      expect(table.identifier).toBeTruthy()
      expect(table.name).toBeTruthy()
      expect(table.description).toBeTruthy()

      // 2. Complete attribute schema
      expect(Array.isArray(table.attributes)).toBe(true)
      expect(table.attributes.length).toBeGreaterThan(10)

      // 3. AI-friendly schema information
      const schemaInfo = table.aiMetadata.schemaInfo
      expect(Object.keys(schemaInfo.dataTypes).length).toBe(table.attributes.length)
      expect(schemaInfo.requiredFields.length).toBeGreaterThan(0)
      expect(schemaInfo.searchableFields.length).toBeGreaterThan(0)
      expect(schemaInfo.relationshipCapabilities.length).toBeGreaterThan(0)

      // 4. Usage patterns for AI guidance
      const usagePatterns = table.aiMetadata.usagePatterns
      expect(usagePatterns.commonQueries.length).toBeGreaterThan(0)
      expect(usagePatterns.templateRecommendations.length).toBeGreaterThan(0)
      expect(['simple', 'moderate', 'complex']).toContain(usagePatterns.queryComplexity)

      // 5. Representative sample data
      const sampleData = table.aiMetadata.sampleData
      expect(sampleData.entries.length).toBeGreaterThan(0)
      expect(sampleData.totalCount).toBeGreaterThan(0)

      // 6. All data should be non-null and properly formatted
      for (const query of usagePatterns.commonQueries) {
        expect(query.pattern).toBeTruthy()
        expect(query.description).toBeTruthy()
        expect(query.example).toBeTruthy()
      }

      for (const entry of sampleData.entries) {
        expect(entry.nodeId).toBeTruthy()
        expect(entry.title).toBeTruthy()
        expect(typeof entry.attributes).toBe('object')
      }

      console.log('✅ Complete AI system documentation validated')
      console.log(`📊 Schema fields: ${Object.keys(schemaInfo.dataTypes).length}`)
      console.log(`🔍 Required fields: ${schemaInfo.requiredFields.length}`)
      console.log(`🔍 Searchable fields: ${schemaInfo.searchableFields.length}`)
      console.log(`📚 Common queries: ${usagePatterns.commonQueries.length}`)
      console.log(`🛠️ Template recommendations: ${usagePatterns.templateRecommendations.length}`)
      console.log(`📝 Sample entries: ${sampleData.entries.length}`)
    })
  })
})
