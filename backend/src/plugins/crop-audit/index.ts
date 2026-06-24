import { Hono } from 'hono';
import { readExcelFile, auditCropArea, findSupplements, writeResultsToExcel } from './core.js';
import { unlink, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';

const cropAudit = new Hono();

const UPLOAD_DIR = path.join(process.cwd(), 'uploads/crop-audit');

cropAudit.post('/upload', async (c) => {
  try {
    const formData = await c.req.parseBody();
    const file = formData['file'] as File;
    
    if (!file) {
      return c.json({ error: '请上传文件' }, 400);
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return c.json({ error: '只支持 xlsx, xls, csv 格式' }, 400);
    }

    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const fileId = uuid();
    const fileName = `${fileId}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(filePath, buffer);

    const data = readExcelFile(filePath);
    
    await unlink(filePath);

    if (data.length === 0) {
      return c.json({ error: '文件中没有数据' }, 400);
    }

    const { auditResults, insufficientIds } = auditCropArea(data);

    const supplementResults = insufficientIds.length > 0 
      ? findSupplements(data, insufficientIds)
      : [];

    const outputFileName = `核对结果_${Date.now()}.xlsx`;
    const outputPath = path.join(UPLOAD_DIR, outputFileName);
    
    writeResultsToExcel(auditResults, supplementResults, outputPath);

    const sufficientCount = auditResults.filter(r => r.auditStatus === '面积够').length;
    const insufficientCount = auditResults.filter(r => r.auditStatus === '面积不够').length;
    const noCropCount = auditResults.filter(r => r.auditStatus === '无油菜小麦').length;

    return c.json({
      success: true,
      summary: {
        total: auditResults.length,
        sufficient: sufficientCount,
        insufficient: insufficientCount,
        noCrop: noCropCount,
      },
      results: auditResults,
      supplements: supplementResults,
      downloadUrl: `/uploads/crop-audit/${outputFileName}`,
    });

  } catch (error: any) {
    console.error('Crop audit error:', error);
    return c.json({ error: error.message || '处理失败' }, 500);
  }
});

cropAudit.get('/sample', async (c) => {
  const sampleData = [
    {
      '身份证号': '110101199001011234',
      '姓名': '张三',
      '组别': '一组',
      '地块': 'A1',
      '油菜面积': 5,
      '油菜最大值': 10,
      '小麦面积': 0,
      '小麦最大值': 0,
      '实测面积SCMJM': 6,
    },
    {
      '身份证号': '110101199001011234',
      '姓名': '张三',
      '组别': '一组',
      '地块': 'A2',
      '油菜面积': 0,
      '油菜最大值': 0,
      '小麦面积': 8,
      '小麦最大值': 12,
      '实测面积SCMJM': 9,
    },
    {
      '身份证号': '110101199001025678',
      '姓名': '李四',
      '组别': '二组',
      '地块': 'B1',
      '油菜面积': 3,
      '油菜最大值': 5,
      '小麦面积': 4,
      '小麦最大值': 6,
      '实测面积SCMJM': 10,
    },
    {
      '身份证号': '110101199001039999',
      '姓名': '王五',
      '组别': '二组',
      '地块': 'B2',
      '油菜面积': 0,
      '油菜最大值': 0,
      '小麦面积': 0,
      '小麦最大值': 0,
      '实测面积SCMJM': 2,
    },
  ];

  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }

  const samplePath = path.join(UPLOAD_DIR, '样例模板.xlsx');
  
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '油菜小麦核对');
  XLSX.writeFile(wb, samplePath);

  return c.json({
    downloadUrl: `/uploads/crop-audit/样例模板.xlsx`,
  });
});

export default cropAudit;
