const ABILITY_HINTS = [
  { tag: '职业道德', keywords: ['职业道德', '规范', '纪律', '诚信', '安全意识'] },
  { tag: '基础能力', keywords: ['基础知识', '基本要求', '通用能力', '职业基础'] },
  { tag: '专业技能', keywords: ['操作', '工艺', '技术', '实施', '执行', '装配', '检修', '检测', '调试', '安装'] },
  { tag: '分析诊断', keywords: ['分析', '诊断', '评估', '判断', '排查', '优化', '监测'] },
  { tag: '管理协同', keywords: ['管理', '组织', '协调', '沟通', '培训', '指导', '协同'] },
  { tag: '创新发展', keywords: ['创新', '改进', '研发', '新技术', '数字化', '智能化'] }
]

const PREFIX_PATTERNS = [
  /^工作任务\s*[0-9一二三四五六七八九十]+[:：]?\s*/u,
  /^任务\s*[0-9一二三四五六七八九十]+[:：]?\s*/u,
  /^技能要求\s*[0-9一二三四五六七八九十]+[:：]?\s*/u,
  /^能力要求\s*[0-9一二三四五六七八九十]+[:：]?\s*/u,
  /^[0-9]+(?:\.[0-9]+)*\s*/u
]

const NOISE_PATTERNS = [/^职业名称[:：]/u, /^职业概况[:：]/u, /^职业定义[:：]/u]

function normalizeLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function classifyAbility(line) {
  const matched = ABILITY_HINTS.find((item) => item.keywords.some((keyword) => line.includes(keyword)))
  return matched?.tag ?? '综合能力'
}

function stripPrefixes(text) {
  let current = text
  PREFIX_PATTERNS.forEach((pattern) => {
    current = current.replace(pattern, '')
  })
  return current.trim()
}

function cleanupAbilityText(text) {
  return stripPrefixes(text)
    .replace(/[；;。].*$/u, '')
    .replace(/[，,].*$/u, '')
    .replace(/\s+/g, '')
    .trim()
}

function deriveAbilityName(sourceText, abilityType) {
  const cleaned = cleanupAbilityText(sourceText)

  if (cleaned && cleaned.length >= 4 && cleaned.length <= 24) {
    return cleaned
  }

  if (cleaned.length > 24) {
    return cleaned.slice(0, 24)
  }

  return `${abilityType}要求`
}

function makeUniqueAbilityNames(matrix) {
  const seen = new Map()

  return matrix.map((item) => {
    const count = seen.get(item.abilityName) ?? 0
    seen.set(item.abilityName, count + 1)

    if (count === 0) {
      return item
    }

    return {
      ...item,
      abilityName: `${item.abilityName}（${count + 1}）`
    }
  })
}

function extractKnowledgeTopic(abilityItem) {
  const preferred = abilityItem.abilityName || cleanupAbilityText(abilityItem.sourceText || '')
  return preferred.replace(/（\d+）$/u, '').trim()
}

function extractKnowledgeTerms(text, topic) {
  const source = String(text || '')
  const normalized = source.replace(/[，。；：、,.]/g, ' ')
  const segments = normalized
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)

  const candidates = new Set()

  segments.forEach((segment) => {
    if (segment.length >= 4 && segment.length <= 18) {
      candidates.add(segment)
    }
  })

  ;[
    '数字孪生平台',
    '运行状态',
    '报警信息',
    '故障信息',
    '安装方法',
    '卸载方法',
    '监测方法',
    '报错处理',
    '联调测试',
    '模型设计',
    '环境部署',
    '数据采集',
    '测试用例',
    '测试指标',
    '操作规范',
    '工艺参数',
    '质量标准',
    '安全规范'
  ].forEach((keyword) => {
    if (source.includes(keyword)) {
      candidates.add(keyword)
    }
  })

  candidates.delete(topic)
  return [...candidates].slice(0, 3)
}

function extractClauseKnowledgePoints(abilityItem) {
  const source = String(abilityItem.sourceText || '')
  const clauses = [...source.matchAll(/(\d+(?:\.\d+){1,3})\s*([^0-9。；;]+)/gu)]
    .map((match) => {
      const clauseNo = match[1]?.trim()
      const clauseText = cleanupAbilityText(match[2] || '')
      if (!clauseNo || clauseText.length < 4) {
        return null
      }

      return `${clauseNo} ${clauseText}`.slice(0, 36)
    })
    .filter(Boolean)

  return [...new Set(clauses)].slice(0, 3)
}

function buildKnowledgePoints(abilityItem) {
  const topic = extractKnowledgeTopic(abilityItem)
  const clausePoints = extractClauseKnowledgePoints(abilityItem)

  if (clausePoints.length > 0) {
    return clausePoints.map((knowledge, index) => ({
      id: `${abilityItem.id}-k${index + 1}`,
      knowledge,
      relation: index === 0 ? '条文支撑' : '细项支撑'
    }))
  }

  const terms = extractKnowledgeTerms(abilityItem.sourceText, topic)
  const termA = terms[0] || `${topic}对象`
  const termB = terms[1] || `${topic}流程`
  const termC = terms[2] || `${topic}规范`
  const templates = {
    职业道德: [
      `${topic}相关职业规范、行为边界与${termC}要求`,
      `${topic}过程中的安全责任、风险红线与${termA}保护要求`,
      `${topic}涉及的法律法规、数据合规与责任追溯要求`
    ],
    基础能力: [
      `${topic}涉及的基础概念、术语定义与${termA}认知`,
      `${topic}相关原理、${termB}流程与关键环节`,
      `执行${topic}所需的基础标准依据、记录要求与${termC}要求`
    ],
    专业技能: [
      `${topic}的操作步骤、${termB}流程与关键工艺参数`,
      `${topic}所需设备、工具、平台对象与${termA}配置要求`,
      `${topic}的质量验收标准、异常处理方法与${termC}要求`
    ],
    分析诊断: [
      `${topic}的现象识别特征、${termA}异常表现与原因分类`,
      `${topic}的诊断步骤、判定依据、${termB}采集方法与分析口径`,
      `${topic}的处置流程、优化策略、复盘要点与${termC}要求`
    ],
    管理协同: [
      `${topic}的任务分解、岗位分工与${termA}协同关系`,
      `${topic}中的沟通机制、记录要求、${termB}交付节点与反馈闭环`,
      `${topic}的过程管控标准、培训指导方法与${termC}要求`
    ],
    创新发展: [
      `${topic}相关数字工具、${termA}平台能力与具体使用方法`,
      `${topic}的改进路径、${termB}优化指标与评估方法`,
      `${topic}涉及的新技术趋势、${termC}方法与应用场景`
    ],
    综合能力: [
      `${topic}涉及的关键概念、${termA}对象与业务场景`,
      `${topic}的实施流程、${termB}方法步骤与质量要求`,
      `${topic}中常见问题、风险点、处置原则与${termC}要求`
    ]
  }

  const defaults = templates[abilityItem.abilityType] ?? templates.综合能力
  return defaults.map((knowledge, index) => ({
    id: `${abilityItem.id}-k${index + 1}`,
    knowledge,
    relation: index === 0 ? '核心支撑' : '关联支撑'
  }))
}

function buildAbilityGraph(matrix, occupationName) {
  const categories = [...new Set(matrix.map((item) => item.abilityType))]
  const categoryNodes = categories.map((category) => ({
    id: `category-${category}`,
    name: category,
    category,
    symbolSize: 42,
    depth: 1
  }))

  return {
    nodes: [
      { id: 'root', name: occupationName, category: 'root', symbolSize: 60, depth: 0 },
      ...categoryNodes,
      ...matrix.map((item) => ({
        id: item.id,
        name: item.abilityName,
        category: item.abilityType,
        symbolSize: 28,
        depth: 2
      }))
    ],
    links: [
      ...categoryNodes.map((node) => ({
        source: 'root',
        target: node.id,
        value: '能力类别'
      })),
      ...matrix.map((item) => ({
        source: `category-${item.abilityType}`,
        target: item.id,
        value: item.level
      }))
    ]
  }
}

function buildKnowledgeGraph(matrix, occupationName) {
  const knowledgeGraphNodes = [{ id: 'job', name: occupationName, category: 'root', symbolSize: 58, depth: 0 }]
  const knowledgeGraphLinks = []

  matrix.forEach((item) => {
    knowledgeGraphNodes.push({
      id: item.id,
      name: item.abilityName,
      category: item.abilityType,
      symbolSize: 28,
      depth: 1
    })
    knowledgeGraphLinks.push({ source: 'job', target: item.id, value: '能力模块' })

    buildKnowledgePoints(item).forEach((knowledgePoint) => {
      knowledgeGraphNodes.push({
        id: knowledgePoint.id,
        name: knowledgePoint.knowledge,
        category: 'knowledge',
        symbolSize: 20,
        depth: 2
      })
      knowledgeGraphLinks.push({
        source: item.id,
        target: knowledgePoint.id,
        value: knowledgePoint.relation
      })
    })
  })

  return {
    nodes: knowledgeGraphNodes,
    links: knowledgeGraphLinks
  }
}

function normalizeMatrix(matrix) {
  return makeUniqueAbilityNames(
    matrix.map((item, index) => {
      const sourceText = String(item.sourceText ?? '').trim()
      const abilityType = item.abilityType || classifyAbility(sourceText)

      return {
        id: item.id || `A${index + 1}`,
        sourceText,
        abilityType,
        abilityName: deriveAbilityName(item.abilityName || sourceText, abilityType),
        level: item.level || '基础',
        scenario: (item.scenario || cleanupAbilityText(sourceText) || sourceText).slice(0, 36)
      }
    })
  )
}

function finalizeAnalysis(mode, lines, matrix, summary = {}) {
  const normalizedMatrix = normalizeMatrix(matrix)
  const categories = [...new Set(normalizedMatrix.map((item) => item.abilityType))]
  const occupationName = summary.occupationName || lines[0]?.slice(0, 24) || '未识别职业'
  const knowledgeGraph = buildKnowledgeGraph(normalizedMatrix, occupationName)

  return {
    mode,
    summary: {
      occupationName,
      abilityCount: normalizedMatrix.length,
      knowledgeCount: knowledgeGraph.nodes.filter((item) => item.category === 'knowledge').length,
      categories
    },
    matrix: normalizedMatrix,
    abilityGraph: buildAbilityGraph(normalizedMatrix, occupationName),
    knowledgeGraph
  }
}

export function buildLocalAnalysis(rawText) {
  const lines = normalizeLines(rawText)
  const seedLines = lines.filter((line) => {
    if (NOISE_PATTERNS.some((pattern) => pattern.test(line))) {
      return false
    }

    const cleaned = cleanupAbilityText(line)
    return cleaned.length >= 4
  })

  const abilitySeedLines = (seedLines.length > 0 ? seedLines : lines).slice(0, 18)
  const matrix = abilitySeedLines.map((line, index) => ({
    id: `A${index + 1}`,
    sourceText: line,
    abilityType: classifyAbility(line),
    abilityName: deriveAbilityName(line, classifyAbility(line)),
    level: line.includes('高级') || line.includes('技师') ? '高级' : line.includes('中级') ? '中级' : '基础',
    scenario: cleanupAbilityText(line).slice(0, 36)
  }))

  return finalizeAnalysis('local', lines, matrix)
}

export function cleanJsonResponse(text) {
  return text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
}

export async function buildApiError(response) {
  let payload = null

  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  const apiError = payload?.error

  if (response.status === 429) {
    if (apiError?.code === 'insufficient_quota') {
      return new Error('AI 接口调用失败：当前 API Key 可用额度不足或账单未开通（429 insufficient_quota）。请检查账户余额、项目配额，或更换可用 Key。')
    }

    return new Error(`AI 接口调用失败：请求被限流或配额不足（429${apiError?.code ? ` ${apiError.code}` : ''}）。请稍后重试，或检查该 Key/项目的 RPM、TPM 与额度限制。`)
  }

  if (response.status === 401) {
    return new Error('AI 接口调用失败：API Key 无效，或该 Key 无权访问当前项目。')
  }

  if (response.status === 403) {
    return new Error('AI 接口调用失败：当前 Key 被拒绝访问。请检查项目权限、组织设置或网络策略。')
  }

  if (response.status === 404) {
    return new Error(`AI 接口调用失败：未找到接口或模型。请确认 Base URL 和模型名是否正确。${apiError?.message ? ` 详情：${apiError.message}` : ''}`)
  }

  if (apiError?.message) {
    return new Error(`AI 接口调用失败：${apiError.message}（HTTP ${response.status}）`)
  }

  return new Error(`AI 接口调用失败：HTTP ${response.status} ${response.statusText}`)
}

export async function buildAiAnalysis({ standardText, apiKey, baseUrl, model }) {
  const prompt = `
你是一名职业教育与能力建模专家。请根据用户提供的国家职业标准文本，输出严格 JSON，不要输出额外说明。

JSON 结构如下：
{
  "summary": {
    "occupationName": "职业名称"
  },
  "matrix": [
    {
      "id": "A1",
      "sourceText": "原始标准片段",
      "abilityType": "能力类别",
      "abilityName": "具体能力名称",
      "level": "基础/中级/高级",
      "scenario": "典型场景"
    }
  ]
}

约束：
1. matrix 至少输出 6 项，最多输出 20 项。
2. abilityName 必须是具体能力短语，例如“设备安装调试”“故障诊断与排除”，不能输出“专业技能1”“综合能力2”这类泛化占位名称。
3. 保持中文输出。
4. 结果必须可直接 JSON.parse。

国家职业标准文本如下：
${standardText}
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
          content: '你专门负责职业标准的能力建模与知识建模。'
        },
        {
          role: 'user',
          content: prompt
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
    throw new Error('AI 接口返回内容为空')
  }

  const parsed = JSON.parse(cleanJsonResponse(content))
  const lines = normalizeLines(standardText)
  return finalizeAnalysis('ai', lines, parsed.matrix ?? [], parsed.summary ?? {})
}
