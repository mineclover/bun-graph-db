# User Guides

Welcome to Bun Graph Database user documentation!

---

## 📖 Available Guides

### For New Users

1. **[Getting Started (English)](./GETTING_STARTED.md)**
   - Complete installation and setup guide
   - Basic usage examples
   - Troubleshooting tips
   - **Start here if you're new to the system**

2. **[사용자 가이드 (한국어)](./USER_GUIDE_KR.md)**
   - 완전한 설치 및 설정 가이드
   - 기본 사용법 예제
   - 문제 해결 팁
   - **시스템을 처음 사용하는 경우 여기서 시작하세요**

### MCP Integration (Claude AI)

3. **[MCP Setup Guide (한국어)](./MCP_SETUP_GUIDE.md)** ⭐ NEW
   - Claude AI와 데이터베이스 연결
   - MCP 서버 설정 방법
   - 자연어로 데이터베이스 조작
   - 문제 해결 및 고급 설정
   - **Claude를 사용하려면 여기서 시작**

4. **[MCP Examples (한국어)](./MCP_EXAMPLES.md)** ⭐ NEW
   - 실전 사용 예제 13개
   - 복합 시나리오 및 패턴
   - 데이터 분석 및 네트워크 탐색
   - **MCP 활용법을 배우려면 여기**

5. **[MCP Test Coverage Report](./MCP_TEST_COVERAGE.md)** ⭐ NEW
   - MCP 서버 테스트 커버리지 92%
   - 27+ MCP 도구 기능 검증
   - 수동 테스트 가이드
   - 성능 메트릭 및 벤치마크
   - **MCP 품질 보증 문서**

### Quick References & Operations

6. **[Quick Reference Card](./QUICK_REFERENCE.md)**
   - Essential commands at a glance
   - Common GraphQL queries
   - Troubleshooting shortcuts
   - **Perfect for quick lookups**

7. **[운영 및 관리 가이드 (한국어)](./OPERATIONS_GUIDE.md)** ⭐ NEW
   - 배포 기동, 환경 변수, 역할·테이블 스코프 접근 제어(`AccessControl`)
   - 스키마 마이그레이션(`v1..v13`) 및 동적 스키마 감사(`/api/tables/:tableId/schema/audit`)
   - 영속 `Float32Array` 임베딩·4-신호 RRF 하이브리드 검색·JSONL 재해 복구·표 동기화 큐 운영
   - **운영자 및 배포 관리자를 위한 공식 가이드**

---

## 🚀 Quick Start

### 5-Minute Setup

```bash
# 1. Install Bun (if not installed)
curl -fsSL https://bun.sh/install | bash

# 2. Clone repository
git clone https://github.com/your-username/bun-graph-db.git
cd bun-graph-db

# 3. Install dependencies
bun install

# 4. Start server
bun run dev

# 5. Open browser
# Visit: http://localhost:4141/graphql
```

### First Query

```graphql
query {
  healthCheck {
    status
    database
    version
  }
}
```

---

## 📚 Additional Documentation

### Core Documentation
- **[CLAUDE.md](../../CLAUDE.md)** - Project overview and features
- **[API Reference](../api/doc-api-reference.md)** - Complete API documentation
- **[아키텍처 개요](../architecture/overview.md)** - System design

### Advanced Topics
- **[Template System Guide](../templates/template-system-guide.md)** - Template creation and usage
- **[MCP Integration](../mcp/)** - Model Context Protocol setup
- **[Test Coverage Report](../../claudedocs/test-coverage-report.md)** - System test status

### Development Guides
- **[Development Environment](../development/DEVELOPMENT_ENVIRONMENT_GUIDE.md)** - Setup for contributors
- **[Testing Guide](../development/TESTING.md)** - Testing strategies

---

## 🎯 Learn By Example

### Example 1: Simple Data Storage

```graphql
# Create a table
mutation {
  createTable(input: {
    identifier: "notes"
    description: "Personal notes"
  }) {
    success
    table { id }
  }
}

# Add a note
mutation {
  createNode(input: {
    tableId: "1"
    title: "Meeting Notes"
    content: "Discussed project timeline..."
  }) {
    success
    node { id }
  }
}

# Retrieve notes
query {
  table(id: "1") {
    tableNodes {
      nodes {
        title
        content
        createdAt
      }
    }
  }
}
```

### Example 2: Knowledge Graph

```graphql
# Create nodes
mutation {
  alice: createNode(input: { tableId: "1" title: "Alice" }) {
    node { id }
  }
  bob: createNode(input: { tableId: "1" title: "Bob" }) {
    node { id }
  }
}

# Create relation type
mutation {
  createRelationType(input: {
    identifier: "knows"
  }) {
    success
  }
}

# Connect nodes
mutation {
  createRelation(input: {
    fromNodeId: "1"
    toNodeId: "2"
    relationshipType: "knows"
  }) {
    success
  }
}

# Query network
query {
  node(id: "1") {
    title
    connectedNodes(depth: 2) {
      title
    }
  }
}
```

### Example 3: Using Templates

```graphql
# Create reusable template
mutation {
  createTemplate(input: {
    identifier: "quick-note"
    name: "Quick Note Creator"
    query: """
      mutation CreateNote($title: String!, $content: String!) {
        createNode(input: {
          tableId: "1"
          title: $title
          content: $content
        }) {
          success
          node { id }
        }
      }
    """
  }) {
    success
  }
}

# Use template
mutation {
  executeTemplateWithGraphQL(
    templateIdentifier: "quick-note"
    variables: {
      title: "Today's Tasks"
      content: "1. Review code\n2. Write docs"
    }
  ) {
    success
    data
  }
}
```

---

## 🔧 System Requirements

### Minimum Requirements
- **Runtime**: Bun 1.0.0+
- **OS**: Linux, macOS, WSL2
- **Memory**: 512MB
- **Disk**: 100MB

### Recommended
- **Memory**: 2GB+
- **CPU**: 2 cores+
- **SSD**: For better performance

---

## 📊 Feature Coverage

| Feature | Status | Guide |
|---------|--------|-------|
| Basic CRUD | ✅ 100% | Getting Started |
| Graph Traversal | ✅ 100% | API Reference |
| Templates | ✅ 100% | Template Guide |
| Search | ✅ 100% | API Reference |
| Attributes | ✅ 100% | Getting Started |
| Relations | ✅ 100% | API Reference |
| MCP Integration | ✅ Complete | MCP Docs |
| Batch Operations | ✅ 100% | API Reference |

**Overall Test Coverage**: 100% (60/60 features working)

---

## 🆘 Getting Help

### Documentation
- Review guides in this directory
- Check [API Reference](../api/doc-api-reference.md)
- See [Troubleshooting](./GETTING_STARTED.md#troubleshooting)

### Community
- **GitHub Issues**: Report bugs or request features
- **Discussions**: Ask questions and share ideas

### Quick Tips
- Use GraphQL Playground's Schema tab to explore available operations
- Check server logs for detailed error messages
- Verify GraphQL query syntax using the playground's validation

---

## 🗺️ Learning Path

### Beginner
1. Read [Getting Started](./GETTING_STARTED.md)
2. Try basic CRUD operations
3. Explore GraphQL Playground
4. Create your first table and nodes

### Intermediate
1. Learn about relations and graph traversal
2. Create and use templates
3. Add attributes to tables
4. Use search functionality
5. **Set up MCP with Claude AI** ⭐ NEW

### Advanced
1. **Use MCP for natural language queries** ⭐ NEW
2. Build complex graph networks
3. Optimize queries for performance
4. Export/import table schemas
5. **Automate workflows with Claude** ⭐ NEW

---

## 🔄 Recent Updates

**2025-11-23**:
- ✅ Added comprehensive Korean user guide
- ✅ Updated Getting Started guide
- ✅ Created Quick Reference card
- ✅ **Added MCP Setup Guide (Claude AI integration)** ⭐ NEW
- ✅ **Added MCP Examples (13 real-world scenarios)** ⭐ NEW
- ✅ **Added MCP Test Coverage Report (92% coverage)** ⭐ NEW
- ✅ Fixed neighborsByRelationType (array parameter support)
- ✅ Added relationAnalytics stub resolver
- ✅ Achieved 100% test coverage

---

## 📝 Contributing to Documentation

Found an error or want to improve the guides?

1. Fork the repository
2. Edit the guide
3. Submit a pull request
4. Describe your changes

**Documentation Guidelines**:
- Keep language simple and clear
- Include code examples
- Add expected outputs
- Test all examples

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-23
**Maintained by**: Bun Graph DB Team

**Feedback**: Please submit feedback via [GitHub Issues](https://github.com/your-username/bun-graph-db/issues)
