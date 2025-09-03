import { makeExecutableSchema } from '@graphql-tools/schema'
import type { GraphQLSchema } from 'graphql'
import { resolvers } from '../resolvers/index.js'

const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
    createdAt: String!
  }

  type Query {
    hello: String!
    users: [User!]!
    user(id: ID!): User
  }

  type Mutation {
    createUser(name: String!, email: String!): User!
    updateUser(id: ID!, name: String, email: String): User
    deleteUser(id: ID!): Boolean!
  }

  type Subscription {
    userCreated: User!
  }
`

export const schema: GraphQLSchema = makeExecutableSchema({
  typeDefs,
  resolvers,
})
