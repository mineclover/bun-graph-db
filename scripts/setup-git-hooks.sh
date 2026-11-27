#!/bin/bash

# Git Hooks 설정 스크립트
echo "🔧 Git Hooks 설정 중..."

# Pre-commit Hook 생성
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

echo "🔍 Pre-commit 검증 시작..."

# TypeScript 및 정적 게이트 검사
if git diff --cached --name-only --diff-filter=ACM | grep -E "\.(ts|tsx|graphql|md|json)$" > /dev/null; then
    echo "🔎 정적 품질 게이트 검사 (pnpm run check:static)..."
    if ! pnpm run check:static; then
        echo "❌ 정적 게이트 오류"
        exit 1
    fi
    echo "✅ 정적 게이트 통과"
fi

echo "🎉 Pre-commit 검증 완료!"
EOF

# Pre-push Hook 생성
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash

echo "🚀 Pre-push 검증 시작..."

# Push 하려는 브랜치 확인
branch=$(git rev-parse --abbrev-ref HEAD)

if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
    echo "📋 Main 브랜치 push - 테스트 레인 및 투영 계약 검증"

    if ! pnpm run test:lanes:audit || ! pnpm run projection:check; then
        echo "❌ 테스트 레인 또는 투영 계약 검증 실패"
        exit 1
    fi

    # GraphQL 서버가 실행 중이면 헬스 체크
    if curl -sf http://localhost:4141/health > /dev/null 2>&1; then
        echo "✅ 실행 중인 서버(/health) 확인 통과"
    fi
fi

echo "🎉 Pre-push 검증 완료!"
EOF

# Hook 파일들 실행 권한 부여
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/pre-push

echo "✅ Git Hooks 설정 완료!"
echo ""
echo "📝 설정된 Hook들:"
echo "  - Pre-commit: pnpm run check:static"
echo "  - Pre-push: Main 브랜치 test:lanes:audit & projection:check"
echo ""
echo "🔧 Hook 비활성화 방법:"
echo "  git commit --no-verify    # pre-commit 건너뜀"
echo "  git push --no-verify      # pre-push 건너뜀"
