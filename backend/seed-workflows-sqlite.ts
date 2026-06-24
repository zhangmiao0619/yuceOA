import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const DB_PATH = process.env.DB_PATH || './data/oa_system.db'

// 确保数据目录存在
const dbDir = dirname(DB_PATH)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

const db = new Database(DB_PATH)

const definitions = [
  {
    name: '请假申请',
    type: 'leave',
    description: '员工请假审批流程，包括事假、病假、年假等',
    formSchema: JSON.stringify({
      fields: [
        { name: 'leaveType', label: '请假类型', type: 'select', required: true, options: [{ value: 'annual', label: '年假' }, { value: 'sick', label: '病假' }, { value: 'personal', label: '事假' }] },
        { name: 'startDate', label: '开始日期', type: 'date', required: true },
        { name: 'endDate', label: '结束日期', type: 'date', required: true },
        { name: 'duration', label: '请假天数', type: 'number', required: true, min: 0.5, step: 0.5 },
        { name: 'reason', label: '请假事由', type: 'textarea', required: true, maxLength: 500 }
      ]
    }),
    flowConfig: JSON.stringify({
      steps: [
        { step: 0, name: '直属领导审批', approverType: 'directManager', required: true },
        { step: 1, name: '部门负责人审批', approverType: 'departmentHead', required: true, condition: 'duration > 3' }
      ]
    })
  },
  {
    name: '费用报销',
    type: 'expense',
    description: '员工费用报销审批流程',
    formSchema: JSON.stringify({
      fields: [
        { name: 'expenseType', label: '报销类型', type: 'select', required: true, options: [{ value: 'travel', label: '差旅费' }, { value: 'office', label: '办公用品' }, { value: 'meal', label: '业务招待' }] },
        { name: 'amount', label: '报销金额', type: 'number', required: true, min: 0 },
        { name: 'date', label: '发生日期', type: 'date', required: true },
        { name: 'description', label: '费用说明', type: 'textarea', required: true },
        { name: 'invoice', label: '发票凭证', type: 'file', required: true }
      ]
    }),
    flowConfig: JSON.stringify({
      steps: [
        { step: 0, name: '直属领导审批', approverType: 'directManager', required: true },
        { step: 1, name: '财务审核', approverType: 'finance', required: true }
      ]
    })
  },
  {
    name: '采购申请',
    type: 'purchase',
    description: '办公用品、设备等采购审批流程',
    formSchema: JSON.stringify({
      fields: [
        { name: 'itemName', label: '物品名称', type: 'text', required: true },
        { name: 'category', label: '物品类别', type: 'select', required: true, options: [{ value: 'office', label: '办公用品' }, { value: 'equipment', label: '设备' }, { value: 'software', label: '软件' }] },
        { name: 'quantity', label: '数量', type: 'number', required: true, min: 1 },
        { name: 'unitPrice', label: '单价', type: 'number', required: true },
        { name: 'totalAmount', label: '总价', type: 'number', required: true },
        { name: 'reason', label: '采购理由', type: 'textarea', required: true }
      ]
    }),
    flowConfig: JSON.stringify({
      steps: [
        { step: 0, name: '部门负责人审批', approverType: 'departmentHead', required: true },
        { step: 1, name: '财务审核', approverType: 'finance', required: true },
        { step: 2, name: '总经理审批', approverType: 'ceo', required: true, condition: 'totalAmount > 10000' }
      ]
    })
  },
  {
    name: '外出申请',
    type: 'outing',
    description: '因公外出、外勤、出差申请',
    formSchema: JSON.stringify({
      fields: [
        { name: 'outingType', label: '外出类型', type: 'select', required: true, options: [{ value: 'business', label: '商务拜访' }, { value: 'meeting', label: '会议' }, { value: 'training', label: '培训' }] },
        { name: 'destination', label: '目的地', type: 'text', required: true },
        { name: 'startTime', label: '开始时间', type: 'datetime', required: true },
        { name: 'endTime', label: '结束时间', type: 'datetime', required: true },
        { name: 'purpose', label: '外出事由', type: 'textarea', required: true }
      ]
    }),
    flowConfig: JSON.stringify({
      steps: [
        { step: 0, name: '直属领导审批', approverType: 'directManager', required: true }
      ]
    })
  }
]

function uuid() {
  const hex = () => Math.floor(Math.random() * 16).toString(16)
  return `${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}-${hex()}${hex()}${hex()}${hex()}-4${hex()}${hex()}${hex()}-${hex()}${hex()}${hex()}${hex()}-${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}`
}

console.log('开始插入审批流程定义...\n')

const insert = db.prepare(`
  INSERT OR IGNORE INTO workflow_definitions (id, name, type, description, form_schema, flow_config, is_active, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
`)

for (const def of definitions) {
  try {
    const result = insert.run(uuid(), def.name, def.type, def.description, def.formSchema, def.flowConfig)
    if (result.changes > 0) {
      console.log(`✅ 已创建: ${def.name}`)
    } else {
      console.log(`⚠️  "${def.name}" 已存在，跳过`)
    }
  } catch (err) {
    console.error(`❌ 创建 "${def.name}" 失败:`, err)
  }
}

console.log('\n审批流程定义初始化完成！')
db.close()
