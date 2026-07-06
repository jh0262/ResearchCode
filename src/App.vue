<template>
  <PreviewPage v-if="isPreviewMode" />

  <div v-else class="page-shell">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Occupation Standard Intelligence Studio</p>
        <h1>国家职业标准能力图谱与知识图谱生成平台</h1>
        <p class="hero-text">
          上传或粘贴国家职业标准文本，先生成能力矩阵，再自动构建能力图谱与支撑知识图谱，并导出分析结果。
        </p>
      </div>
      <div class="hero-panel">
        <div class="stat-chip">
          <strong>{{ result?.summary.abilityCount ?? 0 }}</strong>
          <span>识别能力项</span>
        </div>
        <div class="stat-chip">
          <strong>{{ result?.summary.knowledgeCount ?? 0 }}</strong>
          <span>知识节点</span>
        </div>
        <div class="stat-chip">
          <strong>{{ result?.summary.categories?.length ?? 0 }}</strong>
          <span>能力类别</span>
        </div>
      </div>
    </header>

    <main class="main-grid">
      <section class="input-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">Step 1</p>
            <h2>输入国家职业标准</h2>
          </div>
          <label class="file-button">
            导入文件
            <input type="file" accept=".txt,.md,.docx,.pdf" @change="handleFileUpload" />
          </label>
        </div>

        <div class="mode-switch">
          <button
            v-for="item in runModes"
            :key="item.value"
            :class="['mode-pill', { active: form.mode === item.value }]"
            type="button"
            @click="form.mode = item.value"
          >
            {{ item.label }}
          </button>
        </div>

        <div class="ai-config">
          <input v-model="form.baseUrl" class="text-input" type="text" placeholder="接口地址，如 https://api.deepseek.com" />
          <input v-model="form.model" class="text-input" type="text" placeholder="模型名，如 deepseek-chat" />
          <input v-model="form.apiKey" class="text-input" type="password" placeholder="AI API Key（模板导出也会使用）" />
        </div>

        <textarea
          v-model="form.standardText"
          class="standard-input"
          placeholder="可直接粘贴国家职业标准正文，或导入 TXT / MD / DOCX / PDF。"
        />

        <div class="action-row">
          <button class="primary-button" type="button" :disabled="loading" @click="runAnalysis">
            {{ loading ? '分析中...' : '生成能力矩阵与图谱' }}
          </button>
          <button class="ghost-button" type="button" @click="loadDemo">载入示例</button>
        </div>
        <p class="hint">{{ statusText }}</p>
      </section>

      <section class="matrix-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">Step 2</p>
            <h2>能力矩阵</h2>
          </div>
          <button class="ghost-button" type="button" :disabled="!result" @click="handleMatrixExport">
            导出 CSV
          </button>
        </div>

        <div v-if="result" class="summary-banner">
          <div>
            <span>职业识别</span>
            <strong>{{ result.summary.occupationName }}</strong>
          </div>
          <div>
            <span>能力类别</span>
            <strong>{{ result.summary.categories.join(' / ') }}</strong>
          </div>
          <div>
            <span>分析模式</span>
            <strong>{{ result.mode === 'ai' ? 'AI 分析' : '本地规则分析' }}</strong>
          </div>
        </div>

        <div v-if="result" class="matrix-table-wrap">
          <table class="matrix-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>能力类别</th>
                <th>能力名称</th>
                <th>等级</th>
                <th>场景</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in result.matrix" :key="item.id">
                <td>{{ item.id }}</td>
                <td>{{ item.abilityType }}</td>
                <td>{{ item.abilityName }}</td>
                <td>{{ item.level }}</td>
                <td>{{ item.scenario }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty-state">生成后这里会展示能力矩阵与职业摘要。</div>
      </section>

      <GraphPanel
        v-if="result"
        title="能力图谱"
        eyebrow="Step 3"
        :graph="result.abilityGraph"
        @open-preview="openPreviewPage('能力图谱', 'ability-graph.png', result.abilityGraph)"
      />

      <GraphPanel
        v-if="result"
        title="知识图谱"
        eyebrow="Step 4"
        :graph="result.knowledgeGraph"
        @open-preview="openPreviewPage('知识图谱', 'knowledge-graph.png', result.knowledgeGraph)"
      />

      <section v-if="result" class="export-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">Step 5</p>
            <h2>导出结构化结果</h2>
          </div>
        </div>
        <div class="export-actions">
          <button class="primary-button" type="button" @click="exportGraphJson('ability-graph.json', result.abilityGraph)">
            导出能力图谱 JSON
          </button>
          <button class="primary-button" type="button" @click="exportGraphJson('knowledge-graph.json', result.knowledgeGraph)">
            导出知识图谱 JSON
          </button>
          <button class="ghost-button" type="button" @click="exportFullResult">
            导出完整分析结果 JSON
          </button>
          <button
            v-for="template in templateDefinitions"
            :key="template.id"
            class="ghost-button"
            type="button"
            :disabled="templateLoading === template.id"
            @click="handleTemplateExport(template)"
          >
            {{ templateLoading === template.id ? '模板生成中...' : template.label }}
          </button>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import GraphPanel from './components/GraphPanel.vue'
import PreviewPage from './components/PreviewPage.vue'
import { buildAiAnalysis, buildLocalAnalysis } from './services/analysis'
import { exportGraphJson, exportMatrixCsv, downloadTextFile } from './services/exporters'
import { savePreviewPayload } from './services/previewStore'
import { exportTemplateWorkbook, templateDefinitions } from './services/templateExporter'

const isPreviewMode = new URLSearchParams(window.location.search).has('preview')

const demoText = `国家职业标准（节选）
职业名称：智能制造设备运维员
职业概况：从事智能制造产线设备安装、调试、运行监控、故障诊断、维护保养与优化改进等工作。
工作任务1：识读设备技术文件，理解工艺流程与控制逻辑。
工作任务2：按照规范完成设备安装、调试与联机测试。
工作任务3：实施设备运行监控，记录关键工艺参数。
工作任务4：开展设备点检、维护保养及安全检查。
工作任务5：分析常见故障并完成诊断与排除。
工作任务6：组织质量改进、技术培训与现场协同。
工作任务7：应用数字化工具开展数据分析和持续优化。`

const runModes = [
  { label: '本地规则分析', value: 'local' },
  { label: 'AI 接口分析', value: 'ai' }
]

const form = reactive({
  mode: 'local',
  standardText: '',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat'
})

const loading = ref(false)
const templateLoading = ref('')
const result = ref(null)
const statusText = ref('支持粘贴文本，或上传 TXT / MD / DOCX / PDF 文件。模板导出会调用上方 AI 配置。')

function loadDemo() {
  form.standardText = demoText
  statusText.value = '已载入示例职业标准，可以直接执行分析。'
}

async function handleFileUpload(event) {
  const [file] = event.target.files || []
  if (!file) {
    return
  }

  try {
    statusText.value = `正在读取 ${file.name}...`
    const { readStandardFile } = await import('./services/fileParser')
    form.standardText = await readStandardFile(file)
    statusText.value = `已导入 ${file.name}，可以开始分析。`
  } catch (error) {
    statusText.value = error.message
  } finally {
    event.target.value = ''
  }
}

async function runAnalysis() {
  if (!form.standardText.trim()) {
    statusText.value = '请先提供国家职业标准文本。'
    return
  }

  loading.value = true
  statusText.value = form.mode === 'ai' ? '正在调用 AI 接口分析...' : '正在执行本地规则分析...'

  try {
    result.value =
      form.mode === 'ai'
        ? await buildAiAnalysis({
            standardText: form.standardText,
            apiKey: form.apiKey,
            baseUrl: form.baseUrl,
            model: form.model
          })
        : buildLocalAnalysis(form.standardText)
    statusText.value = `分析完成，已生成 ${result.value.summary.abilityCount} 项能力。`
  } catch (error) {
    statusText.value = error.message
  } finally {
    loading.value = false
  }
}

function handleMatrixExport() {
  if (!result.value) {
    return
  }
  exportMatrixCsv(result.value.matrix)
}

function openPreviewPage(title, filename, graph) {
  const previewId = savePreviewPayload({ title, filename, graph })
  const previewUrl = `${window.location.origin}${window.location.pathname}?preview=${previewId}`
  window.open(previewUrl, '_blank', 'noopener,noreferrer')
}

async function handleTemplateExport(template) {
  if (!result.value) {
    return
  }

  templateLoading.value = template.id
  statusText.value = `正在生成 ${template.label}...`

  try {
    await exportTemplateWorkbook(result.value, template, {
      apiKey: form.apiKey,
      baseUrl: form.baseUrl,
      model: form.model
    })
    statusText.value = `${template.label} 已生成并开始下载。`
  } catch (error) {
    statusText.value = error.message
  } finally {
    templateLoading.value = ''
  }
}

function exportFullResult() {
  if (!result.value) {
    return
  }
  downloadTextFile('occupation-analysis-result.json', JSON.stringify(result.value, null, 2))
}
</script>
