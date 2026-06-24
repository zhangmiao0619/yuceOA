import { db } from '../db/index.js'
import { workflowDefinitions } from '../schema/index.js'

// 审批流程定义初始化数据
const workflowDefinitionsData = [
  {
    name: '请假申请',
    type: 'leave',
    description: '员工请假审批流程，包括事假、病假、年假等',
    formSchema: {
      fields: [
        { name: 'leaveType', label: '请假类型', type: 'select', required: true, options: [
          { value: 'annual', label: '年假' },
          { value: 'sick', label: '病假' },
          { value: 'personal', label: '事假' },
          { value: 'marriage', label: '婚假' },
          { value: 'maternity', label: '产假/陪产假' },
          { value: 'bereavement', label: '丧假' },
          { value: 'other', label: '其他' }
        ]},
        { name: 'startDate', label: '开始日期', type: 'date', required: true },
        { name: 'endDate', label: '结束日期', type: 'date', required: true },
        { name: 'duration', label: '请假天数', type: 'number', required: true, min: 0.5, step: 0.5 },
        { name: 'reason', label: '请假事由', type: 'textarea', required: true, maxLength: 500 },
        { name: 'handover', label: '工作交接', type: 'textarea', maxLength: 300 },
        { name: 'attachment', label: '附件（病假条等）', type: 'file', multiple: true }
      ]
    },
    flowConfig: {
      steps: [
        { step: 0, name: '直属领导审批', approverType: 'directManager', required: true },
        { step: 1, name: '部门负责人审批', approverType: 'departmentHead', required: true, condition: 'duration > 3' },
        { step: 2, name: 'HR审批', approverType: 'hr', required: true, condition: 'duration > 7' }
      ]
    }
  },
  {
    name: '费用报销',
    type: 'expense',
    description: '员工费用报销审批流程',
    formSchema: {
      fields: [
        { name: 'expenseType', label: '报销类型', type: 'select', required: true, options: [
          { value: 'travel', label: '差旅费' },
          { value: 'office', label: '办公用品' },
          { value: 'meal', label: '业务招待' },
          { value: 'transport', label: '交通费' },
          { value: 'training', label: '培训费' },
          { value: 'other', label: '其他' }
        ]},
        { name: 'amount', label: '报销金额', type: 'number', required: true, min: 0 },
        { name: 'date', label: '发生日期', type: 'date', required: true },
          { name: 'description', label: '费用说明', type: 'textarea', required: true, maxLength: 500 },
        { name: 'invoice', label: '发票凭证', type: 'file', required: true, multiple: true },
        { name: 'relatedProject', label: '关联项目', type: 'text' },
        { name: 'budgetCode', label: '预算科目', type: 'text' }
      ]
    },
    flowConfig: {
      steps: [
        { step: 0, name: '直属领导审批', approverType: 'directManager', required: true },
        { step: 1, name: '财务审核', approverType: 'finance', required: true },
        { step: 2, name: '总经理审批', approverType: 'ceo', required: true, condition: 'amount > 5000' }
      ]
    }
  },
  {
    name: '采购申请',
    type: 'purchase',
    description: '办公用品、设备等采购审批流程',
    formSchema: {
      fields: [
        { name: 'itemName', label: '物品名称', type: 'text', required: true },
        { name: 'category', label: '物品类别', type: 'select', required: true, options: [
          { value: 'office', label: '办公用品' },
          { value: 'equipment', label: '设备' },
          { value: 'software', label: '软件' },
          { value: 'furniture', label: '家具' },
          { value: 'service', label: '服务' },
          { value: 'other', label: '其他' }
        ]},
        { name: 'quantity', label: '数量', type: 'number', required: true, min: 1 },
        { name: 'unitPrice', label: '单价', type: 'number', required: true, min: 0 },
        { name: 'totalAmount', label: '总价', type: 'number', required: true, min: 0 },
        { name: 'vendor', label: '供应商', type: 'text' },
        { name: 'reason', label: '采购理由', type: 'textarea', required: true, maxLength: 500 },
        { name: 'urgency', label: '紧急程度', type: 'select', required: true, options: [
          { value: 'low', label: '一般' },
          { value: 'medium', label: '较急' },
          { value: 'high', label: '紧急' }
        ]},
        { name: 'attachment', label: '报价单/附件', type: 'file', multiple: true }
      ]
    },
    flowConfig: {
      steps: [
        { step: 0, name: '部门负责人审批', approverType: 'departmentHead', required: true },
        { step: 1, name: '财务审核', approverType: 'finance', required: true },
        { step: 2, name: '总经理审批', approverType: 'ceo', required: true, condition: 'totalAmount > 10000' }
      ]
    }
  },
  {
    name: '外出申请',
    type: 'outing',
    description: '因公外出、外勤、出差申请',
    formSchema: {
      fields: [
        { name: 'outingType', label: '外出类型', type: 'select', required: true, options: [
          { value: 'business', label: '商务拜访' },
          { value: 'meeting', label: '会议' },
          { value: 'training', label: '培训' },
          { value: 'survey', label: '调研' },
          { value: 'other', label: '其他' }
        ]},
        { name: 'destination', label: '目的地', type: 'text', required: true },
        { name: 'startTime', label: '开始时间', type: 'datetime', required: true },
        { name: 'endTime', label: '结束时间', type: 'datetime', required: true },
        { name: 'purpose', label: '外出事由', type: 'textarea', required: true, maxLength: 500 },
        { name: 'companions', label: '同行人员', type: 'text' },
        { name: 'transport', label: '交通工具', type: 'select', options: [
          { value: 'company', label: '公司车辆' },
          { value: 'public', label: '公共交通' },
          { value: 'taxi', label: '出租车/网约车' },
          { value: 'private', label: '私家车' },
          { value: 'plane', label: '飞机' },
          { value: 'train', label: '火车' }
        ]},
        { name: 'contact', label: '紧急联系人', type: 'text' }
      ]
    },
    flowConfig: {
      steps: [
        { step: 0, name: '直属领导审批', approverType: 'directManager', required: true },
        { step: 1, name: '部门负责人审批', approverType: 'departmentHead', required: true, condition: 'outingType == business' }
      ]
    }
  }
]

export async function initWorkflowDefinitions() {
  console.log('开始初始化审批流程定义...')
  
  for (const def of workflowDefinitionsData) {
    // 检查是否已存在
    const existing = await db.query.workflowDefinitions.findFirst({
      where: (table, { eq }) => eq(table.type, def.type)
    })
    
    if (existing) {
      console.log(`流程定义 "${def.name}" 已存在，跳过`)
      continue
    }
    
    await db.insert(workflowDefinitions).values({
      name: def.name,
      type: def.type,
      description: def.description,
      formSchema: def.formSchema,
      flowConfig: def.flowConfig,
      isActive: true
    })
    
    console.log(`✅ 已创建流程定义: ${def.name}`)
  }
  
  console.log('审批流程定义初始化完成')
}

// 直接执行
if (import.meta.url === `file://${process.argv[1]}`) {
  initWorkflowDefinitions()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('初始化失败:', err)
      process.exit(1)
    })
}
