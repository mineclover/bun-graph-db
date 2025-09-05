// Simple resolvers for legacy schema compatibility
export const resolvers = {
  Query: {
    hello: () => 'Hello GraphQL!',
    users: () => [],
    user: () => null,
  },
  Mutation: {
    createUser: () => null,
    updateUser: () => null,
    deleteUser: () => false,
  },
  Subscription: {
    userCreated: () => null,
  },
}