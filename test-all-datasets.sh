#!/bin/bash

echo "🧪 Testing All Datasets"
echo "======================"

success_count=0
total_count=0

# Function to test a single dataset
test_dataset() {
    local dataset_path="$1"
    local relative_path=$(echo "$dataset_path" | sed 's|demo/datasets/||')
    
    echo ""
    echo "📋 Testing: $relative_path"
    
    total_count=$((total_count + 1))
    
    if bun run demo:test-dataset "$relative_path" >/dev/null 2>&1; then
        echo "✅ SUCCESS"
        success_count=$((success_count + 1))
    else
        echo "❌ FAILED"
    fi
}

# Test all datasets
for dataset in $(find demo/datasets -name "*.json" | sort); do
    test_dataset "$dataset"
done

echo ""
echo "📊 Results: $success_count/$total_count datasets passed"
echo "======================"

if [ $success_count -eq $total_count ]; then
    echo "🎉 All datasets passed!"
    exit 0
else
    echo "⚠️  Some datasets failed"
    exit 1
fi