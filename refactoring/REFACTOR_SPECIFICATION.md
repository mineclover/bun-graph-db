# 프로젝트 리팩토링 기능 정의서

## 🎯 리팩토링 목표

### 핵심 목표
1. **관심사 분리**: Query, Mutation, Subscription 역할별 명확한 분리
2. **Database 추상화**: 다중 Database Provider 지원 구조
3. **의존성 주입 개선**: 타입 안전한 DI 시스템 구축
4. **유지보수성**: 모듈화와 단일 책임 원칙 적용

### 해결하려는 문제점
- **Monolithic Resolver**: 366줄의 단일 schema-builder.ts 파일
- **강결합 Database**: Bun SQLite에 종속된 Repository 구조
- **Service Locator**: 안티패턴으로 분류되는 현재 DI 방식
- **타입 안전성 부족**: 런타임 의존성 해결 오류 가능성

## 📁 새로운 아키텍처 구조

> **상세 폴더 구조는 [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md)를 참고하세요.**

### 계층별 역할 정의

**Core Layer** - 핵심 비즈니스 추상화
- Database 추상화 인터페이스 및 어댑터
- 공통 타입 정의 및 환경 설정
- Provider 독립적인 비즈니스 로직

**Infrastructure Layer** - 기술적 구현  
- Repository 및 Connection 구현체들
- **새로운 DI Container 시스템**
- 로깅, 캐싱 등 기술적 관심사

**Presentation Layer** - GraphQL 인터페이스
- **도메인별 분리된 Resolver 클래스들**
- **분산된 GraphQL 스키마 파일들**  
- Field Resolver 및 타입 정의들

### 핵심 변경점
- **366줄 단일 파일을 역할별 클래스로 분산**
- **Service Locator를 타입 안전한 DI로 전환**  
- **강결합 Database를 Provider 독립적 구조로 변경**

---

## 🗄️ Database Abstraction Layer

### 추상화 목표
현재 Bun SQLite에 강결합된 Repository들을 다중 Provider 지원 구조로 전환

### 핵심 구성요소

#### Connection Interface (IDatabaseConnection)
**역할**: 모든 Database Provider의 통합 인터페이스
**제공 기능**:
- 기본 쿼리 실행 메서드 (단일/다중 결과)
- 트랜잭션 생명주기 관리
- 연결 상태 모니터링
- Provider별 메타데이터 및 제한사항 정보

#### Transaction Manager (ITransactionManager) 
**역할**: Provider별 트랜잭션 차이점 추상화
**제공 기능**:
- 트랜잭션 스코프 내 쿼리 실행
- 커밋/롤백 제어
- 트랜잭션 상태 추적
- 중첩 트랜잭션 처리 (Provider 지원 시)

#### Provider Adapters
**BunSqliteAdapter**:
- 현재 시스템의 Bun SQLite 로직 래핑
- 동기 API를 비동기 호환 인터페이스로 변환
- WAL 모드 및 PRAGMA 설정 관리

**CloudflareD1Adapter**:
- Cloudflare D1 API를 표준 인터페이스로 변환
- Batch API 기반 트랜잭션 에뮬레이션
- D1 특화 제한사항 및 최적화 처리
- 네트워크 오류 재시도 및 Circuit Breaker 패턴

#### Provider Factory
**역할**: 환경에 적합한 Provider 인스턴스 생성
**제공 기능**:
- 환경 변수 기반 자동 Provider 선택
- Provider별 설정 값 주입
- 싱글톤 Connection 관리
- Health Check 및 Fallback 전략

### Repository Layer 변경사항
- 직접 Database 객체 의존성 → IDatabaseConnection 인터페이스 의존
- Bun SQLite 전용 메서드 → 표준화된 쿼리 인터페이스
- 하드코딩된 SQL → Provider 호환 쿼리

---

## 🎯 GraphQL 관심사 분리

### 분리 목표
현재 366줄의 단일 schema-builder.ts를 역할별로 분리하여 유지보수성 향상

### Schema 구조 재설계

#### Root Schema 정의
**역할**: GraphQL 진입점 및 확장 기반 구조 제공
**구성**:
- 기본 Query, Mutation, Subscription 타입 선언
- Health Check 등 공통 쿼리 정의
- 각 도메인 스키마의 확장점 제공

#### Domain Schema 모듈화
**타입 정의**: 각 도메인(Table, Node, Relation)별 GraphQL 타입
**쿼리 정의**: 도메인별 읽기 작업 쿼리 스키마
**변경 정의**: 도메인별 변경 작업 뮤테이션 스키마
**확장 방식**: `extend type Query/Mutation` 구문 활용

#### Schema 병합 시스템
**파일 로딩**: 분산된 .graphql 파일들의 자동 탐지
**타입 병합**: 중복 없는 통합 스키마 생성
**순서 보장**: 의존성 있는 타입들의 올바른 로딩 순서

### Resolver 클래스 체계

#### Query Resolver Classes
**TableQueries**: 테이블 관련 읽기 작업 전담
**NodeQueries**: 노드 관련 읽기 작업 전담
**RelationQueries**: 관계 관련 읽기 작업 전담
**AnalyticsQueries**: 분석 관련 읽기 작업 전담

**공통 특징**:
- 읽기 전용 작업만 수행
- Repository 직접 접근 또는 Use Case 활용
- 표준화된 에러 처리 및 로깅
- 페이지네이션 및 필터링 지원

#### Mutation Resolver Classes
**TableMutations**: 테이블 관련 변경 작업 전담
**NodeMutations**: 노드 관련 변경 작업 전담  
**RelationMutations**: 관계 관련 변경 작업 전담

**공통 특징**:
- Use Case를 통한 비즈니스 로직 실행
- 입력 검증 및 권한 확인
- 트랜잭션 경계 관리
- 성공/실패 응답 표준화

#### Field Resolver 분리
**엔티티별 분리**: Table, Node, Relation 등 엔티티별 Field Resolver
**지연 로딩**: 요청된 필드만 데이터 로딩
**성능 최적화**: N+1 쿼리 방지 및 배치 처리 고려

### Schema Builder 재설계
**Resolver 조립**: DI Container를 통한 Resolver 인스턴스 생성
**스키마 통합**: 분산된 스키마와 Resolver의 통합
**타입 검증**: 컴파일 타임 타입 안전성 보장
**확장 지원**: 새로운 도메인 추가 시 최소한의 변경

---

## 🔧 의존성 주입 시스템

### DI 전환 목표
Service Locator 안티패턴을 실제 Dependency Injection 패턴으로 전환

### 현재 문제점 분석
- **전역 상태**: Singleton DependencyContainer의 전역 상태 공유
- **런타임 에러**: 문자열 기반 의존성 해결로 인한 타입 안전성 부족
- **강결합**: Repository들이 구체적인 Database 객체에 직접 의존
- **테스트 어려움**: Mock 객체 주입의 복잡성

### 새로운 DI 시스템 설계

#### DI Container Core
**역할**: 타입 안전한 서비스 등록 및 해결
**지원 생명주기**:
- Singleton: 애플리케이션 생명주기 동안 단일 인스턴스
- Transient: 요청 시마다 새로운 인스턴스 생성
- Scoped: 특정 스코프 내에서 단일 인스턴스
- Instance: 미리 생성된 인스턴스 등록

**제공 기능**:
- 의존성 그래프 자동 해결
- 순환 의존성 감지 및 예방
- 서비스 생명주기 자동 관리
- 스코프별 인스턴스 격리

#### Service Token System  
**타입 안전성**: 제네릭 기반 컴파일 타임 타입 검증
**고유성**: Symbol 기반 서비스 식별자로 충돌 방지
**메타데이터**: 서비스 이름, 설명, 버전 정보 포함
**IDE 지원**: IntelliSense 및 자동완성 지원

#### Module 기반 서비스 등록
**DatabaseModule**: 
- Database Connection 추상화 등록
- Provider Factory 등록
- Health Check 서비스 등록

**RepositoryModule**:
- 모든 Repository 인터페이스 구현체 등록
- Database Connection 의존성 주입 설정

**UseCaseModule**:
- 모든 Use Case 등록
- Repository 의존성 주입 설정

**GraphQLModule**:
- Query/Mutation Resolver 등록
- Schema Builder 등록
- Use Case 의존성 주입 설정

#### Container Bootstrap
**초기화 순서**: Core → Infrastructure → Application → Presentation
**검증 단계**: 
- 모든 의존성 등록 확인
- 순환 의존성 검사
- 누락된 의존성 탐지
**에러 처리**: 명확한 에러 메시지 및 해결 방안 제시

### 기존 클래스 변경사항
- **Repository**: Database 객체 → IDatabaseConnection 인터페이스
- **Use Case**: Repository 직접 생성 → 생성자 주입
- **Resolver**: Use Case 직접 생성 → 생성자 주입
- **Application**: Container getInstance() → 생성자 주입

---

## 🌥️ Cloudflare D1 호환성

### 호환성 목표
Bun SQLite 기반 시스템을 Cloudflare D1에서도 동일하게 실행 가능한 구조 구축

### D1 vs Bun SQLite 특성 분석

#### API 차이점
**동기성**: Bun SQLite 동기 API vs D1 비동기 API
**트랜잭션**: Native transaction vs Batch API 기반
**에러 처리**: Exception 기반 vs Result 객체 기반
**연결 관리**: 명시적 연결 관리 vs 자동 관리

#### 제한사항 차이
**쿼리 크기**: Bun SQLite ~1MB vs D1 100KB
**파라미터 수**: Bun SQLite 999개 vs D1 100개
**배치 크기**: Bun SQLite 무제한 vs D1 25개
**동시성**: Bun SQLite WAL 모드 vs D1 자동 관리

### D1 Adapter 설계

#### API 통합
**비동기 래핑**: D1 Promise API를 IDatabaseConnection으로 통합
**결과 변환**: D1 Result 객체를 표준 형식으로 변환
**에러 매핑**: D1 에러를 표준 Exception으로 변환
**메타데이터 추출**: D1 실행 통계를 표준 메타데이터로 매핑

#### 제한사항 처리
**쿼리 크기 검사**: 100KB 초과 쿼리 감지 및 거부/분할
**파라미터 수 검사**: 100개 초과 파라미터 감지 및 에러 처리
**배치 크기 관리**: 25개 초과 operation 자동 분할 처리
**최적화 힌트**: 개발자에게 D1 최적화 방향 제시

#### 트랜잭션 에뮬레이션
**Batch 활용**: D1 batch API를 통한 트랜잭션 시뮬레이션
**원자성 근사**: 배치 실패 시 전체 작업 취소
**제한 처리**: 25개 초과 시 여러 배치로 분할
**일관성 주의**: 진정한 ACID 트랜잭션과의 차이점 문서화

### 성능 최적화 전략

#### 네트워크 최적화
**배치 우선**: 개별 쿼리보다 배치 처리 권장
**캐싱 전략**: 읽기 쿼리의 메모리 캐싱
**압축**: 큰 쿼리의 압축 전송 고려

#### 오류 복구
**재시도 로직**: 네트워크 오류 및 일시적 장애 재시도
**Circuit Breaker**: 연속 실패 시 빠른 실패 전환
**Fallback**: 가능한 경우 대체 실행 경로 제공

### 배포 환경 지원

#### 환경 감지
**Worker 환경**: globalThis.DB 존재 여부로 D1 환경 판단
**개발 환경**: 로컬 D1 vs 원격 D1 구분
**테스트 환경**: Mock D1 vs 실제 D1 선택

#### 설정 관리
**환경별 Provider**: DATABASE_PROVIDER 환경변수 기반 선택
**D1 바인딩**: Workers 환경의 D1 데이터베이스 바인딩 자동 감지
**Migration**: D1 호환 스키마 및 데이터 마이그레이션

#### 배포 도구 통합
**Wrangler 연동**: wrangler.toml 설정 및 CLI 명령어 활용
**CI/CD**: 자동 배포 및 D1 마이그레이션 파이프라인
**모니터링**: D1 성능 및 오류 모니터링 설정

---

## 📋 구현 로드맵

### 전체 일정: 7주

#### Phase 1: Core Foundation (2주)
**목표**: 핵심 추상화 계층 구축
**주요 작업**:
- IDatabaseConnection 인터페이스 설계 및 정의
- BunSqliteAdapter 구현 (기존 로직 래핑)
- 기본 DI Container 구현
- Service Token 시스템 구축
- DatabaseModule, RepositoryModule 구현

**완료 기준**:
- 기존 Repository들이 새로운 인터페이스로 동작
- 기존 테스트 케이스 모두 통과
- DI Container로 Repository 인스턴스 생성 가능

#### Phase 2: GraphQL 구조 분리 (2주)
**목표**: GraphQL 관심사 분리 및 모듈화
**주요 작업**:
- GraphQL 스키마 파일들 도메인별 분리
- Query/Mutation/Field Resolver 클래스 구현
- 새로운 Schema Builder 구현
- GraphQLModule 구현

**완료 기준**:
- 기존 GraphQL 기능 모두 동일하게 동작
- 도메인별로 분리된 Resolver 클래스들 정상 작동
- 새로운 도메인 추가 시 최소한의 변경으로 확장 가능

#### Phase 3: DI 통합 적용 (1주)
**목표**: 전체 시스템에 DI 패턴 적용
**주요 작업**:
- Use Case 클래스들의 DI 적용
- GraphQL Resolver들의 DI 적용
- Application 진입점의 Container Bootstrap 적용
- 기존 DependencyContainer 제거

**완료 기준**:
- Service Locator 패턴 완전 제거
- 모든 의존성이 생성자 주입으로 해결
- Mock 객체 주입을 통한 단위 테스트 가능

#### Phase 4: Cloudflare D1 지원 (1주)
**목표**: D1 환경에서 실행 가능한 구조 완성
**주요 작업**:
- CloudflareD1Adapter 구현
- 환경 감지 및 자동 Provider 전환
- D1 호환 마이그레이션 스크립트 작성
- D1 환경 테스트 및 검증

**완료 기준**:
- 로컬 Bun 환경과 D1 환경 모두에서 동일하게 동작
- 환경 변수만으로 Provider 전환 가능
- D1 제한사항 처리 정상 동작

#### Phase 5: 품질 향상 및 정리 (1주)
**목표**: 성능 최적화 및 코드 정리
**주요 작업**:
- 성능 측정 및 최적화
- 사용하지 않는 코드 정리
- 문서 업데이트
- 추가 테스트 케이스 작성

**완료 기준**:
- 기존 대비 성능 저하 없음
- 코드 커버리지 80% 이상
- 새로운 구조에 대한 문서 완성

### 위험 요소 및 완화 방안

#### 높은 위험
**Breaking Changes**: 모든 클래스 시그니처 변경
- *완화방안*: 단계적 적용 및 충분한 테스트

**복잡한 의존성**: DI 그래프의 복잡성 증가
- *완화방안*: 모듈 단위 점진적 적용

#### 중간 위험
**학습 곡선**: 새로운 패턴에 대한 학습 필요
- *완화방안*: 단계별 가이드 문서 제공

**성능 영향**: 추상화로 인한 오버헤드
- *완화방안*: 성능 측정 및 최적화

#### 낮은 위험
**D1 제한사항**: Cloudflare D1의 고유 제약사항
- *완화방안*: 제한사항 문서화 및 가이드라인 제공

---

## 🎯 리팩토링 기대 효과

### 코드 품질 향상
**관심사 분리**: 366줄 단일 파일을 역할별 클래스로 분산
**단일 책임**: 각 클래스가 명확한 하나의 역할만 수행
**낮은 결합도**: 인터페이스 기반 의존성으로 결합도 감소
**높은 응집도**: 관련 기능들의 논리적 그룹화
**타입 안전성**: 컴파일 타임 에러 감지 및 IntelliSense 지원

### 개발 생산성
**병렬 개발**: 도메인별 독립적 개발 가능
**빠른 디버깅**: 문제 발생 시 해당 도메인만 집중 가능
**쉬운 테스트**: Mock 주입을 통한 격리된 단위 테스트
**IDE 지원**: 더 나은 자동완성 및 리팩토링 지원
**문서화**: 클래스별 명확한 역할 및 인터페이스 문서화

### 시스템 확장성
**새로운 Database Provider**: 인터페이스 구현만으로 추가 가능
**새로운 GraphQL 도메인**: 최소한의 변경으로 도메인 확장
**새로운 기능**: DI를 통한 기능 추가 및 교체 용이
**A/B 테스트**: 구현체 교체를 통한 기능 비교 테스트
**점진적 마이그레이션**: 단계별 기능 업그레이드 가능

### 운영 안정성
**환경별 설정**: 개발/스테이징/프로덕션 환경 독립 설정
**무중단 배포**: Provider 전환을 통한 무중단 마이그레이션
**모니터링**: 각 계층별 독립적인 성능 모니터링
**장애 격리**: 특정 도메인 장애가 전체 시스템에 미치는 영향 최소화
**복구 용이성**: 명확한 책임 분리로 빠른 문제 해결

### 비즈니스 가치
**빠른 기능 출시**: 모듈화된 구조로 기능 개발 속도 향상
**낮은 유지보수 비용**: 명확한 구조로 인한 유지보수 비용 절감
**확장 비용 절감**: 새로운 기능 추가 시 기존 코드 영향 최소화
**기술 부채 감소**: 구조적 문제점 해결로 기술 부채 대폭 감소
**인력 투입 효율성**: 새로운 개발자의 빠른 온보딩 가능

---

## ⚠️ 리스크 및 고려사항

### 높은 영향도 리스크

#### Breaking Changes
**범위**: 거의 모든 기존 코드 수정 필요
**영향**:
- 모든 클래스 생성자 시그니처 변경
- Import 경로 전면 변경
- 환경 변수 및 설정 구조 변경
- 기존 테스트 코드 수정 필요

**완화 방안**:
- 단계별 점진적 적용
- 충분한 회귀 테스트
- 마이그레이션 가이드 제공
- 백업 및 롤백 계획 수립

#### 학습 곡선
**도전 과제**:
- DI 패턴 및 IoC 컨테이너 개념 학습
- 새로운 GraphQL 구조 이해
- Database 추상화 레이어 개념
- Service Token 시스템 사용법

**완화 방안**:
- 단계별 교육 프로그램
- 실습 위주의 가이드 문서
- 팀 내 지식 공유 세션
- 점진적 적용을 통한 학습 시간 확보

### 중간 영향도 리스크

#### 성능 영향
**우려사항**:
- 인터페이스 레이어로 인한 함수 호출 오버헤드
- DI Container의 의존성 해결 시간
- 더 많은 객체 인스턴스로 인한 메모리 사용량 증가

**완화 방안**:
- 성능 테스트 및 벤치마킹
- Singleton 패턴 활용으로 인스턴스 수 최소화
- 지연 로딩 및 캐싱 전략 적용

#### 복잡성 증가
**우려사항**:
- DI 그래프의 복잡성
- 디버깅 시 호출 스택 깊이 증가
- 의존성 추적의 어려움

**완화 방안**:
- 명확한 모듈 구조 및 네이밍 규칙
- DI Container의 디버깅 도구 제공
- 의존성 그래프 시각화 도구 활용

### 낮은 영향도 리스크

#### 초기 개발 속도 저하
**원인**: 새로운 구조 적응 기간
**기대 기간**: 2-3주
**장기 효과**: 이후 개발 속도 대폭 향상

#### D1 제한사항
**제약사항**: Cloudflare D1의 고유 제약
**대응**: 제약사항 문서화 및 우회 방법 제시

### 성공 조건

#### 기술적 성공 지표
- 모든 기존 테스트 케이스 통과
- 성능 저하 10% 이내
- 코드 커버리지 80% 이상 유지
- 순환 의존성 0개

#### 비즈니스 성공 지표
- 새로운 기능 개발 속도 30% 향상
- 버그 발생률 50% 감소
- 새로운 개발자 온보딩 시간 50% 단축
- 유지보수 시간 40% 절약

### 롤백 계획

#### 롤백 시나리오
- 성능 저하 20% 초과
- 치명적 버그 발생
- 마이그레이션 일정 3주 초과 지연

#### 롤백 방법
- Git 브랜치 전략을 통한 빠른 되돌리기
- 기존 코드 백업 및 복구 계획
- 단계별 롤백 가능한 구조 설계