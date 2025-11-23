console.log('🔍 Testing top-level await...')

const delay = () => new Promise(resolve => setTimeout(resolve, 100))

console.log('🔍 Calling delay...')
await delay()
console.log('✅ Delay complete!')

console.log('✅ Top-level await works!')
