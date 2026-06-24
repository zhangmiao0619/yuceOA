import * as XLSX from 'xlsx';

export interface CropAuditRow {
  idCard: string;
  name?: string;
  group?: string;
  parcel?: string;
  rapeseedArea: number;
  rapeseedMax: number;
  wheatArea: number;
  wheatMax: number;
  scmjm: number;
}

export interface AuditResult {
  idCard: string;
  name?: string;
  group?: string;
  parcel?: string;
  rapeseedArea: number;
  rapeseedMax: number;
  wheatArea: number;
  wheatMax: number;
  scmjm: number;
  auditType: '油菜' | '小麦' | null;
  auditStatus: '面积够' | '面积不够' | '无油菜小麦';
  requiredArea: number;
  shortageArea: number;
}

export interface SupplementResult {
  idCard: string;
  name?: string;
  group: string;
  parcel: string;
  supplementType: '油菜' | '小麦';
  supplementArea: number;
  totalArea: number;
  maxAllowed: number;
}

interface GroupedNoCropData {
  [group: string]: {
    idCard: string;
    name?: string;
    group: string;
    parcel: string;
    scmjm: number;
    hasRapeseed: boolean;
    hasWheat: boolean;
  }[];
}

function parseNumber(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(String(value).replace(/[^\d.-]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

export function readExcelFile(filePath: string): CropAuditRow[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  return data.map((row: any) => ({
    idCard: String(row['身份证号'] || row['id_card'] || '').trim(),
    name: row['姓名'] || row['name'] || '',
    group: String(row['组别'] || row['group'] || '').trim(),
    parcel: String(row['地块'] || row['parcel'] || '').trim(),
    rapeseedArea: parseNumber(row['油菜面积'] || row['rapeseed_area']),
    rapeseedMax: parseNumber(row['油菜最大值'] || row['rapeseed_max']),
    wheatArea: parseNumber(row['小麦面积'] || row['wheat_area']),
    wheatMax: parseNumber(row['小麦最大值'] || row['wheat_max']),
    scmjm: parseNumber(row['实测面积SCMJM'] || row['scmjm'] || row['实测面积']),
  }));
}

export function auditCropArea(data: CropAuditRow[]): {
  auditResults: AuditResult[];
  insufficientIds: string[];
} {
  const results: AuditResult[] = [];
  const insufficientIds: string[] = [];

  const idCardMap = new Map<string, CropAuditRow[]>();
  data.forEach(row => {
    if (!row.idCard) return;
    if (!idCardMap.has(row.idCard)) {
      idCardMap.set(row.idCard, []);
    }
    idCardMap.get(row.idCard)!.push(row);
  });

  idCardMap.forEach((rows, idCard) => {
    const firstRow = rows[0];
    const hasRapeseed = firstRow.rapeseedArea > 0 || firstRow.rapeseedMax > 0;
    const hasWheat = firstRow.wheatArea > 0 || firstRow.wheatMax > 0;

    if (!hasRapeseed && !hasWheat) {
      results.push({
        ...firstRow,
        auditType: null,
        auditStatus: '无油菜小麦',
        requiredArea: 0,
        shortageArea: 0,
      });
      return;
    }

    const totalScmjm = rows.reduce((sum, r) => sum + r.scmjm, 0);
    const maxAllowed = Math.max(hasRapeseed ? firstRow.rapeseedMax : 0, hasWheat ? firstRow.wheatMax : 0);

    if (hasRapeseed && hasWheat) {
      const rapeseedValid = firstRow.rapeseedMax >= totalScmjm && totalScmjm >= firstRow.rapeseedArea;
      const wheatValid = firstRow.wheatMax >= totalScmjm && totalScmjm >= firstRow.wheatArea;

      if (rapeseedValid || wheatValid) {
        results.push({
          ...firstRow,
          auditType: rapeseedValid ? '油菜' : '小麦',
          auditStatus: '面积够',
          requiredArea: Math.max(firstRow.rapeseedArea, firstRow.wheatArea),
          shortageArea: 0,
        });
      } else {
        const shortage = Math.max(firstRow.rapeseedArea, firstRow.wheatArea) - totalScmjm;
        results.push({
          ...firstRow,
          auditType: firstRow.rapeseedMax >= firstRow.wheatMax ? '油菜' : '小麦',
          auditStatus: '面积不够',
          requiredArea: Math.max(firstRow.rapeseedArea, firstRow.wheatArea),
          shortageArea: shortage > 0 ? shortage : 0,
        });
        insufficientIds.push(idCard);
      }
    } else if (hasRapeseed) {
      if (firstRow.rapeseedMax >= totalScmjm && totalScmjm >= firstRow.rapeseedArea) {
        results.push({
          ...firstRow,
          auditType: '油菜',
          auditStatus: '面积够',
          requiredArea: firstRow.rapeseedArea,
          shortageArea: 0,
        });
      } else {
        const shortage = firstRow.rapeseedArea - totalScmjm;
        results.push({
          ...firstRow,
          auditType: '油菜',
          auditStatus: '面积不够',
          requiredArea: firstRow.rapeseedArea,
          shortageArea: shortage > 0 ? shortage : 0,
        });
        insufficientIds.push(idCard);
      }
    } else if (hasWheat) {
      if (firstRow.wheatMax >= totalScmjm && totalScmjm >= firstRow.wheatArea) {
        results.push({
          ...firstRow,
          auditType: '小麦',
          auditStatus: '面积够',
          requiredArea: firstRow.wheatArea,
          shortageArea: 0,
        });
      } else {
        const shortage = firstRow.wheatArea - totalScmjm;
        results.push({
          ...firstRow,
          auditType: '小麦',
          auditStatus: '面积不够',
          requiredArea: firstRow.wheatArea,
          shortageArea: shortage > 0 ? shortage : 0,
        });
        insufficientIds.push(idCard);
      }
    }
  });

  return { auditResults: results, insufficientIds };
}

export function findSupplements(
  data: CropAuditRow[],
  insufficientIds: string[]
): SupplementResult[] {
  const supplements: SupplementResult[] = [];

  const idCardMap = new Map<string, CropAuditRow[]>();
  data.forEach(row => {
    if (!row.idCard) return;
    if (!idCardMap.has(row.idCard)) {
      idCardMap.set(row.idCard, []);
    }
    idCardMap.get(row.idCard)!.push(row);
  });

  const noCropData: GroupedNoCropData = {};
  
  idCardMap.forEach((rows, idCard) => {
    const firstRow = rows[0];
    const hasRapeseed = firstRow.rapeseedArea > 0 || firstRow.rapeseedMax > 0;
    const hasWheat = firstRow.wheatArea > 0 || firstRow.wheatMax > 0;

    if (!hasRapeseed && !hasWheat) {
      rows.forEach(row => {
        const group = row.group || '未知';
        if (!noCropData[group]) {
          noCropData[group] = [];
        }
        noCropData[group].push({
          idCard: row.idCard,
          name: row.name,
          group: row.group,
          parcel: row.parcel,
          scmjm: row.scmjm,
          hasRapeseed: false,
          hasWheat: false,
        });
      });
    }
  });

  const idCardNeedMap = new Map<string, { shortage: number; type: '油菜' | '小麦'; maxAllowed: number }>();
  
  idCardMap.forEach((rows, idCard) => {
    if (!insufficientIds.includes(idCard)) return;
    
    const firstRow = rows[0];
    const totalScmjm = rows.reduce((sum, r) => sum + r.scmjm, 0);
    const hasRapeseed = firstRow.rapeseedArea > 0 || firstRow.rapeseedMax > 0;
    const hasWheat = firstRow.wheatArea > 0 || firstRow.wheatMax > 0;
    
    const shortage = Math.max(firstRow.rapeseedArea || 0, firstRow.wheatArea || 0) - totalScmjm;
    const maxAllowed = Math.max(firstRow.rapeseedMax || 0, firstRow.wheatMax || 0);
    
    let type: '油菜' | '小麦';
    if (hasRapeseed && hasWheat) {
      type = firstRow.rapeseedMax >= firstRow.wheatMax ? '油菜' : '小麦';
    } else if (hasRapeseed) {
      type = '油菜';
    } else {
      type = '小麦';
    }
    
    if (shortage > 0) {
      idCardNeedMap.set(idCard, { shortage, type, maxAllowed });
    }
  });

  idCardNeedMap.forEach((need, targetIdCard) => {
    const targetRows = idCardMap.get(targetIdCard);
    if (!targetRows || targetRows.length === 0) return;
    
    const targetGroup = targetRows[0].group || '未知';
    
    let availableInGroup = noCropData[targetGroup] || [];
    let remainingShortage = need.shortage;
    
    for (const noCrop of availableInGroup) {
      if (remainingShortage <= 0) break;
      
      const maxCanAdd = need.maxAllowed - (noCrop.scmjm || 0);
      if (maxCanAdd <= 0) continue;
      
      const addAmount = Math.min(remainingShortage, maxCanAdd);
      
      supplements.push({
        idCard: noCrop.idCard,
        name: noCrop.name,
        group: noCrop.group,
        parcel: noCrop.parcel,
        supplementType: need.type,
        supplementArea: addAmount,
        totalArea: (noCrop.scmjm || 0) + addAmount,
        maxAllowed: need.maxAllowed,
      });
      
      remainingShortage -= addAmount;
    }
    
    if (remainingShortage > 0) {
      for (const group in noCropData) {
        if (group === targetGroup) continue;
        if (remainingShortage <= 0) break;
        
        const availableInOtherGroup = noCropData[group];
        for (const noCrop of availableInOtherGroup) {
          if (remainingShortage <= 0) break;
          
          const maxCanAdd = need.maxAllowed - (noCrop.scmjm || 0);
          if (maxCanAdd <= 0) continue;
          
          const addAmount = Math.min(remainingShortage, maxCanAdd);
          
          supplements.push({
            idCard: noCrop.idCard,
            name: noCrop.name,
            group: noCrop.group,
            parcel: noCrop.parcel,
            supplementType: need.type,
            supplementArea: addAmount,
            totalArea: (noCrop.scmjm || 0) + addAmount,
            maxAllowed: need.maxAllowed,
          });
          
          remainingShortage -= addAmount;
        }
      }
    }
  });

  return supplements;
}

export function writeResultsToExcel(
  auditResults: AuditResult[],
  supplementResults: SupplementResult[],
  outputPath: string
): void {
  const auditSheet = XLSX.utils.json_to_sheet(auditResults.map(r => ({
    '身份证号': r.idCard,
    '姓名': r.name,
    '组别': r.group,
    '地块': r.parcel,
    '油菜面积': r.rapeseedArea,
    '油菜最大值': r.rapeseedMax,
    '小麦面积': r.wheatArea,
    '小麦最大值': r.wheatMax,
    '实测面积SCMJM': r.scmjm,
    '核对类型': r.auditType,
    '核对状态': r.auditStatus,
    '要求面积': r.requiredArea,
    '缺少面积': r.shortageArea,
  })));

  const supplementSheet = XLSX.utils.json_to_sheet(supplementResults.map(s => ({
    '身份证号': s.idCard,
    '姓名': s.name,
    '组别': s.group,
    '地块': s.parcel,
    '补充种类': s.supplementType,
    '补充面积': s.supplementArea,
    '总面积': s.totalArea,
    '允许最大值': s.maxAllowed,
  })));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, auditSheet, '核对结果');
  XLSX.utils.book_append_sheet(workbook, supplementSheet, '补充建议');

  XLSX.writeFile(workbook, outputPath);
}
