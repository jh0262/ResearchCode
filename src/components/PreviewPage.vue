<template>
  <div class="preview-page">
    <header class="preview-topbar">
      <div>
        <p class="eyebrow">Export Preview</p>
        <h1>{{ payload?.title || '图谱导出预览' }}</h1>
        <p class="preview-desc">
          独立预览页支持缩放文字、调整疏密并拖动节点，导出时会按当前预览布局生成 PNG。
        </p>
      </div>
      <div class="preview-actions">
        <button class="ghost-button" type="button" @click="closePreview">关闭窗口</button>
        <button class="primary-button" type="button" @click="exportPng">导出 PNG</button>
      </div>
    </header>

    <section v-if="payload" class="preview-workspace">
      <aside class="preview-sidebar">
        <label class="preview-control">
          <span>字体缩放</span>
          <input v-model.number="settings.fontScale" type="range" min="0.6" max="1.2" step="0.1" />
          <strong>{{ settings.fontScale.toFixed(1) }}x</strong>
        </label>
        <label class="preview-control">
          <span>图谱疏密</span>
          <input v-model.number="settings.radiusScale" type="range" min="0.9" max="1.8" step="0.1" />
          <strong>{{ settings.radiusScale.toFixed(1) }}x</strong>
        </label>
        <label class="preview-control checkbox">
          <input v-model="settings.showOutline" type="checkbox" />
          <span>附带右侧知识点明细</span>
        </label>
        <p class="preview-tip">拖动节点后可直接导出。调整滑块或勾选项时，预览数据会持续保留，不会被清空。</p>
      </aside>

      <div class="preview-stage">
        <div ref="chartRef" class="preview-canvas"></div>
      </div>
    </section>

    <section v-else class="preview-empty">
      <h2>没有可用的预览数据</h2>
      <p>请回到主页面重新点击“导出预览”。</p>
    </section>
  </div>
</template>

<script setup>
import { GraphChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TooltipComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { init, use } from 'echarts/core'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { createGraphOption } from '../services/graphChart'
import { loadPreviewPayload } from '../services/previewStore'

use([GraphChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer])

const payload = ref(loadPreviewPayload())
const chartRef = ref(null)
const settings = reactive({
  fontScale: payload.value?.graph?.nodes?.some((item) => item.category === 'knowledge') ? 0.7 : 0.9,
  radiusScale: payload.value?.graph?.nodes?.some((item) => item.category === 'knowledge') ? 1.45 : 1.15,
  showOutline: payload.value?.graph?.nodes?.some((item) => item.category === 'knowledge') ?? false
})
let chart

const optionSettings = computed(() => ({
  forExport: true,
  fontScale: settings.fontScale,
  radiusScale: settings.radiusScale,
  showOutline: settings.showOutline
}))

function renderChart() {
  if (!payload.value || !chartRef.value) {
    return
  }

  if (!chart) {
    chart = init(chartRef.value)
  }

  const width = chartRef.value.clientWidth || 1800
  const height = chartRef.value.clientHeight || 1100
  chart.resize({ width, height })
  chart.setOption(createGraphOption(payload.value.graph, width, height, optionSettings.value), {
    notMerge: true
  })
}

function exportPng() {
  if (!chart) {
    return
  }

  const link = document.createElement('a')
  link.href = chart.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: '#09101d'
  })
  link.download = payload.value?.filename || 'graph-preview.png'
  link.click()
}

function closePreview() {
  const homeUrl = `${window.location.origin}${window.location.pathname}`
  if (window.opener) {
    window.close()
    return
  }
  window.location.href = homeUrl
}

onMounted(() => {
  renderChart()
  window.addEventListener('resize', renderChart)
})

watch(
  () => [settings.fontScale, settings.radiusScale, settings.showOutline],
  async () => {
    await nextTick()
    renderChart()
  }
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', renderChart)
  chart?.dispose()
})
</script>

<style scoped>
.preview-page {
  min-height: 100vh;
  padding: 28px;
  background:
    radial-gradient(circle at top, rgba(42, 78, 132, 0.32), transparent 36%),
    #08101d;
}

.preview-topbar,
.preview-actions,
.preview-workspace {
  display: flex;
  gap: 18px;
}

.preview-topbar {
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 22px;
}

.preview-desc,
.preview-tip,
.preview-empty p {
  color: #9fb0ca;
}

.preview-workspace {
  min-height: calc(100vh - 160px);
}

.preview-sidebar {
  width: 320px;
  padding: 20px;
  border-radius: 24px;
  border: 1px solid rgba(157, 194, 255, 0.16);
  background: rgba(7, 16, 30, 0.72);
}

.preview-control {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  color: #d5d9e8;
}

.preview-control input[type='range'] {
  flex: 1;
}

.preview-control.checkbox {
  justify-content: flex-start;
}

.preview-stage {
  flex: 1;
  overflow: auto;
  border-radius: 28px;
  border: 1px solid rgba(157, 194, 255, 0.16);
  background: #09101d;
}

.preview-canvas {
  width: max(1680px, calc(100vw - 460px));
  min-height: max(980px, calc(100vh - 180px));
  border-radius: 28px;
  background: #09101d;
}

.preview-empty {
  padding: 60px 32px;
  border-radius: 24px;
  border: 1px solid rgba(157, 194, 255, 0.16);
  background: rgba(7, 16, 30, 0.72);
}

@media (max-width: 1100px) {
  .preview-topbar,
  .preview-workspace {
    flex-direction: column;
  }

  .preview-sidebar {
    width: 100%;
  }

  .preview-canvas {
    width: 1400px;
    min-height: 72vh;
  }
}
</style>
