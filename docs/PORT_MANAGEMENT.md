# Port Management Guidelines

## Port Allocation Rules

The Bun Graph DB system follows a structured port allocation strategy to ensure consistency across different environments and prevent conflicts.

### Environment-Based Port Ranges

| Environment | Port Range | Default | Usage |
|------------|------------|---------|-------|
| Development | 4000-4999 | 4000 | Local development and testing |
| Test | 5000-5999 | 5000 | Automated testing and CI/CD |
| Production | 8000-8999 | 8000 | Production deployments |

### Port Assignment Rules

#### GraphQL-Yoga Integration
- **HTTP Server**: Base port (e.g., 4000)
- **WebSocket Server**: Same port as HTTP (GraphQL-Yoga handles both protocols)
- **GraphQL Endpoint**: `http://localhost:{port}/graphql`
- **WebSocket Endpoint**: `ws://localhost:{port}/graphql`

#### Optional Service Ports (Future Use)
- **Metrics Service**: Base + 1000 (e.g., 5000 for metrics when base is 4000)
- **Health Check**: Base + 2000 (e.g., 6000 for health when base is 4000)

## Configuration Methods

### 1. Command Line Arguments
```bash
# Specify port directly
bun index.ts --port 4010

# Short form
bun index.ts -p 4010

# With environment
bun index.ts --port 8500 --env production
```

### 2. Environment Variables
```bash
# Set HTTP and WebSocket port via environment variable
GRAPHQL_PORT=4001 bun index.ts

# Combine with NODE_ENV
NODE_ENV=production GRAPHQL_PORT=8080 bun index.ts
```

**Note**: WebSocket port can only be configured via CLI arguments (`--ws-port`), not environment variables.

### 3. Priority Order
1. CLI arguments (highest priority)
2. Environment variables
3. Default values based on environment

## WebSocket Configuration

GraphQL-Yoga automatically handles WebSocket connections on the same port as HTTP, providing:

- Unified port management
- Automatic protocol upgrade
- Seamless subscription support
- No additional port configuration needed

### Testing WebSocket Connections
```javascript
// WebSocket URL is automatically derived from HTTP port
const httpPort = 4110;
const wsUrl = `ws://localhost:${httpPort}/graphql`;
```

## Port Manager API

The system includes a `PortManager` utility for consistent port handling:

```typescript
import { PortManager } from '@/core/config/PortConfiguration';

// Generate port configuration
const config = PortManager.generatePortConfig(4000, 'development');

// Get WebSocket URL from HTTP URL
const wsUrl = PortManager.getWebSocketUrl('http://localhost:4000');

// Detect environment from port
const env = PortManager.getEnvironmentFromPort(4000); // 'development'
```

## Best Practices

1. **Use Environment-Appropriate Ranges**: Always use ports within the designated range for your environment
2. **Document Port Usage**: When using non-default ports, document the reason
3. **Check Port Availability**: Ensure ports are not already in use before starting services
4. **Consistent WebSocket URLs**: Always derive WebSocket URLs from the HTTP port
5. **Log Port Configuration**: The system automatically logs port configuration on startup

## Examples

### Development Setup
```bash
# Default development port
bun run dev  # Uses port 4000

# Custom development port
bun index.ts --port 4050
```

### Test Environment
```bash
# Test with specific port
NODE_ENV=test bun index.ts --port 5100
```

### Production Deployment
```bash
# Production with explicit configuration
bun index.ts --port 8080 --env production
```

### Multi-Instance Setup
```bash
# Run multiple instances on different ports
bun index.ts --port 4001 &
bun index.ts --port 4002 &
bun index.ts --port 4003 &
```

## Troubleshooting

### Port Already in Use
If you encounter "address already in use" errors:
1. Check running processes: `lsof -i :4000`
2. Kill existing process: `kill -9 <PID>`
3. Use a different port within the range

### WebSocket Connection Issues
- Ensure the port is accessible through firewalls
- Verify GraphQL-Yoga is properly configured
- Check that the WebSocket protocol upgrade is allowed

### Port Range Warnings
The system will warn if you use a port outside the recommended range for your environment and will fall back to the default port for that environment.