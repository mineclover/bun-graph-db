# 템플릿 지속관리 컨벤션

## 🎯 핵심 원칙 (즉시 적용)

### 1. 파일명 규칙 (엄격)
```
{template-identifier}_v{major}-{minor}-{patch}.json
```

**예시:**
- ✅ `search-templates-advanced_v1-0-0.json`
- ✅ `list-nodes-by-table_v1-2-1.json`
- ❌ `searchTemplatesAdvanced.json`
- ❌ `search_templates_advanced_v1.0.0.json`

### 2. 변경 전 필수 검증 (수동)
```bash
# 템플릿 수정 전 MUST DO
bun run template:validate-single {template-name}

# 변경 후 MUST DO  
bun run template:validate-single {template-name}

# Export 전 MUST DO
curl -X POST http://localhost:4000/graphql -d '{"query":"query{__typename}"}'  # 서버 확인
```

### 3. 핵심 템플릿 보호 (절대 규칙)
다음 템플릿들은 **절대** 검증 없이 변경 금지:
- `search-templates-advanced`
- `list-nodes-by-table` 
- `get-table-schema`
- `list-tables-with-pagination`

### 4. 안전한 변경 절차
1. **백업**: 기존 파일 복사 보관
2. **검증**: `bun run template:validate-single` 실행
3. **테스트**: 실제 변수로 실행 테스트  
4. **Export**: 검증 통과 후에만 파일 저장
5. **확인**: Export된 파일 재검증

## 🔄 점진적 도입 계획

### Phase 1: 수동 검증 (현재)
- 개발자가 직접 검증 스크립트 실행
- 변경 전/후 수동 체크
- 문제 발생시 즉시 롤백

### Phase 2: 반자동화 (검증 후)
```bash
# 검증된 후에만 도입
bun run template:health-check     # 월 1회 실행
bun run template:batch-validate   # 주 1회 실행
```

### Phase 3: 자동화 (충분한 테스트 후)
- Git hooks (opt-in)
- CI/CD 통합 (선택적)
- 자동 알림 (검토 후)

## ⚠️ 금지사항

### 절대 하지 말 것
- ❌ 검증 없이 템플릿 변경
- ❌ 서버 다운 상태에서 Export
- ❌ 백업 없이 핵심 템플릿 수정
- ❌ 검증되지 않은 자동화 스크립트 적용

### 주의사항
- ⚠️ 새 스크립트는 테스트 환경에서만 실행
- ⚠️ 자동 수정 기능은 검토 후 적용
- ⚠️ 일괄 처리는 백업 후에만 실행

## 📋 체크리스트

### 템플릿 수정 시
- [ ] 백업 생성 완료
- [ ] GraphQL 서버 실행 확인
- [ ] `bun run template:validate-single {name}` 실행
- [ ] 실제 변수로 테스트 실행
- [ ] Export 후 파일 내용 확인
- [ ] 변경사항 문서화

### 문제 발생 시
- [ ] 즉시 이전 버전으로 롤백
- [ ] 오류 원인 분석 및 기록
- [ ] 필요시 `bun run template:fix-and-export fix {name}` 실행
- [ ] 수정 후 재검증

## 🚨 비상 연락처

문제 발생 시:
1. **즉시 롤백**: 이전 파일로 복원
2. **서버 재시작**: `bun run dev` 재실행
3. **검증 재실행**: 전체 핵심 템플릿 재검증

## 📊 현재 상태

### 검증된 안전 도구
- ✅ `scripts/simple-validator.ts` - 기본 검증
- ✅ `bun run template:validate-single` - 단일 검증
- ✅ Manual export process - 수동 Export

### 테스트 필요 도구  
- 🧪 `scripts/template-validator.ts` - 고급 검증 (테스트 중)
- 🧪 `scripts/template-fixer.ts` - 자동 수정 (테스트 중)
- 🧪 Git hooks - 자동화 (검토 중)

### 아직 사용 금지
- ❌ 자동 Git hooks
- ❌ CI/CD 자동 검증
- ❌ 무인 자동 수정

## 📝 변경 로그

모든 템플릿 변경사항을 기록:

```
날짜: 2025-09-06
템플릿: search-templates-advanced
변경: Relay pagination → offset pagination
검증: ✅ 통과
담당자: [이름]
비고: 스키마 호환성 문제 해결
```