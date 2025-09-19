console.log('Starting backup test')
console.log('File exists:', await Bun.file('tests/e2e/critical-test.test.ts').exists())
console.log('File size:', (await Bun.file('tests/e2e/critical-test.test.ts').stat()).size)
