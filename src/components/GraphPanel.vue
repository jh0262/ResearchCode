<template>
  <section class="graph-card">
    <div class="section-head">
      <div>
        <p class="eyebrow">{{ eyebrow }}</p>
        <h3>{{ title }}</h3>
      </div>
      <button class="ghost-button" type="button" @click="emit('open-preview')">导出预览</button>
    </div>
    <div ref="chartRef" class="graph-canvas"></div>
  </section>
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
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createGraphOption } from '../services/graphChart'

use([GraphChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer])

const props = defineProps({
  title: { type: String, required: true },
  eyebrow: { type: String, required: true },
  graph: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['open-preview'])
const chartRef = ref(null)
let chart

function renderChart() {
  if (!chartRef.value) {
    return
  }

  if (!chart) {
    chart = init(chartRef.value)
  }

  const width = chartRef.value.clientWidth || 640
  const height = chartRef.value.clientHeight || 440
  chart.setOption(createGraphOption(props.graph, width, height))
}

onMounted(() => {
  renderChart()
  window.addEventListener('resize', renderChart)
})

watch(
  () => props.graph,
  () => {
    renderChart()
  },
  { deep: true }
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', renderChart)
  chart?.dispose()
})
</script>
