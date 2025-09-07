# Archive Directory

이 디렉토리에는 프로젝트에서 제거된 레거시 파일들이 보관되어 있습니다.

## 📁 Directory Structure

### legacy-template-docs/
2025-09-07에 제거된 중복되는 템플릿 관리 문서들:
- `TEMPLATE_VALIDATION_GUIDE.md` - 검증되지 않은 도구들 설명
- `TEMPLATE_MANAGEMENT_GUIDE.md` - 아키텍처 중심 가이드
- `TEMPLATE_EXECUTION_EXAMPLES.md` - 예시 중심 문서
- `TEMPLATE_USAGE_GUIDE.md` - 사용법 가이드
- `TEMPLATE_IMPORT_EXPORT.md` - Import/Export 도구 설명

### legacy-scripts/
2025-09-07에 제거된 검증되지 않은 스크립트들:
- `template-validator.ts` - 복잡한 검증 도구 (스키마 불일치 이슈)
- `template-fixer.ts` - 자동 수정 도구 (검증 필요)
- `template-health-monitor.ts` - 상태 모니터링 도구

## 🎯 제거 이유

**안전성 우선 원칙:**
- 검증되지 않은 도구들의 시스템 전체 적용 위험성
- `simple-validator.ts`로 핵심 기능 통합 완료
- 실용적이고 안전한 워크플로우로 정리

## 📚 현재 활성 문서들

**핵심 템플릿 관리 문서:**
- `docs/TEMPLATE_MANAGEMENT_PRACTICAL_GUIDE.md` - 💎 마스터 실무 가이드
- `TEMPLATE_CONVENTIONS.md` - ✅ 안전 규칙과 컨벤션  
- `VALIDATION_SYSTEM_STATUS.md` - 📊 현재 상태 리포트

**검증된 도구:**
- `scripts/simple-validator.ts` - ✅ 핵심 검증 및 Export 도구
- `package.json` 안전 스크립트들:
  - `bun run template:validate-single`
  - `bun run template:check-server`
  - `bun run template:backup`
  - `bun run template:restore`

## 🔄 복원 가능

필요시 이 아카이브에서 파일들을 복원할 수 있습니다. 단, 복원 전에 반드시 현재 시스템과의 호환성을 검증해야 합니다.