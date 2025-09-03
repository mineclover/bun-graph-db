import type { CreateUserInput, UpdateUserInput, User } from '../types/index.js'

// Mock database for demonstration
const users: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    createdAt: new Date().toISOString(),
  },
]

export const resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL!',
    users: () => users,
    user: (_: unknown, { id }: { id: string }) => {
      return users.find((user) => user.id === id) || null
    },
  },

  Mutation: {
    createUser: (_: unknown, { name, email }: CreateUserInput) => {
      const newUser: User = {
        id: (users.length + 1).toString(),
        name,
        email,
        createdAt: new Date().toISOString(),
      }
      users.push(newUser)
      return newUser
    },

    updateUser: (_: unknown, { id, name, email }: UpdateUserInput) => {
      const userIndex = users.findIndex((user) => user.id === id)
      if (userIndex === -1) return null

      if (name) users[userIndex]!.name = name
      if (email) users[userIndex]!.email = email

      return users[userIndex]
    },

    deleteUser: (_: unknown, { id }: { id: string }) => {
      const userIndex = users.findIndex((user) => user.id === id)
      if (userIndex === -1) return false

      users.splice(userIndex, 1)
      return true
    },
  },

  Subscription: {
    userCreated: {
      // This would typically be implemented with a pub/sub system
      subscribe: () => {
        // Mock subscription - in real app, use PubSub
        console.log('User subscription created')
        return {
          [Symbol.asyncIterator]() {
            return this
          },
          async next() {
            return { value: users[0], done: false }
          },
        }
      },
    },
  },
}
