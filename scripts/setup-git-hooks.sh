#!/bin/bash

# Git Hooks 설정 스크립트
echo "🔧 Git Hooks 설정 중..."

# Pre-commit Hook 생성
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

echo "🔍 Pre-commit 검증 시작..."

# 스테이징된 템플릿 파일 찾기
STAGED_TEMPLATES=$(git diff --cached --name-only --diff-filter=ACM | grep "demo/templates/.*\.json$" || true)

if [ -n "$STAGED_TEMPLATES" ]; then
    echo "📋 변경된 템플릿 파일들:"
    echo "$STAGED_TEMPLATES"
    
    # 각 템플릿 파일에서 identifier 추출 후 검증
    for template_file in $STAGED_TEMPLATES; do
        # 파일명에서 identifier 추출 (예: search-templates-advanced_v1-0-0.json -> search-templates-advanced)
        template_id=$(basename "$template_file" | sed 's/_v[0-9-]*\.json$//')
        
        echo "🧪 검증 중: $template_id"
        
        # GraphQL 서버가 실행중인지 확인
        if ! curl -s http://localhost:4000/graphql -d '{"query":"query{__typename}"}' > /dev/null 2>&1; then
            echo "⚠️ GraphQL 서버가 실행중이지 않음 - 검증 건너뜀"
            echo "💡 서버 실행: bun run dev"
            continue
        fi
        
        # 템플릿 검증 실행
        if ! bun run template:validate-single "$template_id" > /dev/null 2>&1; then
            echo "❌ 템플릿 검증 실패: $template_id"
            echo "🔧 자동 수정 시도: bun run template:fix-and-export fix $template_id"
            exit 1
        fi
        
        echo "✅ 검증 통과: $template_id"
    done
else
    echo "ℹ️ 변경된 템플릿 파일 없음"
fi

# TypeScript 컴파일 검사
if git diff --cached --name-only --diff-filter=ACM | grep -E "\.(ts|tsx)$" > /dev/null; then
    echo "🔎 TypeScript 컴파일 검사..."
    if ! bun run typecheck; then
        echo "❌ TypeScript 컴파일 오류"
        exit 1
    fi
    echo "✅ TypeScript 검사 통과"
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
    echo "📋 Main 브랜치 push - 전체 템플릿 검증"
    
    # GraphQL 서버 확인
    if ! curl -s http://localhost:4000/graphql -d '{"query":"query{__typename}"}' > /dev/null 2>&1; then
        echo "❌ GraphQL 서버가 실행중이지 않음"
        echo "💡 서버 실행 후 다시 시도: bun run dev"
        exit 1
    fi
    
    # 핵심 템플릿들 검증
    core_templates=(
        "search-templates-advanced"
        "list-nodes-by-table" 
        "get-table-schema"
        "list-tables-with-pagination"
    )
    
    for template in "${core_templates[@]}"; do
        echo "🧪 검증 중: $template"
        if ! bun run template:validate-single "$template"; then
            echo "❌ 핵심 템플릿 검증 실패: $template"
            echo "🔧 수정 방법: bun run template:fix-and-export fix $template"
            exit 1
        fi
    done
    
    echo "✅ 전체 템플릿 검증 통과"
fi

echo "🎉 Pre-push 검증 완료!"
EOF

# Hook 파일들 실행 권한 부여
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/pre-push

echo "✅ Git Hooks 설정 완료!"
echo ""
echo "📝 설정된 Hook들:"
echo "  - Pre-commit: 변경된 템플릿 자동 검증"
echo "  - Pre-push: Main 브랜치 전체 템플릿 검증"
echo ""
echo "🔧 Hook 비활성화 방법:"
echo "  git commit --no-verify    # pre-commit 건너뜀"
echo "  git push --no-verify      # pre-push 건너뜀"