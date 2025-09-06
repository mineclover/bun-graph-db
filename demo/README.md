# Demo Code

## Overview

**실제 서버를 대상으로 하는 데모 코드 디렉토리**

이 디렉토리는 실제 실행 중인 GraphQL 서버에 요청을 보내어 템플릿 쿼리 기능을 시연하는 코드들을 포함합니다.

## Structure

```
demo/
├── template-queries/           # 템플릿 쿼리 실행 데모
│   ├── basic-demo.ts          # 기본 CRUD 데모
│   ├── advanced-demo.ts       # 고급 기능 데모  
│   └── performance-demo.ts    # 성능 측정 데모
├── fixtures/                  # 데모용 데이터
│   ├── demo-templates.ts      # 데모용 템플릿들
│   └── demo-queries.ts        # 데모용 쿼리들
├── utils/                     # 데모 유틸리티
│   ├── graphql-client.ts      # GraphQL 클라이언트
│   └── demo-runner.ts         # 데모 실행 도구
├── run-demo.ts               # 통합 데모 실행기
└── README.md                 # 이 파일
```

## Usage

### 기본 실행
```bash
# 기본 서버 주소 (http://localhost:4000)
bun run demo

# 사용자 지정 서버 주소
bun run demo --server http://localhost:3000
bun run demo --server https://api.example.com/graphql

# 특정 데모 실행
bun run demo:basic
bun run demo:advanced  
bun run demo:performance
```

### 서버 주소 설정
- 환경변수: `GRAPHQL_SERVER=http://localhost:4000`
- 파라미터: `--server <URL>`
- 기본값: `http://localhost:4000`

## Demo Categories

### 1. Basic Demo (`basic-demo.ts`)
- 템플릿 생성/조회/업데이트/삭제
- GraphQL 쿼리 실행
- 기본적인 CRUD 작업 시연

### 2. Advanced Demo (`advanced-demo.ts`) 
- 복잡한 템플릿 검색
- 필터링 및 정렬
- 성능 통계 확인
- 변수 스키마 검증

### 3. Performance Demo (`performance-demo.ts`)
- 대용량 템플릿 처리
- 실행 시간 측정
- 성능 메트릭 수집
- 쿼리 최적화 시연

## Safety Notes

- 모든 데모는 읽기 전용 또는 임시 데이터를 사용합니다
- 프로덕션 서버에 대한 실행 시 주의하세요
- 데모 실행 전 서버 연결을 확인하세요