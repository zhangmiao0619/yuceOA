#!/bin/bash
# OA 系统权限测试脚本
# 测试不同用户的API权限控制

BASE_URL="http://localhost:3000"

echo "========================================"
echo "OA 系统权限测试"
echo "========================================"
echo ""

# 登录函数
login() {
    local username=$1
    local password=$2
    local response=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"${username}\",\"password\":\"${password}\"}")
    echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4
}

# 测试API函数
test_api() {
    local token=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local desc=$5
    
    echo "测试: $desc"
    echo "  请求: $method $endpoint"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "${BASE_URL}${endpoint}" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "${BASE_URL}${endpoint}" \
            -H "Authorization: Bearer $token")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo "  ✅ 成功 (HTTP $http_code)"
    elif [ "$http_code" = "403" ]; then
        echo "  ❌ 无权访问 (HTTP $http_code)"
    elif [ "$http_code" = "401" ]; then
        echo "  ❌ 未授权 (HTTP $http_code)"
    else
        echo "  ⚠️  其他响应 (HTTP $http_code)"
    fi
    echo "  响应: $body"
    echo ""
}

# 测试用户
declare -A users=(
    ["test_manager"]="项目经理(有项目/任务/审批权限)"
    ["test_member"]="普通员工(仅查看/提交审批)"
    ["test_viewer"]="仅查看(只能看不能操作)"
    ["test_hr"]="人事专员(仅人事权限)"
    ["test_pm"]="项目助理(能创建但不能暂停)"
)

echo "1. 测试用户登录"
echo "========================================"
for user in "${!users[@]}"; do
    echo "登录 $user (${users[$user]})..."
    token=$(login "$user" "test123")
    if [ -n "$token" ]; then
        echo "  ✅ 登录成功"
        eval "TOKEN_${user^^}=\$token"
    else
        echo "  ❌ 登录失败"
    fi
done

echo ""
echo "2. 项目管理权限测试"
echo "========================================"

# 项目经理 - 应该有所有项目权限
echo "--- 项目经理 (test_manager) ---"
if [ -n "$TOKEN_TEST_MANAGER" ]; then
    test_api "$TOKEN_TEST_MANAGER" "GET" "/api/projects" "" "查看项目列表"
    test_api "$TOKEN_TEST_MANAGER" "POST" "/api/projects" '{"name":"测试项目","description":"权限测试项目"}' "创建项目"
fi

# 普通员工 - 只能查看
echo "--- 普通员工 (test_member) ---"
if [ -n "$TOKEN_TEST_MEMBER" ]; then
    test_api "$TOKEN_TEST_MEMBER" "GET" "/api/projects" "" "查看项目列表"
    test_api "$TOKEN_TEST_MEMBER" "POST" "/api/projects" '{"name":"测试项目2","description":"权限测试项目2"}' "创建项目(应失败)"
fi

# 仅查看 - 只能查看
echo "--- 仅查看用户 (test_viewer) ---"
if [ -n "$TOKEN_TEST_VIEWER" ]; then
    test_api "$TOKEN_TEST_VIEWER" "GET" "/api/projects" "" "查看项目列表"
    test_api "$TOKEN_TEST_VIEWER" "POST" "/api/projects" '{"name":"测试项目3","description":"权限测试项目3"}' "创建项目(应失败)"
fi

# 项目助理 - 能创建但不能暂停
echo "--- 项目助理 (test_pm) ---"
if [ -n "$TOKEN_TEST_PM" ]; then
    test_api "$TOKEN_TEST_PM" "GET" "/api/projects" "" "查看项目列表"
    test_api "$TOKEN_TEST_PM" "POST" "/api/projects" '{"name":"测试项目4","description":"权限测试项目4"}' "创建项目"
fi

# 人事专员 - 无权访问项目
echo "--- 人事专员 (test_hr) ---"
if [ -n "$TOKEN_TEST_HR" ]; then
    test_api "$TOKEN_TEST_HR" "GET" "/api/projects" "" "查看项目列表(应失败)"
    test_api "$TOKEN_TEST_HR" "POST" "/api/projects" '{"name":"测试项目5","description":"权限测试项目5"}' "创建项目(应失败)"
fi

echo ""
echo "3. 人事管理权限测试"
echo "========================================"

# 项目经理 - 应该能查看人事
echo "--- 项目经理 (test_manager) ---"
if [ -n "$TOKEN_TEST_MANAGER" ]; then
    test_api "$TOKEN_TEST_MANAGER" "GET" "/api/users" "" "查看用户列表"
fi

# 人事专员 - 应该有人事权限
echo "--- 人事专员 (test_hr) ---"
if [ -n "$TOKEN_TEST_HR" ]; then
    test_api "$TOKEN_TEST_HR" "GET" "/api/users" "" "查看用户列表"
    test_api "$TOKEN_TEST_HR" "GET" "/api/attendance/config" "" "查看考勤配置"
fi

# 普通员工 - 能查看
echo "--- 普通员工 (test_member) ---"
if [ -n "$TOKEN_TEST_MEMBER" ]; then
    test_api "$TOKEN_TEST_MEMBER" "GET" "/api/users" "" "查看用户列表"
    test_api "$TOKEN_TEST_MEMBER" "GET" "/api/attendance/config" "" "查看考勤配置"
fi

echo ""
echo "4. 审批流程权限测试"
echo "========================================"

# 项目经理 - 能提交和审批
echo "--- 项目经理 (test_manager) ---"
if [ -n "$TOKEN_TEST_MANAGER" ]; then
    test_api "$TOKEN_TEST_MANAGER" "GET" "/api/workflows/definitions" "" "查看审批流程"
fi

# 普通员工 - 只能提交
echo "--- 普通员工 (test_member) ---"
if [ -n "$TOKEN_TEST_MEMBER" ]; then
    test_api "$TOKEN_TEST_MEMBER" "GET" "/api/workflows/definitions" "" "查看审批流程"
fi

echo ""
echo "========================================"
echo "测试完成"
echo "========================================"
