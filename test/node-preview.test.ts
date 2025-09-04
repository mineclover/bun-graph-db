import { describe, expect, test, beforeAll, afterAll } from '@jest/globals'
import { graphqlRequest } from './graphql-integration.test.js'

/**
 * Node Creation Preview Tests
 * Tests the previewNodeCreation functionality for domain-driven schema inference
 */

describe('Node Creation Preview Tests', () => {
  let ecommerceTableId: string
  let projectTableId: string

  beforeAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    await setupDomainTestTables()
  })

  async function setupDomainTestTables() {
    const timestamp = Date.now()
    
    // Create e-commerce test table
    const ecommerceResult = await graphqlRequest(`
      mutation CreateEcommerceTable($input: CreateTableInput!) {
        createTable(input: $input) {
          table {
            id
            identifier
          }
          errors { message }
        }
      }
    `, {
      input: {
        identifier: `ecommerce-preview-${timestamp}`,
        description: 'E-commerce table for node preview testing'
      }
    })
    
    ecommerceTableId = ecommerceResult.data.createTable.table.id

    // Create project management test table
    const projectResult = await graphqlRequest(`
      mutation CreateProjectTable($input: CreateTableInput!) {
        createTable(input: $input) {
          table {
            id
            identifier
          }
          errors { message }
        }
      }
    `, {
      input: {
        identifier: `project-preview-${timestamp}`,
        description: 'Project management table for node preview testing'
      }
    })
    
    projectTableId = projectResult.data.createTable.table.id

    // Add some test attributes for context
    await Promise.all([
      // E-commerce attributes
      graphqlRequest(`
        mutation CreatePriceAttribute($input: CreateAttributeInput!) {
          createAttribute(input: $input) {
            attribute { id }
            errors { message }
          }
        }
      `, {
        input: {
          tableId: ecommerceTableId,
          identifier: "price",
          attributeTypeId: "4", // number
          description: "Product price",
          isRequired: true
        }
      }),
      
      graphqlRequest(`
        mutation CreateCategoryAttribute($input: CreateAttributeInput!) {
          createAttribute(input: $input) {
            attribute { id }
            errors { message }
          }
        }
      `, {
        input: {
          tableId: ecommerceTableId,
          identifier: "category",
          attributeTypeId: "1", // string
          description: "Product category",
          isRequired: true
        }
      }),

      // Project management attributes
      graphqlRequest(`
        mutation CreateStatusAttribute($input: CreateAttributeInput!) {
          createAttribute(input: $input) {
            attribute { id }
            errors { message }
          }
        }
      `, {
        input: {
          tableId: projectTableId,
          identifier: "status",
          attributeTypeId: "1", // string
          description: "Task status",
          isRequired: true
        }
      }),

      graphqlRequest(`
        mutation CreatePriorityAttribute($input: CreateAttributeInput!) {
          createAttribute(input: $input) {
            attribute { id }
            errors { message }
          }
        }
      `, {
        input: {
          tableId: projectTableId,
          identifier: "priority",
          attributeTypeId: "1", // string
          description: "Task priority",
          isRequired: false
        }
      })
    ])

    // Create some existing nodes for similarity detection
    await Promise.all([
      graphqlRequest(`
        mutation CreateSimilarProduct($input: CreateNodeInput!) {
          createNode(input: $input) {
            node { id }
            errors { message }
          }
        }
      `, {
        input: {
          tableId: ecommerceTableId,
          content: "iPhone 14 Pro",
          title: "Apple iPhone 14 Pro"
        }
      }),

      graphqlRequest(`
        mutation CreateSimilarTask($input: CreateNodeInput!) {
          createNode(input: $input) {
            node { id }
            errors { message }
          }
        }
      `, {
        input: {
          tableId: projectTableId,
          content: "Implement user authentication",
          title: "Auth Implementation"
        }
      })
    ])
  }

  describe('1. Basic Node Preview', () => {
    test('should preview e-commerce product creation', async () => {
      const result = await graphqlRequest(`
        query PreviewEcommerceProduct($input: PreviewNodeInput!) {
          previewNodeCreation(input: $input) {
            suggestedNode {
              content
              title
              description
              confidence
              suggestedAttributes {
                attributeName
                attributeType
                suggestedValue
                confidence
                reasoning
                isRequired
              }
              potentialRelations {
                targetNodeContent
                relationTypeName
                direction
                strength
                confidence
                reasoning
              }
              appliedPatterns
              reasoning
            }
            similarNodes {
              id
              content
              title
            }
            conflicts {
              type
              severity
              message
              suggestedAction
            }
            validation {
              isValid
              errors {
                field
                message
                code
              }
              warnings {
                field
                message
                suggestion
              }
              recommendations
            }
          }
        }
      `, {
        input: {
          tableId: ecommerceTableId,
          content: "iPhone 15 Pro Max 256GB Space Black",
          domain: "ecommerce",
          title: "Apple iPhone 15 Pro Max",
          hints: ["smartphone", "premium", "Apple", "latest"],
          context: {
            category: "electronics",
            brand: "Apple",
            priceRange: "high"
          }
        }
      })

      expect(result.data.previewNodeCreation).toBeTruthy()
      
      const suggestion = result.data.previewNodeCreation.suggestedNode
      expect(suggestion.content).toContain('iPhone 15 Pro Max')
      expect(suggestion.confidence).toBeGreaterThan(0.5)
      expect(suggestion.suggestedAttributes).toBeInstanceOf(Array)
      expect(suggestion.appliedPatterns).toBeInstanceOf(Array)
      expect(suggestion.reasoning).toBeTruthy()

      // Check for similar node detection
      expect(result.data.previewNodeCreation.similarNodes).toBeInstanceOf(Array)
      const hasSimilariPhone = result.data.previewNodeCreation.similarNodes.some(
        (node: any) => node.content.includes('iPhone')
      )
      expect(hasSimilariPhone).toBe(true)

      // Validation should pass for valid e-commerce product
      expect(result.data.previewNodeCreation.validation.isValid).toBe(true)
      expect(result.data.previewNodeCreation.validation.errors).toHaveLength(0)

      console.log('✅ E-commerce preview analysis:')
      console.log(`   Confidence: ${suggestion.confidence}`)
      console.log(`   Applied patterns: ${suggestion.appliedPatterns.join(', ')}`)
      console.log(`   Suggested attributes: ${suggestion.suggestedAttributes.length}`)
    })

    test('should preview project management task creation', async () => {
      const result = await graphqlRequest(`
        query PreviewProjectTask($input: PreviewNodeInput!) {
          previewNodeCreation(input: $input) {
            suggestedNode {
              content
              title
              confidence
              suggestedAttributes {
                attributeName
                suggestedValue
                isRequired
              }
              potentialRelations {
                relationTypeName
                direction
                reasoning
              }
            }
            domainSuggestions {
              domain
              commonPatterns {
                patternName
                description
                confidence
              }
              recommendedStructure
              validationRules
            }
            validation {
              isValid
              recommendations
            }
          }
        }
      `, {
        input: {
          tableId: projectTableId,
          content: "Implement OAuth2 authentication system",
          domain: "project_management",
          title: "OAuth2 Implementation",
          hints: ["authentication", "security", "backend", "high-priority"],
          context: {
            projectType: "web_application",
            complexity: "high",
            timeline: "2_weeks"
          }
        }
      })

      expect(result.data.previewNodeCreation).toBeTruthy()
      
      const suggestion = result.data.previewNodeCreation.suggestedNode
      expect(suggestion.content).toContain('OAuth2')
      expect(suggestion.confidence).toBeGreaterThan(0.6)
      expect(suggestion.suggestedAttributes).toBeInstanceOf(Array)
      
      // Should suggest status and priority attributes
      const attributeNames = suggestion.suggestedAttributes.map((attr: any) => attr.attributeName)
      expect(attributeNames).toContain('status')
      
      // Domain suggestions should be provided
      const domainSuggestions = result.data.previewNodeCreation.domainSuggestions
      expect(domainSuggestions.domain).toBe('project_management')
      expect(domainSuggestions.commonPatterns).toBeInstanceOf(Array)
      expect(domainSuggestions.validationRules).toBeInstanceOf(Array)

      console.log('✅ Project management preview analysis:')
      console.log(`   Domain patterns: ${domainSuggestions.commonPatterns.length}`)
      console.log(`   Validation rules: ${domainSuggestions.validationRules.length}`)
    })
  })

  describe('2. Conflict Detection', () => {
    test('should detect duplicate content conflicts', async () => {
      const result = await graphqlRequest(`
        query PreviewDuplicateContent($input: PreviewNodeInput!) {
          previewNodeCreation(input: $input) {
            conflicts {
              type
              severity
              message
              suggestedAction
            }
            validation {
              isValid
              errors {
                field
                message
              }
            }
          }
        }
      `, {
        input: {
          tableId: ecommerceTableId,
          content: "iPhone 14 Pro", // Exact duplicate of existing node
          domain: "ecommerce"
        }
      })

      expect(result.data.previewNodeCreation.conflicts).toBeInstanceOf(Array)
      
      const duplicateConflict = result.data.previewNodeCreation.conflicts.find(
        (conflict: any) => conflict.type === 'DUPLICATE_CONTENT'
      )
      expect(duplicateConflict).toBeTruthy()
      expect(duplicateConflict.severity).toBe('ERROR')
      expect(duplicateConflict.suggestedAction).toBeTruthy()

      // Validation should fail due to duplicate
      expect(result.data.previewNodeCreation.validation.isValid).toBe(false)
      expect(result.data.previewNodeCreation.validation.errors.length).toBeGreaterThan(0)
    })

    test('should detect similar content warnings', async () => {
      const result = await graphqlRequest(`
        query PreviewSimilarContent($input: PreviewNodeInput!) {
          previewNodeCreation(input: $input) {
            conflicts {
              type
              severity
              message
            }
            similarNodes {
              content
              title
            }
          }
        }
      `, {
        input: {
          tableId: ecommerceTableId,
          content: "iPhone 14 Pro Max", // Similar to existing "iPhone 14 Pro"
          domain: "ecommerce"
        }
      })

      const similarConflict = result.data.previewNodeCreation.conflicts.find(
        (conflict: any) => conflict.type === 'SIMILAR_CONTENT'
      )
      expect(similarConflict).toBeTruthy()
      expect(similarConflict.severity).toBe('WARNING')

      // Should find similar nodes
      expect(result.data.previewNodeCreation.similarNodes.length).toBeGreaterThan(0)
    })
  })

  describe('3. Domain Pattern Matching', () => {
    test('should apply e-commerce domain patterns', async () => {
      const result = await graphqlRequest(`
        query PreviewEcommerceDomainPatterns($input: PreviewNodeInput!) {
          previewNodeCreation(input: $input) {
            suggestedNode {
              appliedPatterns
              suggestedAttributes {
                attributeName
                attributeType
                isRequired
              }
            }
            domainSuggestions {
              domain
              commonPatterns {
                patternName
                confidence
                attributes
                relations
              }
            }
          }
        }
      `, {
        input: {
          tableId: ecommerceTableId,
          content: "Samsung Galaxy S24 Ultra",
          domain: "ecommerce",
          context: {
            category: "electronics",
            subcategory: "smartphones",
            brand: "Samsung"
          }
        }
      })

      const domainSuggestions = result.data.previewNodeCreation.domainSuggestions
      expect(domainSuggestions.commonPatterns).toBeInstanceOf(Array)
      
      // Should find e-commerce specific patterns
      const patternNames = domainSuggestions.commonPatterns.map(
        (pattern: any) => pattern.patternName
      )
      expect(patternNames.some((name: string) => 
        name.includes('product') || name.includes('electronics')
      )).toBe(true)

      // Should suggest price and category attributes
      const suggestedAttributes = result.data.previewNodeCreation.suggestedNode.suggestedAttributes
      const attributeNames = suggestedAttributes.map((attr: any) => attr.attributeName)
      expect(attributeNames).toContain('price')
      expect(attributeNames).toContain('category')
    })

    test('should apply project management domain patterns', async () => {
      const result = await graphqlRequest(`
        query PreviewProjectDomainPatterns($input: PreviewNodeInput!) {
          previewNodeCreation(input: $input) {
            domainSuggestions {
              commonPatterns {
                patternName
                description
                attributes
                relations
              }
              recommendedStructure
            }
            suggestedNode {
              potentialRelations {
                relationTypeName
                direction
                reasoning
              }
            }
          }
        }
      `, {
        input: {
          tableId: projectTableId,
          content: "Database schema design",
          domain: "project_management",
          context: {
            projectPhase: "design",
            complexity: "medium",
            team: "backend"
          }
        }
      })

      const patterns = result.data.previewNodeCreation.domainSuggestions.commonPatterns
      expect(patterns).toBeInstanceOf(Array)
      
      // Should find project management patterns
      const hasProjectPattern = patterns.some((pattern: any) => 
        pattern.patternName.includes('task') || 
        pattern.patternName.includes('project') ||
        pattern.patternName.includes('dependency')
      )
      expect(hasProjectPattern).toBe(true)

      // Should suggest relationships
      const relations = result.data.previewNodeCreation.suggestedNode.potentialRelations
      expect(relations).toBeInstanceOf(Array)
      
      // Common project relations
      const relationTypes = relations.map((rel: any) => rel.relationTypeName)
      expect(relationTypes.some((type: string) => 
        type.includes('depends_on') || 
        type.includes('blocks') ||
        type.includes('related_to')
      )).toBe(true)
    })
  })

  describe('4. Validation and Recommendations', () => {
    test('should provide comprehensive validation', async () => {
      const result = await graphqlRequest(`
        query PreviewValidation($input: PreviewNodeInput!) {
          previewNodeCreation(input: $input) {
            validation {
              isValid
              errors {
                field
                message
                code
              }
              warnings {
                field
                message
                suggestion
              }
              recommendations
            }
          }
        }
      `, {
        input: {
          tableId: ecommerceTableId,
          content: "", // Invalid: empty content
          domain: "ecommerce"
        }
      })

      const validation = result.data.previewNodeCreation.validation
      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
      
      // Should have content validation error
      const contentError = validation.errors.find(
        (error: any) => error.field === 'content'
      )
      expect(contentError).toBeTruthy()
      expect(contentError.code).toBe('REQUIRED_FIELD')
    })

    test('should provide helpful recommendations', async () => {
      const result = await graphqlRequest(`
        query PreviewRecommendations($input: PreviewNodeInput!) {
          previewNodeCreation(input: $input) {
            validation {
              recommendations
            }
            suggestedNode {
              reasoning
            }
          }
        }
      `, {
        input: {
          tableId: projectTableId,
          content: "Fix bug",
          domain: "project_management",
          hints: ["urgent"]
        }
      })

      const recommendations = result.data.previewNodeCreation.validation.recommendations
      expect(recommendations).toBeInstanceOf(Array)
      expect(recommendations.length).toBeGreaterThan(0)
      
      // Should recommend more specific content
      const hasContentRecommendation = recommendations.some((rec: string) => 
        rec.includes('specific') || rec.includes('detail')
      )
      expect(hasContentRecommendation).toBe(true)

      // Should provide reasoning
      expect(result.data.previewNodeCreation.suggestedNode.reasoning).toBeTruthy()
    })
  })

  describe('5. Performance and Edge Cases', () => {
    test('should handle complex preview requests efficiently', async () => {
      const startTime = Date.now()
      
      const result = await graphqlRequest(`
        query PreviewPerformanceTest($input: PreviewNodeInput!) {
          previewNodeCreation(input: $input) {
            suggestedNode {
              confidence
              appliedPatterns
            }
            similarNodes {
              id
            }
            validation {
              isValid
            }
          }
        }
      `, {
        input: {
          tableId: ecommerceTableId,
          content: "MacBook Pro 16-inch M3 Max 64GB RAM 2TB SSD Space Black",
          domain: "ecommerce",
          title: "Apple MacBook Pro 16-inch",
          hints: ["laptop", "professional", "high-performance", "Apple", "M3", "premium"],
          context: {
            category: "computers",
            subcategory: "laptops", 
            brand: "Apple",
            priceRange: "premium",
            targetAudience: "professionals",
            features: ["M3 Max", "64GB RAM", "2TB SSD"]
          }
        }
      })

      const executionTime = Date.now() - startTime
      
      expect(result.data.previewNodeCreation).toBeTruthy()
      expect(executionTime).toBeLessThan(3000) // Should complete within 3 seconds
      
      console.log(`✅ Complex preview completed in ${executionTime}ms`)
      console.log(`   Confidence: ${result.data.previewNodeCreation.suggestedNode.confidence}`)
    })

    test('should handle unknown domains gracefully', async () => {
      const result = await graphqlRequest(`
        query PreviewUnknownDomain($input: PreviewNodeInput!) {
          previewNodeCreation(input: $input) {
            domainSuggestions {
              domain
              commonPatterns {
                patternName
              }
            }
            validation {
              isValid
              warnings {
                message
              }
            }
          }
        }
      `, {
        input: {
          tableId: ecommerceTableId,
          content: "Random content",
          domain: "unknown_domain_12345"
        }
      })

      expect(result.data.previewNodeCreation).toBeTruthy()
      
      // Should still be valid but with warnings
      expect(result.data.previewNodeCreation.validation.isValid).toBe(true)
      expect(result.data.previewNodeCreation.validation.warnings.length).toBeGreaterThan(0)
      
      // Should provide fallback patterns
      expect(result.data.previewNodeCreation.domainSuggestions.commonPatterns).toBeInstanceOf(Array)
    })
  })
})