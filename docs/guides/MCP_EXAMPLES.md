# MCP Usage Examples
## Real-World Scenarios with Claude AI

**Version**: 1.0.0
**Last Updated**: 2026-11-27

---

## 📋 목차

1. [기본 작업](#기본-작업)
2. [데이터 관리](#데이터-관리)
3. [그래프 탐색](#그래프-탐색)
4. [템플릿 활용](#템플릿-활용)
5. [복합 시나리오](#복합-시나리오)

---

## 기본 작업

### 예제 1: 시스템 상태 확인

**Claude 대화**:
```
사용자: "데이터베이스 시스템 상태를 확인해줘"

Claude: [MCP 도구 사용: getSystemStats]
```

**결과**:
```
시스템 상태:
- 상태: 정상
- 데이터베이스: 연결됨
- 메모리 사용량: 45% (230MB / 512MB)
- 프로세스 ID: 12345
- 가동 시간: 2시간 15분
```

**GraphQL 동등 쿼리**:
```graphql
query {
  healthCheck { status database }
  systemStats {
    memory { used total percentage }
    process { pid }
  }
}
```

---

### 예제 2: 테이블 목록 조회

**Claude 대화**:
```
사용자: "어떤 테이블들이 있는지 보여줘"

Claude: [MCP 도구 사용: listTables]
```

**결과**:
```
총 3개의 테이블:
1. users (ID: 1) - 사용자 프로필, 노드 수: 15
2. projects (ID: 2) - 프로젝트 관리, 노드 수: 8
3. tasks (ID: 3) - 작업 목록, 노드 수: 42
```

---

## 데이터 관리

### 예제 3: 새 노드 생성

**Claude 대화**:
```
사용자: "users 테이블에 '김철수' 추가해줘. 역할은 'Software Engineer'로 설정"

Claude: [MCP 도구 사용: createNode]
```

**실행 과정**:
1. 테이블 ID 확인 (users → 1)
2. createNode 호출
3. 생성 확인

**결과**:
```
✅ 노드 생성 완료
- ID: 16
- 제목: 김철수
- 내용: Software Engineer
- 생성 시간: 2025-11-23 14:30:22
```

**GraphQL 동등 뮤테이션**:
```graphql
mutation {
  createNode(input: {
    tableId: "1"
    title: "김철수"
    content: "Software Engineer"
  }) {
    success
    node { id title }
  }
}
```

---

### 예제 4: 데이터 검색

**Claude 대화**:
```
사용자: "users 테이블에서 'engineer'를 검색해줘"

Claude: [MCP 도구 사용: searchNodes]
```

**결과**:
```
검색 결과: 5개의 노드 발견

1. 김철수 (ID: 16)
   - 역할: Software Engineer

2. John Doe (ID: 1)
   - 역할: Senior Software Engineer

3. Alice Johnson (ID: 3)
   - 역할: Data Engineer

4. Bob Smith (ID: 7)
   - 역할: DevOps Engineer

5. Carol Martinez (ID: 5)
   - 역할: System Engineer
```

---

### 예제 5: 데이터 수정

**Claude 대화**:
```
사용자: "김철수의 역할을 'Senior Software Engineer'로 변경해줘"

Claude: [MCP 도구 사용: updateNode]
```

**결과**:
```
✅ 노드 업데이트 완료
- ID: 16
- 제목: 김철수
- 변경된 내용: Senior Software Engineer
- 업데이트 시간: 2025-11-23 14:35:10
```

---

## 그래프 탐색

### 예제 6: 연결된 노드 찾기

**Claude 대화**:
```
사용자: "김철수와 연결된 모든 사람을 보여줘"

Claude: [MCP 도구 사용: getConnectedNodes]
```

**결과**:
```
김철수의 네트워크 (2단계까지):

직접 연결 (1단계):
- Alice Johnson (관계: knows)
- Bob Smith (관계: works_with)

간접 연결 (2단계):
- Carol Martinez (경로: 김철수 → Bob → Carol)
- David Lee (경로: 김철수 → Alice → David)
- Eve Wilson (경로: 김철수 → Alice → Eve)

총 5명 연결됨
```

---

### 예제 7: 최단 경로 찾기

**Claude 대화**:
```
사용자: "김철수에서 David Lee까지의 최단 경로를 찾아줘"

Claude: [MCP 도구 사용: findShortestPath]
```

**결과**:
```
최단 경로 발견: 2단계

경로:
1. 김철수 (Software Engineer)
   ↓ knows
2. Alice Johnson (Data Engineer)
   ↓ collaborates_with
3. David Lee (Product Manager)

경로 길이: 2
관계 유형: knows → collaborates_with
```

---

## 템플릿 활용

### 예제 8: 템플릿 검색

**Claude 대화**:
```
사용자: "user 관련된 템플릿을 모두 찾아줘"

Claude: [MCP 도구 사용: searchTemplates]
```

**결과**:
```
'user' 관련 템플릿 5개 발견:

1. create-user-v1
   - 이름: User Creation Template
   - 설명: Create new user with basic info
   - 태그: user, create
   - 사용 횟수: 23

2. update-user-role
   - 이름: Update User Role
   - 설명: Change user's role assignment
   - 태그: user, update
   - 사용 횟수: 15

3. search-users-by-role
   - 이름: Search Users By Role
   - 설명: Find users with specific role
   - 태그: user, search
   - 사용 횟수: 42

4. batch-create-users
   - 이름: Batch User Creation
   - 설명: Create multiple users at once
   - 태그: user, create, batch
   - 사용 횟수: 8

5. user-network-analysis
   - 이름: User Network Analysis
   - 설명: Analyze user connections
   - 태그: user, analytics
   - 사용 횟수: 12
```

---

### 예제 9: 템플릿 실행

**Claude 대화**:
```
사용자: "create-user-v1 템플릿으로 'Jane Smith'를 추가해줘. 역할은 'Product Manager'"

Claude: [MCP 도구 사용: executeTemplate]
```

**실행 과정**:
1. 템플릿 조회 (create-user-v1)
2. 변수 설정:
   - name: "Jane Smith"
   - role: "Product Manager"
3. 템플릿 실행
4. 결과 확인

**결과**:
```
✅ 템플릿 실행 완료

생성된 노드:
- ID: 17
- 이름: Jane Smith
- 역할: Product Manager
- 테이블: users (ID: 1)
- 생성 시간: 2025-11-23 15:00:00
```

---

## 복합 시나리오

### 예제 10: 프로젝트 팀 구성

**Claude 대화**:
```
사용자: "새 프로젝트 'AI Dashboard'를 만들고, 김철수, Alice, Bob을 팀원으로 추가해줘"

Claude: [복합 MCP 작업 실행]
```

**실행 단계**:

**1단계: 프로젝트 노드 생성**
```
createNode(tableId: "2", title: "AI Dashboard")
→ 생성됨: ID 9
```

**2단계: 팀원 노드 조회**
```
김철수: ID 16
Alice Johnson: ID 3
Bob Smith: ID 7
```

**3단계: 관계 생성**
```
createRelation(from: 16, to: 9, type: "works_on")
createRelation(from: 3, to: 9, type: "works_on")
createRelation(from: 7, to: 9, type: "works_on")
```

**결과**:
```
✅ 프로젝트 팀 구성 완료

프로젝트: AI Dashboard (ID: 9)
팀원:
- 김철수 (Senior Software Engineer)
- Alice Johnson (Data Engineer)
- Bob Smith (DevOps Engineer)

관계: 3개 생성됨
```

---

### 예제 11: 데이터 분석 및 보고

**Claude 대화**:
```
사용자: "각 역할별로 몇 명의 사용자가 있는지 분석해줘"

Claude: [MCP로 데이터 조회 및 분석]
```

**실행 과정**:
1. 모든 users 검색
2. 역할별 그룹화
3. 통계 계산
4. 보고서 생성

**결과**:
```
사용자 역할 분석 보고서

총 사용자: 17명

역할별 분포:
┌────────────────────────────┬────────┬─────────┐
│ 역할                       │ 인원   │ 비율    │
├────────────────────────────┼────────┼─────────┤
│ Software Engineer          │ 6명    │ 35.3%   │
│ Senior Software Engineer   │ 3명    │ 17.6%   │
│ Data Engineer              │ 2명    │ 11.8%   │
│ DevOps Engineer            │ 2명    │ 11.8%   │
│ Product Manager            │ 2명    │ 11.8%   │
│ System Engineer            │ 1명    │ 5.9%    │
│ UX Designer                │ 1명    │ 5.9%    │
└────────────────────────────┴────────┴─────────┘

인사이트:
- 엔지니어가 전체의 82.4%
- 제품/디자인 인력 17.6%
- 가장 많은 역할: Software Engineer (6명)
```

---

### 예제 12: 배치 작업

**Claude 대화**:
```
사용자: "다음 3명의 사용자를 한 번에 추가해줘:
1. Tom Brown - Backend Developer
2. Sara Wilson - Frontend Developer
3. Mike Davis - QA Engineer"

Claude: [MCP 배치 작업 실행]
```

**실행 과정**:
1. 배치 템플릿 확인
2. 3개 노드 생성 준비
3. 트랜잭션으로 실행
4. 결과 검증

**결과**:
```
✅ 배치 작업 완료 (3/3 성공)

생성된 노드:
1. Tom Brown (ID: 18)
   - 역할: Backend Developer
   - 상태: ✅ 성공

2. Sara Wilson (ID: 19)
   - 역할: Frontend Developer
   - 상태: ✅ 성공

3. Mike Davis (ID: 20)
   - 역할: QA Engineer
   - 상태: ✅ 성공

실행 시간: 0.23초
성공률: 100%
```

---

### 예제 13: 네트워크 분석

**Claude 대화**:
```
사용자: "users 테이블의 네트워크 구조를 분석해줘. 누가 가장 많이 연결되어 있나?"

Claude: [MCP로 그래프 분석]
```

**실행 과정**:
1. 모든 관계 조회
2. 노드별 연결 수 계산
3. 중심성 분석
4. 시각화 데이터 생성

**결과**:
```
네트워크 분석 보고서

총 노드: 20명
총 관계: 45개
평균 연결: 2.25명/인

연결성 순위 (Top 5):
1. Alice Johnson (ID: 3)
   - 연결 수: 8개
   - 직접 연결: 김철수, Bob, Carol, David, Eve, Frank, Grace, Henry
   - 역할: 네트워크 허브

2. 김철수 (ID: 16)
   - 연결 수: 6개
   - 직접 연결: Alice, Bob, Carol, David, Tom, Sara
   - 역할: 핵심 커넥터

3. Bob Smith (ID: 7)
   - 연결 수: 5개
   - 직접 연결: 김철수, Alice, Mike, Tom, Sara
   - 역할: 브리지

4. Carol Martinez (ID: 5)
   - 연결 수: 4개
   - 역할: 서브 허브

5. David Lee (ID: 10)
   - 연결 수: 4개
   - 역할: 서브 허브

네트워크 특성:
- 구조: 스몰 월드 네트워크
- 클러스터링 계수: 0.42
- 평균 경로 길이: 2.1
- 고립 노드: 0개
```

---

## 실전 팁

### Tip 1: 명확한 지시

**❌ 비효율적**:
```
"데이터 좀 보여줘"
```

**✅ 효율적**:
```
"users 테이블에서 'engineer' 역할을 가진 모든 사용자를 보여줘"
```

### Tip 2: 단계별 작업

**❌ 복잡**:
```
"새 프로젝트 만들고 팀원 5명 추가하고 관계 설정하고 속성 추가해줘"
```

**✅ 단계적**:
```
1. "새 프로젝트 'Mobile App' 만들어줘"
2. "이 프로젝트에 김철수와 Alice를 추가해줘"
3. "관계 타입은 'team_member'로 설정해줘"
```

### Tip 3: 결과 확인

**항상 확인**:
```
"방금 만든 노드의 ID를 알려줘"
"생성이 성공했는지 확인해줘"
```

### Tip 4: 오류 처리

**오류 발생 시**:
```
"오류가 발생했어. 다시 시도해줘"
"권한 문제인가? 확인해줘"
```

---

## 부록: 일반적인 작업 패턴

### 패턴 1: CRUD 사이클

```
1. 생성: "새 [타입] [이름] 추가"
2. 조회: "[타입]에서 [조건] 검색"
3. 수정: "[이름]의 [속성]을 [값]으로 변경"
4. 삭제: "[이름] 삭제"
```

### 패턴 2: 관계 관리

```
1. 연결: "[A]와 [B]를 [관계타입]으로 연결"
2. 탐색: "[A]와 연결된 모든 [타입] 보여줘"
3. 경로: "[A]에서 [B]까지의 경로 찾기"
```

### 패턴 3: 분석 작업

```
1. 통계: "[테이블]의 [속성]별 분포 보여줘"
2. 순위: "[속성] 기준으로 상위 10개"
3. 비교: "[A]와 [B]의 [속성] 비교"
```

---

**문서 버전**: 1.0.0
**최종 업데이트**: 2026-11-27
**관련 문서**: [MCP Setup Guide](./MCP_SETUP_GUIDE.md)
