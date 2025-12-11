/**
 * Sample Node Creation Templates
 *
 * This file contains example GraphQL mutation templates for creating nodes
 * in different domains with specific attributes.
 */

export const sampleNodeCreationTemplates = [
  {
    identifier: 'create-user-profile',
    name: 'Create User Profile',
    description: 'Template for creating user profile nodes with personal information',
    queryText: `
      mutation CreateUserProfile(
        $tableId: ID!
        $email: String!
        $firstName: String!
        $lastName: String!
        $age: Int
        $city: String
      ) {
        createNode(input: {
          tableId: $tableId
          content: $email
          title: $firstName + " " + $lastName
          description: "User profile for " + $email
        }) {
          id
          content
          title
          description
          createdAt
          updatedAt
        }
      }
    `,
    variablesSchema: {
      type: 'object',
      properties: {
        tableId: { type: 'string', description: 'Target table ID for users' },
        email: { type: 'string', format: 'email', description: 'User email address' },
        firstName: { type: 'string', description: 'User first name' },
        lastName: { type: 'string', description: 'User last name' },
        age: { type: 'integer', minimum: 13, maximum: 120, description: 'User age' },
        city: { type: 'string', description: 'User city' },
      },
      required: ['tableId', 'email', 'firstName', 'lastName'],
    },
    defaultVariables: {
      city: 'Seoul',
    },
    applicableTables: null, // Universal template
    templateType: 'mutation',
    complexityScore: 2,
    tags: ['node-creation', 'user-management', 'profile', 'personal-data'],
  },

  {
    identifier: 'create-product-inventory',
    name: 'Create Product Inventory',
    description: 'Template for creating product nodes with inventory and pricing information',
    queryText: `
      mutation CreateProductInventory(
        $tableId: ID!
        $productName: String!
        $sku: String!
        $price: Float!
        $stockQuantity: Int!
        $category: String!
        $supplier: String
        $description: String
      ) {
        createNode(input: {
          tableId: $tableId
          content: $productName
          title: $productName + " (" + $sku + ")"
          description: $description || ("Product: " + $productName)
        }) {
          id
          content
          title
          description
          createdAt
          
          # This would need to be handled differently in real implementation
          # as we need the node ID first
          attributes {
            id
            value
            attribute {
              identifier
            }
          }
        }
      }
    `,
    variablesSchema: {
      type: 'object',
      properties: {
        tableId: { type: 'string', description: 'Target table ID for products' },
        productName: { type: 'string', minLength: 1, description: 'Product name' },
        sku: { type: 'string', pattern: '^[A-Z0-9-]+$', description: 'Stock Keeping Unit' },
        price: { type: 'number', minimum: 0, description: 'Product price' },
        stockQuantity: { type: 'integer', minimum: 0, description: 'Stock quantity' },
        category: { type: 'string', description: 'Product category' },
        supplier: { type: 'string', description: 'Supplier name' },
        description: { type: 'string', description: 'Product description' },
      },
      required: ['tableId', 'productName', 'sku', 'price', 'stockQuantity', 'category'],
    },
    defaultVariables: {
      supplier: 'Default Supplier',
      stockQuantity: 0,
    },
    applicableTables: ['products', 'inventory', 'catalog'],
    templateType: 'mutation',
    complexityScore: 4,
    tags: ['node-creation', 'products', 'inventory', 'ecommerce', 'pricing'],
  },

  {
    identifier: 'create-project-task',
    name: 'Create Project Task',
    description: 'Template for creating task nodes in project management systems',
    queryText: `
      mutation CreateProjectTask(
        $tableId: ID!
        $taskTitle: String!
        $taskDescription: String!
        $priority: String!
        $assigneeEmail: String
        $dueDate: String
        $estimatedHours: Float
        $projectId: ID
      ) {
        createNode(input: {
          tableId: $tableId
          content: $taskTitle
          title: $taskTitle
          description: $taskDescription
        }) {
          id
          content
          title
          description
          createdAt
          updatedAt
          
          # Attributes would be set in follow-up mutations
          table {
            id
            identifier
          }
        }
      }
    `,
    variablesSchema: {
      type: 'object',
      properties: {
        tableId: { type: 'string', description: 'Target table ID for tasks' },
        taskTitle: { type: 'string', minLength: 3, description: 'Task title' },
        taskDescription: { type: 'string', description: 'Detailed task description' },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Task priority level',
        },
        assigneeEmail: { type: 'string', format: 'email', description: 'Assigned user email' },
        dueDate: { type: 'string', format: 'date', description: 'Due date (YYYY-MM-DD)' },
        estimatedHours: { type: 'number', minimum: 0, description: 'Estimated hours to complete' },
        projectId: { type: 'string', description: 'Related project ID' },
      },
      required: ['tableId', 'taskTitle', 'taskDescription', 'priority'],
    },
    defaultVariables: {
      priority: 'medium',
      estimatedHours: 4.0,
    },
    applicableTables: ['tasks', 'project-tasks', 'work-items'],
    templateType: 'mutation',
    complexityScore: 3,
    tags: ['node-creation', 'project-management', 'tasks', 'workflow'],
  },

  {
    identifier: 'create-customer-order',
    name: 'Create Customer Order',
    description: 'Template for creating order nodes with customer and billing information',
    queryText: `
      mutation CreateCustomerOrder(
        $tableId: ID!
        $customerEmail: String!
        $orderTotal: Float!
        $currency: String!
        $billingAddress: String!
        $shippingAddress: String
        $paymentMethod: String!
        $orderNotes: String
      ) {
        createNode(input: {
          tableId: $tableId
          content: "Order for " + $customerEmail
          title: "Order #" + generateOrderNumber()
          description: $orderNotes || ("Order for customer: " + $customerEmail)
        }) {
          id
          content
          title
          description
          createdAt
          
          # Node count and table information
          table {
            id
            identifier
            nodeCount
          }
        }
      }
    `,
    variablesSchema: {
      type: 'object',
      properties: {
        tableId: { type: 'string', description: 'Target table ID for orders' },
        customerEmail: { type: 'string', format: 'email', description: 'Customer email address' },
        orderTotal: { type: 'number', minimum: 0, description: 'Total order amount' },
        currency: {
          type: 'string',
          pattern: '^[A-Z]{3}$',
          description: 'Currency code (e.g., USD, EUR)',
        },
        billingAddress: { type: 'string', minLength: 10, description: 'Billing address' },
        shippingAddress: { type: 'string', description: 'Shipping address (defaults to billing)' },
        paymentMethod: {
          type: 'string',
          enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'cash'],
          description: 'Payment method',
        },
        orderNotes: { type: 'string', description: 'Additional order notes' },
      },
      required: ['tableId', 'customerEmail', 'orderTotal', 'currency', 'billingAddress', 'paymentMethod'],
    },
    defaultVariables: {
      currency: 'USD',
      paymentMethod: 'credit_card',
    },
    applicableTables: ['orders', 'customer-orders', 'sales'],
    templateType: 'mutation',
    complexityScore: 5,
    tags: ['node-creation', 'orders', 'ecommerce', 'customers', 'billing'],
  },

  {
    identifier: 'create-event-registration',
    name: 'Create Event Registration',
    description: 'Template for creating event registration nodes with participant details',
    queryText: `
      mutation CreateEventRegistration(
        $tableId: ID!
        $eventId: ID!
        $participantEmail: String!
        $participantName: String!
        $registrationDate: String!
        $ticketType: String!
        $specialRequirements: String
        $emergencyContact: String
      ) {
        createNode(input: {
          tableId: $tableId
          content: $participantName + " - " + $eventId
          title: "Registration: " + $participantName
          description: "Event registration for " + $participantEmail
        }) {
          id
          content
          title
          description
          createdAt
          
          # Attribution count for the participant
          attributeCount
        }
      }
    `,
    variablesSchema: {
      type: 'object',
      properties: {
        tableId: { type: 'string', description: 'Target table ID for registrations' },
        eventId: { type: 'string', description: 'Event identifier' },
        participantEmail: { type: 'string', format: 'email', description: 'Participant email' },
        participantName: { type: 'string', minLength: 2, description: 'Participant full name' },
        registrationDate: {
          type: 'string',
          format: 'date-time',
          description: 'Registration timestamp',
        },
        ticketType: {
          type: 'string',
          enum: ['general', 'vip', 'student', 'early_bird', 'group'],
          description: 'Ticket type',
        },
        specialRequirements: {
          type: 'string',
          description: 'Special requirements or dietary restrictions',
        },
        emergencyContact: { type: 'string', description: 'Emergency contact information' },
      },
      required: ['tableId', 'eventId', 'participantEmail', 'participantName', 'registrationDate', 'ticketType'],
    },
    defaultVariables: {
      ticketType: 'general',
      registrationDate: new Date().toISOString(),
    },
    applicableTables: ['event-registrations', 'participants', 'attendees'],
    templateType: 'mutation',
    complexityScore: 3,
    tags: ['node-creation', 'events', 'registrations', 'participants'],
  },

  {
    identifier: 'create-article-post',
    name: 'Create Article Post',
    description: 'Template for creating article/blog post nodes with content and metadata',
    queryText: `
      mutation CreateArticlePost(
        $tableId: ID!
        $title: String!
        $content: String!
        $authorEmail: String!
        $category: String!
        $tags: [String!]!
        $publishDate: String
        $featuredImage: String
        $excerpt: String
      ) {
        createNode(input: {
          tableId: $tableId
          content: $title
          title: $title
          description: $excerpt || ($content.substring(0, 200) + "...")
        }) {
          id
          content
          title
          description
          createdAt
          updatedAt
          
          table {
            identifier
            description
          }
        }
      }
    `,
    variablesSchema: {
      type: 'object',
      properties: {
        tableId: { type: 'string', description: 'Target table ID for articles' },
        title: { type: 'string', minLength: 5, maxLength: 200, description: 'Article title' },
        content: { type: 'string', minLength: 50, description: 'Article content body' },
        authorEmail: { type: 'string', format: 'email', description: 'Author email address' },
        category: {
          type: 'string',
          enum: ['technology', 'business', 'lifestyle', 'news', 'tutorial', 'opinion'],
          description: 'Article category',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 10,
          description: 'Article tags',
        },
        publishDate: { type: 'string', format: 'date-time', description: 'Publication date' },
        featuredImage: { type: 'string', format: 'uri', description: 'Featured image URL' },
        excerpt: { type: 'string', maxLength: 500, description: 'Article excerpt/summary' },
      },
      required: ['tableId', 'title', 'content', 'authorEmail', 'category', 'tags'],
    },
    defaultVariables: {
      category: 'general',
      publishDate: new Date().toISOString(),
      tags: ['general'],
    },
    applicableTables: ['articles', 'blog-posts', 'content'],
    templateType: 'mutation',
    complexityScore: 4,
    tags: ['node-creation', 'content', 'articles', 'blogging', 'publishing'],
  },
]

/**
 * Utility function to create all sample templates in the database
 */
export async function createSampleTemplates(graphqlEndpoint: string): Promise<void> {
  for (const template of sampleNodeCreationTemplates) {
    try {
      const response = await fetch(graphqlEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation CreateTemplate($input: CreateTemplateInput!) {
              createTemplate(input: $input) {
                id
                identifier
                name
              }
            }
          `,
          variables: { input: template },
        }),
      })

      const data = await response.json()
      if (data.errors) {
        console.error(`Failed to create template ${template.identifier}:`, data.errors)
      } else {
        console.log(`✅ Created template: ${template.name}`)
      }
    } catch (error) {
      console.error(`Error creating template ${template.identifier}:`, error)
    }
  }
}

/**
 * Example usage patterns for different templates
 */
export const usageExamples = {
  'create-user-profile': {
    variables: {
      tableId: 'users-table-id',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      age: 30,
      city: 'New York',
    },
  },

  'create-product-inventory': {
    variables: {
      tableId: 'products-table-id',
      productName: 'Wireless Bluetooth Headphones',
      sku: 'WBH-001',
      price: 299.99,
      stockQuantity: 50,
      category: 'Electronics',
      supplier: 'Tech Supplier Co.',
      description: 'High-quality wireless headphones with noise cancellation',
    },
  },

  'create-project-task': {
    variables: {
      tableId: 'tasks-table-id',
      taskTitle: 'Implement User Authentication',
      taskDescription: 'Add JWT-based authentication system with login/logout functionality',
      priority: 'high',
      assigneeEmail: 'developer@company.com',
      dueDate: '2025-09-15',
      estimatedHours: 16.0,
      projectId: 'project-123',
    },
  },

  'create-customer-order': {
    variables: {
      tableId: 'orders-table-id',
      customerEmail: 'customer@example.com',
      orderTotal: 149.99,
      currency: 'USD',
      billingAddress: '123 Main St, Anytown, ST 12345',
      shippingAddress: '456 Oak Ave, Somewhere, ST 67890',
      paymentMethod: 'credit_card',
      orderNotes: 'Please deliver after 3 PM',
    },
  },

  'create-event-registration': {
    variables: {
      tableId: 'registrations-table-id',
      eventId: 'tech-conference-2025',
      participantEmail: 'attendee@example.com',
      participantName: 'Jane Smith',
      registrationDate: new Date().toISOString(),
      ticketType: 'early_bird',
      specialRequirements: 'Vegetarian meals',
      emergencyContact: 'Emergency Contact: +1-555-0123',
    },
  },

  'create-article-post': {
    variables: {
      tableId: 'articles-table-id',
      title: 'Getting Started with GraphQL Templates',
      content: 'GraphQL templates provide a powerful way to reuse common mutation patterns...',
      authorEmail: 'author@blog.com',
      category: 'tutorial',
      tags: ['graphql', 'templates', 'tutorial', 'development'],
      publishDate: new Date().toISOString(),
      featuredImage: 'https://example.com/images/graphql-tutorial.jpg',
      excerpt: 'Learn how to use GraphQL templates for efficient node creation',
    },
  },
}
