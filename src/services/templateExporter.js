import * as XLSX from 'xlsx'
import { buildApiError, cleanJsonResponse } from './analysis'

export const templateDefinitions = [
  {
    id: 'import-bil',
    label: '模板导出 Excel 1',
    filename: 'importBil.xlsx',
    outputPrefix: '能力清单模板'
  },
  {
    id: 'import-topic',
    label: '模板导出 Excel 2',
    filename: 'importTopicTemplate2.xlsx',
    outputPrefix: '知识图谱模板'
  }
]

function buildTimestamp() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

function clearSheetRows(worksheet, startRow) {
  Object.keys(worksheet).forEach((key) => {
    if (key.startsWith('!')) {
      return
    }
    const match = key.match(/[A-Z]+(\d+)/)
    if (match && Number(match[1]) >= startRow) {
      delete worksheet[key]
    }
  })
}

function setCell(worksheet, address, value) {
  worksheet[address] = { t: 's', v: value ?? '' }
}

function writeImportBilRows(worksheet, rows) {
  clearSheetRows(worksheet, 3)
  rows.forEach((row, index) => {
    const rowIndex = index + 3
    setCell(worksheet, `A${rowIndex}`, row.name)
    setCell(worksheet, `B${rowIndex}`, row.tags)
    setCell(worksheet, `C${rowIndex}`, row.description)
    setCell(worksheet, `D${rowIndex}`, row.knowledge)
  })
  worksheet['!ref'] = `A1:D${Math.max(rows.length + 2, 2)}`
}

function writeImportTopicRows(worksheet, rows) {
  clearSheetRows(worksheet, 3)
  rows.forEach((row, index) => {
    const rowIndex = index + 3
    setCell(worksheet, `A${rowIndex}`, row.nodeType)
    ;['B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach((col) => {
      setCell(worksheet, `${col}${rowIndex}`, row[col] || '')
    })
    setCell(worksheet, `I${rowIndex}`, row.predecessors)
    setCell(worksheet, `J${rowIndex}`, row.successors)
    setCell(worksheet, `K${rowIndex}`, row.related)
    setCell(worksheet, `L${rowIndex}`, row.tags)
    setCell(worksheet, `M${rowIndex}`, row.knowledgeType)
    setCell(worksheet, `N${rowIndex}`, row.description)
  })
  worksheet['!ref'] = `A1:N${Math.max(rows.length + 2, 2)}`
}

async function requestTemplateRows(result, templateId, apiConfig) {
  const { apiKey, baseUrl, model } = apiConfig
  if (!apiKey?.trim()) {
    throw new Error('模板导出需要可用的 AI Key。请先在上方填写接口地址、模型和 API Key。')
  }

  const templatePrompt =
    templateId === 'import-bil'
      ? `
你要把职业标准分析结果填入 Excel 模板 importBil.xlsx。
请只输出 JSON：
{
  "rows": [
    {
      "name": "名称",
      "tags": "标签1;标签2",
      "description": "描述",
      "knowledge": "知识点1;知识点2"
    }
  ]
}

约束：
1. rows 数量与能力矩阵一一对应。
2. name 必须直接使用或轻微压缩能力名称，不要写“节点1”“能力1”。
3. tags 用分号分隔，优先使用能力类别、等级、岗位场景等短标签。
4. knowledge 必须写具体知识点，不要写 K1、K2。
5. description 写成便于导入的短说明，控制在 60 字内。
      `.trim()
      : `
你要把职业标准分析结果填入 Excel 模板 importTopicTemplate2.xlsx。
请只输出 JSON：
{
  "rows": [
    {
      "nodeType": "分类或知识点",
      "B": "",
      "C": "",
      "D": "",
      "E": "",
      "F": "",
      "G": "",
      "H": "",
      "predecessors": "",
      "successors": "",
      "related": "",
      "tags": "",
      "knowledgeType": "",
      "description": ""
    }
  ]
}

约束：
1. B-H 每行只能填一个节点名称，按层级从左到右放置。
2. 分类节点用于岗位、能力类别、能力项；知识点节点用于最外层能力支撑的具体知识内容。
3. knowledgeType 仅在 nodeType=知识点 时填写，值限定为：事实性、概念性、程序性、元认知。
4. 所有名称必须使用具体中文内容，不要出现 K1、K2、节点1 这类占位名。
5. 关系字段使用分号分隔，尽量只填当前模板内节点名称。
      `.trim()

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '你负责把职业标准分析结果整理成指定 Excel 模板需要的结构化 JSON。'
        },
        {
          role: 'user',
          content: `${templatePrompt}\n\n分析结果如下：\n${JSON.stringify(result, null, 2)}`
        }
      ]
    })
  })

  if (!response.ok) {
    throw await buildApiError(response)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('AI 模板填充返回内容为空。')
  }

  const parsed = JSON.parse(cleanJsonResponse(content))
  return Array.isArray(parsed.rows) ? parsed.rows : []
}

async function loadTemplateWorkbook(filename) {
  const response = await fetch(`/templates/${filename}`)
  if (!response.ok) {
    throw new Error(`模板文件读取失败：${filename}`)
  }
  const buffer = await response.arrayBuffer()
  return XLSX.read(buffer, { type: 'array' })
}

export async function exportTemplateWorkbook(result, template, apiConfig) {
  const workbook = await loadTemplateWorkbook(template.filename)
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = await requestTemplateRows(result, template.id, apiConfig)

  if (template.id === 'import-bil') {
    writeImportBilRows(worksheet, rows)
  } else {
    writeImportTopicRows(worksheet, rows)
  }

  XLSX.writeFile(workbook, `${template.outputPrefix}-${buildTimestamp()}.xlsx`)
}
