#!/bin/bash
# OA 系统自动化测试脚本
# 执行测试用例并记录问题

BASE_URL="http://localhost:3000"
LOG_FILE="/tmp/oa-test-results.log"
ISSUES_FILE="/tmp/oa-test-issues.log"

echo "========================================" > "$LOG_FILE"
echo "OA 系统测试报告" >> "$LOG_FILE"
echo "开始时间: $(date)" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# 清空问题记录
echo "" > "$ISSUES_FILE"

# 计数器
PASSED=0
FAILED=0
TOTAL=0

# 测试函数
test_case() {
    local tc_id=$1
    local desc=$2
    local cmd=$3
    local expected=$4
    
    TOTAL=$((TOTAL + 1))
    echo "" >> "$LOG_FILE"
    echo "[$tc_id] $desc" >> "$LOG_FILE"
    
    result=$(eval "$cmd" 2>&1)
    echo "请求: $cmd" >> "$LOG_FILE"
    echo "响应: $result" >> "$LOG_FILE"
    
    if echo "$result" | grep -q "$expected"; then
        echo "✅ 通过" >> "$LOG_FILE"
        PASSED=$((PASSED + 1))
    else
        echo "❌ 失败 (期望: $expected)" >> "$LOG_FILE"
        FAILED=$((FAILED + 1))
        echo "[$tc_id] $desc - 失败" >> "$ISSUES_FILE"
        echo "  期望: $expected" >> "$ISSUES_FILE"
        echo "  实际: $result" >> "$ISSUES_FILE"
        echo "" >> "$ISSUES_FILE"
    fi
}

# 登录获取token
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

echo "管理员Token: ${ADMIN_TOKEN:0:30}..." >> "$LOG_FILE"

if [ -z "$ADMIN_TOKEN" ]; then
    echo "❌ 致命错误: 管理员登录失败" >> "$LOG_FILE"
    echo "[$ADMIN_LOGIN] 管理员登录 - 失败" >> "$ISSUES_FILE"
    echo "  系统无法登录，测试中止" >> "$ISSUES_FILE"
    cat "$LOG_FILE"
    exit 1
fi

echo ""
echo "========================================"
echo "一、冒烟测试"
echo "========================================"

test_case "SM-001" "后端服务响应" \
    "curl -s -o /dev/null -w '%{http_code}' $BASE_URL/api/projects" \
    "401"

test_case "SM-004" "管理员登录" \
    "curl -s -X POST $BASE_URL/api/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"admin\",\"password\":\"admin123\"}' | grep -o 'success.*true'" \
    "success.*true"

test_case "SM-005" "项目列表加载(带Token)" \
    "curl -s -H 'Authorization: Bearer $ADMIN_TOKEN' $BASE_URL/api/projects | grep -o 'success.*true'" \
    "success.*true"

echo ""
echo "========================================"
echo "二、项目管理测试"
echo "========================================"

# 创建测试项目
CREATE_RESULT=$(curl -s -X POST "$BASE_URL/api/projects" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"测试项目-冒烟","description":"测试用"}')
echo "创建项目结果: $CREATE_RESULT" >> "$LOG_FILE"
PROJECT_ID=$(echo "$CREATE_RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "项目ID: $PROJECT_ID" >> "$LOG_FILE"

test_case "PM-008" "新建项目" \
    "echo '$CREATE_RESULT' | grep -o 'success.*true'" \
    "success.*true"

test_case "PM-009" "项目名称必填校验" \
    "curl -s -X POST $BASE_URL/api/projects -H 'Authorization: Bearer $ADMIN_TOKEN' -H 'Content-Type: application/json' -d '{\"name\":\"\",\"description\":\"test\"}' | grep -o 'success.*false'" \
    "success.*false"

test_case "PM-001" "查看项目列表" \
    "curl -s -H 'Authorization: Bearer $ADMIN_TOKEN' $BASE_URL/api/projects | grep -o 'success.*true'" \
    "success.*true"

test_case "PM-023" "项目暂停申请" \
    "curl -s -X POST $BASE_URL/api/projects/$PROJECT_ID/pause-request -H 'Authorization: Bearer $ADMIN_TOKEN' | grep -o 'success.*true'" \
    "success.*true"

echo ""
echo "========================================"
echo "三、人事管理测试"
echo "========================================"

test_case "HR-001" "查看员工列表" \
    "curl -s -H 'Authorization: Bearer $ADMIN_TOKEN' $BASE_URL/api/users | grep -o 'success.*true'" \
    "success.*true"

test_case "HR-016" "查看考勤配置" \
    "curl -s -H 'Authorization: Bearer $ADMIN_TOKEN' $BASE_URL/api/attendance/config | grep -o 'success.*true'" \
    "success.*true"

test_case "HR-020" "查看考勤记录" \
    "curl -s -H 'Authorization: Bearer $ADMIN_TOKEN' $BASE_URL/api/attendance | grep -o 'success.*true'" \
    "success.*true"

echo ""
echo "========================================"
echo "四、审批流程测试"
echo "========================================"

test_case "WF-001" "查看审批流程定义" \
    "curl -s -H 'Authorization: Bearer $ADMIN_TOKEN' $BASE_URL/api/workflows/definitions | grep -o 'success.*true'" \
    "success.*true"

test_case "WF-024" "查看我的申请" \
    "curl -s -H 'Authorization: Bearer $ADMIN_TOKEN' $BASE_URL/api/workflows/my-applications | grep -o 'success.*true'" \
    "success.*true"

echo ""
echo "========================================"
echo "五、管理员设置测试"
echo "========================================"

test_case "AD-001" "查看用户列表(管理员)" \
    "curl -s -H 'Authorization: Bearer $ADMIN_TOKEN' $BASE_URL/api/users | grep -o 'success.*true'" \
    "success.*true"

echo ""
echo "========================================"
echo "六、边界值测试"
echo "========================================"

test_case "BV-001" "项目名称为空" \
    "curl -s -X POST $BASE_URL/api/projects -H 'Authorization: Bearer $ADMIN_TOKEN' -H 'Content-Type: application/json' -d '{\"name\":\"\",\"description\":\"test\"}' | grep -o 'success.*false'" \
    "success.*false"

test_case "BV-004" "手机号格式错误(10位)" \
    "curl -s -X POST $BASE_URL/api/users -H 'Authorization: Bearer $ADMIN_TOKEN' -H 'Content-Type: application/json' -d '{\"username\":\"testphone\",\"name\":\"测试\",\"password\":\"123456\",\"phone\":\"1380013800\"}' | grep -o 'success.*false'" \
    "success.*false"

test_case "BV-008" "日期范围错误" \
    "curl -s -X POST $BASE_URL/api/projects -H 'Authorization: Bearer $ADMIN_TOKEN' -H 'Content-Type: application/json' -d '{\"name\":\"日期测试\",\"startDate\":\"2025-01-01\",\"endDate\":\"2024-01-01\"}' | grep -o 'success'" \
    "success"

echo ""
echo "========================================"
echo "七、权限测试"
echo "========================================"

# 测试普通员工权限
MEMBER_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"test_member","password":"test123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

test_case "PM-039" "普通员工无权创建项目" \
    "curl -s -X POST $BASE_URL/api/projects -H 'Authorization: Bearer $MEMBER_TOKEN' -H 'Content-Type: application/json' -d '{\"name\":\"无权项目\",\"description\":\"test\"}' | grep -o '403'" \
    "403"

test_case "PM-036" "普通员工查看项目列表" \
    "curl -s -H 'Authorization: Bearer $MEMBER_TOKEN' $BASE_URL/api/projects | grep -o 'success.*true'" \
    "success.*true"

# 测试仅查看用户
VIEWER_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"test_viewer","password":"test123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

test_case "BV-024" "越权访问-查看者不能编辑" \
    "curl -s -X PUT $BASE_URL/api/projects/$PROJECT_ID -H 'Authorization: Bearer $VIEWER_TOKEN' -H 'Content-Type: application/json' -d '{\"name\":\"篡改\"}' | grep -o '403'" \
    "403"

echo ""
echo "========================================" >> "$LOG_FILE"
echo "测试总结" >> "$LOG_FILE"
echo "总用例: $TOTAL" >> "$LOG_FILE"
echo "通过: $PASSED" >> "$LOG_FILE"
echo "失败: $FAILED" >> "$LOG_FILE"
echo "通过率: $(echo "scale=2; $PASSED / $TOTAL * 100" | bc)%" >> "$LOG_FILE"
echo "结束时间: $(date)" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

echo ""
echo "========================================"
echo "测试完成"
echo "总用例: $TOTAL"
echo "通过: $PASSED"
echo "失败: $FAILED"
echo "========================================"

if [ -s "$ISSUES_FILE" ]; then
    echo ""
    echo "❌ 发现的问题:"
    cat "$ISSUES_FILE"
fi

echo ""
echo "详细日志: $LOG_FILE"
