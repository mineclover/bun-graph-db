# GraphQL Template Lifecycle Demo (Automated)

🤖 **자동 생성된 템플릿 라이프사이클 데모** - 스크립트를 통한 완전 자동화

## 📋 Overview

이 데모는 `generate-template-demo.ts` 스크립트를 통해 자동으로 생성되었습니다:

- **템플릿 생성**: 2개 템플릿 자동 생성/업데이트
- **템플릿 실행**: 2개 템플릿 실행 및 결과 수집  
- **데이터 생성**: 1개 테이블, 0개 노드 생성
- **파일 Export**: JSON 형태로 완전한 템플릿 및 결과 데이터 내보내기

## 🔧 시스템 특징

### 자동화된 템플릿 관리
- **1:1 매핑**: 각 템플릿마다 전용 폴더와 데이터셋
- **버전 관리**: 시맨틱 버저닝 (v1-0-0)
- **실행 검증**: 모든 템플릿이 실제 실행되어 검증됨
- **성능 추적**: 실행 시간과 성공률 자동 수집

### 완전한 변수 시스템
- **간단한 구조**: `{ "input": "table_name" }` 형태
- **스키마 검증**: JSON Schema 기반 입력 검증
- **샘플 데이터**: 다양한 사용 예제 제공
- **타입 안전성**: GraphQL 타입과 완벽 호환

## 🚀 Generated Files

### 폴더 구조
```
exported-templates/
├── templates/
│   ├── create-table/
│   │   ├── template_v1-0-0.json
│   │   └── dataset.json\n│   ├── get-table/
│   │   ├── template_v1-0-0.json
│   │   └── dataset.json
├── results/
│   └── execution-results.json
└── docs/
    └── README-TEMPLATE-DEMO.md
```

## 📊 Execution Results

### 성능 메트릭 (자동 수집)
- **총 실행 시간**: 1ms
- **평균 실행 시간**: 0.50ms
- **성공 실행**: 2/2
- **성공률**: 100.0%

### 템플릿별 실행 결과

#### Create Table (Enhanced Demo)
- **Template ID**: 12
- **Operation**: mutation
- **Status**: SUCCESS ✅
- **Execution Time**: 1ms
- **Input Variables**: `{"input":"demo_table_1757145929685"}`
\n
#### Get Table (Enhanced Demo)
- **Template ID**: undefined
- **Operation**: query
- **Status**: SUCCESS ✅
- **Execution Time**: 0ms
- **Input Variables**: `{"identifier":"demo_table_1757145929685"}`


## 📦 Dataset Information

### 생성된 리소스 (스크립트 자동 생성)
- **TABLE**: ID 52 (`demo_table_1757145929685`) - 2025-09-06T08:05:29.685Z

### 통계
- **테이블**: 1개
- **노드**: 0개  
- **속성**: 0개
- **관계**: 0개

## 🔧 스크립트 실행 방법

```bash
# 스크립트 실행
bun run scripts/generate-template-demo.ts

# 또는 npm script로 실행
npm run demo:template-generation
```

## 🎯 자동화의 장점

✅ **일관성**: 스크립트를 통한 표준화된 템플릿 생성  
✅ **재현성**: 동일한 결과를 반복적으로 생성 가능  
✅ **확장성**: 새로운 템플릿을 쉽게 추가 가능  
✅ **검증**: 자동 실행 및 결과 검증  
✅ **문서화**: 실행 결과 기반 자동 문서 생성  

---
*자동 생성됨 on 2025-09-06T08:05:29.688Z by `generate-template-demo.ts`* 🤖
