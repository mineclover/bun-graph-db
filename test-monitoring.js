#!/usr/bin/env node

/**
 * 메모리 모니터링 기능 테스트 스크립트
 * GraphQL 쿼리로 시스템 통계 및 메모리 상태를 확인합니다.
 */

const testQueries = [
  {
    name: "Health Check",
    query: `
      query HealthCheck {
        healthCheck {
          status
          timestamp
          database
          version
          memory {
            status
            percentage
            message
          }
        }
      }
    `
  },
  {
    name: "System Stats",
    query: `
      query SystemStats {
        systemStats {
          memory {
            used
            free
            total
            percentage
            heap {
              used
              total
              external
              arrayBuffers
            }
          }
          process {
            pid
            cpu
            version
            platform
          }
          database {
            connectionCount
            queryCount
            averageQueryTime
          }
          timestamp
          uptime
        }
      }
    `
  },
  {
    name: "Memory Stats Only",
    query: `
      query MemoryStats {
        memoryStats {
          used
          free
          total
          percentage
          heap {
            used
            total
            external
            arrayBuffers
          }
        }
      }
    `
  }
];

async function testMonitoring() {
  const serverUrl = 'http://localhost:4000/graphql';
  
  console.log('🔧 메모리 모니터링 기능 테스트 시작...\n');
  
  for (const test of testQueries) {
    console.log(`📊 ${test.name} 테스트 중...`);
    
    try {
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: test.query
        })
      });
      
      if (!response.ok) {
        console.log(`❌ HTTP 오류: ${response.status} ${response.statusText}`);
        continue;
      }
      
      const result = await response.json();
      
      if (result.errors) {
        console.log(`❌ GraphQL 오류:`);
        result.errors.forEach(error => {
          console.log(`   - ${error.message}`);
        });
      } else {
        console.log(`✅ 성공:`);
        console.log(JSON.stringify(result.data, null, 2));
      }
      
    } catch (error) {
      console.log(`❌ 네트워크 오류: ${error.message}`);
      console.log('   서버가 실행 중인지 확인하세요: bun run dev');
    }
    
    console.log('');
  }
  
  console.log('🏁 테스트 완료!');
  console.log('\n📋 메모리 모니터링 기능:');
  console.log('   • 실시간 메모리 사용량 추적');
  console.log('   • 시스템 상태 체크');
  console.log('   • 프로세스 정보 수집');
  console.log('   • 데이터베이스 성능 메트릭');
}

// 스크립트 실행
testMonitoring().catch(console.error);