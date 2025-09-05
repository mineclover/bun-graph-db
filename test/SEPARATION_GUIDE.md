# 테스트 코드 분리 가이드

## 🎯 분리 원칙

### 1. CRUD 테스트 (Business Logic Tests)
- **목적**: 실제 비즈니스 로직 검증
- **범위**: 템플릿 생성, 실행, 삭제 등 실제 기능 테스트
- **로그**: 비즈니스 로직 결과 중심의 상세 로그
- **위치**: `test/suites/` 하위

### 2. 테스트 프레임워크 (Test Framework)
- **목적**: 테스트 실행 환경 관리
- **범위**: 테스트 스케줄링, 실행, 결과 수집
- **로그**: 테스트 실행 상태 중심의 간소 로그
- **위치**: `test/runner/` 하위

## 📁 새로운 구조

```
test/
├── business/                    # 비즈니스 로직 테스트
│   ├── crud/                   # CRUD 테스트
│   │   ├── template-crud.test.ts
│   │   └── node-crud.test.ts
│   ├── integration/            # 통합 테스트
│   └── performance/            # 성능 테스트
├── framework/                  # 테스트 프레임워크
│   ├── runner/                 # 테스트 실행기
│   │   └── test-runner.ts
│   ├── orchestrator/           # 테스트 오케스트레이터
│   └── reporter/               # 결과 보고기
├── shared/                     # 공통 유틸리티
│   ├── setup/                  # 환경 설정
│   ├── fixtures/               # 테스트 데이터
│   └── utilities/              # 공통 유틸리티
└── logs/                       # 로그 (분리됨)
    ├── business/               # 비즈니스 테스트 로그
    └── framework/              # 프레임워크 로그
```

## 🔧 로깅 분리

### Business Logger (비즈니스 테스트용)
```typescript
// 상세한 비즈니스 로직 로그
{
  "testName": "Template Creation Test",
  "businessContext": "template-management",
  "input": { templateId: "health-check", variables: {...} },
  "output": { success: true, data: {...} },
  "businessMetrics": { executionTime: 150, memoryUsage: 25 },
  "validationResults": { expectations: [...], passed: 3, failed: 0 }
}
```

### Framework Logger (테스트 프레임워크용)
```typescript
// 간소한 실행 상태 로그
{
  "testSuite": "template-crud",
  "executionStatus": "completed",
  "summary": { total: 16, passed: 0, failed: 16 },
  "duration": 30103,
  "frameworkErrors": ["Test failed with exit code 1"]
}
```

## 🚀 구현 계획

1. **디렉토리 구조 변경**
2. **별도 로거 생성**
3. **기존 코드 마이그레이션**
4. **로그 수집 방식 분리**
