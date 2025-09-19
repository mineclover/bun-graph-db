# 템플릿 Import/Export 빠른 시작 가이드

## 🚀 5분 만에 시작하기

### 1. 서버 실행
```bash
bun run dev
# 서버가 http://localhost:4000/graphql에서 실행됩니다
```

### 2. Demo 실행
```bash
# 완전한 Import/Export 데모 실행
bun run demo:import-export

# 또는 직접 실행
bun run demo/run-import-export-demo.ts
```

### 3. GraphQL Playground 사용
브라우저에서 http://localhost:4000/graphql을 열고 다음 예시를 실행해보세요:

#### 템플릿 Export
```graphql
mutation {
  exportTemplate(templateId: "1", includeStatistics: true) {
    success
    exportData
    filename
    errors { message }
  }
}
```

#### 템플릿 Import  
```graphql
mutation {
  importTemplate(
    jsonData: "여기에_JSON_데이터"
    generateNewIdentifier: true
  ) {
    success
    template { id identifier name }
    warnings
  }
}
```

## 📚 상세 문서

- **완전한 사용 가이드**: [TEMPLATE_IMPORT_EXPORT.md](./TEMPLATE_IMPORT_EXPORT.md)
- **Demo 코드**: [demo/template-queries/import-export-demo.ts](../demo/template-queries/import-export-demo.ts)
- **GraphQL 클라이언트**: [demo/utils/graphql-client.ts](../demo/utils/graphql-client.ts)

## 🔧 주요 기능

- ✅ **ID/식별자 기반 Export**: 유연한 템플릿 선택
- ✅ **통계 정보 포함**: 사용 횟수, 실행 시간 등
- ✅ **중복 처리**: 덮어쓰기 또는 새 식별자 생성
- ✅ **JSON 형태**: 표준 JSON 형식으로 호환성 보장
- ✅ **완전한 복원**: 모든 메타데이터와 설정 보존

## 💡 사용 사례

- 🔄 **개발 환경 간 템플릿 동기화**
- 💾 **템플릿 백업 및 복원**
- 🚀 **프로덕션 배포 관리**  
- 🔄 **팀 간 템플릿 공유**
- 📊 **템플릿 버전 관리**