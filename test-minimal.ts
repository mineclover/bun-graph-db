console.log('🔍 [1] Starting minimal test...')

import { createContainer } from './src/infrastructure/container/ContainerBootstrap'
console.log('✅ [2] ContainerBootstrap imported')

import { GraphQLSchemaBuilder } from './src/presentation/graphql/GraphQLSchemaBuilder'
console.log('✅ [3] GraphQLSchemaBuilder imported')

console.log('✅ [4] All imports complete - creating container...')
const container = await createContainer()
console.log('✅ [5] Container created - building schema...')

const schemaBuilder = new GraphQLSchemaBuilder(container)
console.log('✅ [6] SchemaBuilder instantiated - calling build()...')

const schema = await schemaBuilder.build()
console.log('✅ [7] Schema built successfully!')

console.log('✅ Test complete!')
