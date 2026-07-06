function polarToCartesian(centerX, centerY, radius, angle) {
  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius
  }
}

function buildKnowledgeOutline(graph) {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
  const groups = []

  graph.links.forEach((link) => {
    const source = typeof link.source === 'object' ? link.source.id : link.source
    const target = typeof link.target === 'object' ? link.target.id : link.target
    const sourceNode = nodesById.get(source)
    const targetNode = nodesById.get(target)

    if (sourceNode?.category !== 'knowledge' && targetNode?.category === 'knowledge') {
      let group = groups.find((item) => item.id === source)
      if (!group) {
        group = { id: source, title: sourceNode.name, items: [] }
        groups.push(group)
      }
      group.items.push(targetNode.name)
    }
  })

  return groups.filter((group) => group.items.length > 0)
}

function buildPositionedNodes(graph, width, height, topPadding, graphWidthRatio = 1, radiusScale = 1) {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, { ...node }]))
  const childMap = new Map()

  graph.links.forEach((link) => {
    const source = typeof link.source === 'object' ? link.source.id : link.source
    const target = typeof link.target === 'object' ? link.target.id : link.target
    if (!childMap.has(source)) {
      childMap.set(source, [])
    }
    childMap.get(source).push(target)
  })

  const rootNode = graph.nodes.find((item) => item.category === 'root')
  if (!rootNode) {
    return graph.nodes
  }

  const graphWidth = width * graphWidthRatio
  const centerX = graphWidth / 2
  const usableHeight = height - topPadding - 24
  const centerY = topPadding + usableHeight / 2
  const minDimension = Math.min(graphWidth - 80, usableHeight - 40)
  const radiusByDepth = {
    0: 0,
    1: minDimension * 0.16 * radiusScale,
    2: minDimension * 0.33 * radiusScale,
    3: minDimension * 0.48 * radiusScale
  }

  function getSubtreeSize(nodeId) {
    const children = childMap.get(nodeId) || []
    if (children.length === 0) {
      return 1
    }
    return children.reduce((sum, childId) => sum + getSubtreeSize(childId), 0)
  }

  function placeChildren(parentId, startAngle, endAngle) {
    const children = childMap.get(parentId) || []
    if (children.length === 0) {
      return
    }

    const total = children.reduce((sum, childId) => sum + getSubtreeSize(childId), 0)
    let cursor = startAngle

    children.forEach((childId) => {
      const childNode = nodesById.get(childId)
      if (!childNode) {
        return
      }

      const weight = getSubtreeSize(childId)
      const span = ((endAngle - startAngle) * weight) / total
      const mid = cursor + span / 2
      const radius = radiusByDepth[childNode.depth] ?? minDimension * 0.58
      const point = polarToCartesian(centerX, centerY, radius, mid)

      childNode.x = point.x
      childNode.y = point.y

      const nextSpan = Math.max(span * 0.76, Math.PI / 7)
      placeChildren(childId, mid - nextSpan / 2, mid + nextSpan / 2)
      cursor += span
    })
  }

  const root = nodesById.get(rootNode.id)
  root.x = centerX
  root.y = centerY
  placeChildren(rootNode.id, -Math.PI, Math.PI)

  return graph.nodes.map((node) => nodesById.get(node.id) || node)
}

function splitLabel(text, width = 8) {
  const clean = String(text || '').trim()
  if (clean.length <= width) {
    return clean
  }

  const parts = []
  for (let index = 0; index < clean.length; index += width) {
    parts.push(clean.slice(index, index + width))
  }

  return parts.slice(0, 3).join('\n')
}

function getLabelWidthByNode(data, forExport) {
  if (data.category === 'root') {
    return 10
  }

  if (data.category === 'knowledge') {
    return forExport ? 10 : 8
  }

  return forExport ? 7 : 6
}

function estimateNodeSymbolSize(data, forExport, fontScale) {
  const labelWidth = getLabelWidthByNode(data, forExport)
  const labelText = splitLabel(data.name || '', labelWidth)
  const lines = labelText.split('\n').filter(Boolean)
  const longestLineLength = lines.reduce((max, line) => Math.max(max, line.length), 0)
  const lineCount = Math.max(lines.length, 1)
  const fontSize = (forExport ? 14 : 10) * fontScale
  const baseHeight = lineCount * fontSize + (forExport ? 12 : 10)
  const baseWidth = longestLineLength * fontSize + (forExport ? 18 : 16)

  if (data.category === 'root') {
    return [
      Math.max(baseWidth + 18, forExport ? 74 : 58),
      Math.max(baseHeight + 14, forExport ? 48 : 38)
    ]
  }

  if (data.category === 'knowledge') {
    return [
      Math.max(baseWidth + 12, forExport ? 62 : 42),
      Math.max(baseHeight + 10, forExport ? 32 : 24)
    ]
  }

  return [
    Math.max(baseWidth + 14, forExport ? 68 : 46),
    Math.max(baseHeight + 12, forExport ? 36 : 26)
  ]
}

function buildExportGraphic(graph, width, height) {
  const outline = buildKnowledgeOutline(graph)
  if (outline.length === 0) {
    return []
  }

  const left = width * 0.66 + 24
  const availableWidth = width - left - 24
  const elements = [
    {
      type: 'text',
      left,
      top: 28,
      style: {
        text: '知识点明细',
        fill: '#f4f7fb',
        font: '700 22px "Noto Sans SC"',
        width: availableWidth
      }
    }
  ]

  let cursorY = 66
  outline.forEach((group) => {
    elements.push({
      type: 'text',
      left,
      top: cursorY,
      style: {
        text: group.title,
        fill: '#ffbc7d',
        font: '700 16px "Noto Sans SC"',
        width: availableWidth
      }
    })
    cursorY += 28

    group.items.forEach((item, index) => {
      elements.push({
        type: 'text',
        left,
        top: cursorY,
        style: {
          text: `${index + 1}. ${item}`,
          fill: '#d5d9e8',
          font: '400 13px "Noto Sans SC"',
          width: availableWidth,
          overflow: 'break',
          lineHeight: 18
        }
      })
      cursorY += Math.max(22, Math.ceil(item.length / 18) * 18)
    })

    cursorY += 12
  })

  return elements
}

export function createGraphOption(graph, width, height, options = {}) {
  const {
    forExport = false,
    fontScale = 1,
    radiusScale = 1,
    showOutline = false
  } = options
  const legendTop = 8
  const topPadding = forExport ? 120 : 88
  const isKnowledgeGraph = graph.nodes.some((item) => item.category === 'knowledge')
  const graphWidthRatio = forExport && isKnowledgeGraph && showOutline ? 0.64 : 1
  const positionedNodes = buildPositionedNodes(graph, width, height, topPadding, graphWidthRatio, radiusScale)

  return {
    animationDuration: 900,
    animationEasingUpdate: 'cubicOut',
    tooltip: {
      trigger: 'item',
      formatter(params) {
        const source = params.data?.sourceText
        const detail = params.data?.fullName && params.data.fullName !== params.name ? `<br/>${params.data.fullName}` : ''
        return source ? `${params.name}${detail}<br/>${source}` : `${params.name}${detail}`
      }
    },
    legend: {
      top: legendTop,
      left: 12,
      right: 12,
      itemWidth: forExport ? 20 : 24,
      itemHeight: forExport ? 11 : 14,
      textStyle: {
        color: '#d5d9e8',
        fontSize: (forExport ? 15 : 11) * fontScale
      },
      selectedMode: false
    },
    graphic: forExport && showOutline ? buildExportGraphic(graph, width, height) : [],
    series: [
      {
        type: 'graph',
        layout: 'none',
        roam: true,
        draggable: true,
        top: topPadding,
        bottom: 12,
        left: 12,
        right: 12,
        label: {
          show: true,
          color: '#f7f9ff',
          fontSize: (forExport ? 14 : 10) * fontScale,
          width: forExport ? 150 : 72,
          overflow: 'break',
          lineHeight: (forExport ? 18 : 14) * fontScale,
          formatter(params) {
            const data = params.data || {}
            const labelWidth = getLabelWidthByNode(data, forExport)
            return splitLabel(data.name || '', labelWidth)
          }
        },
        labelLayout: {
          hideOverlap: true,
          moveOverlap: 'shiftY'
        },
        lineStyle: {
          color: 'source',
          curveness: 0.12,
          opacity: 0.7
        },
        categories: [
          { name: 'root' },
          { name: 'knowledge' },
          ...[...new Set(graph.nodes.map((item) => item.category))]
            .filter((item) => !['root', 'knowledge'].includes(item))
            .map((item) => ({ name: item }))
        ],
        data: graph.nodes.map((item) => ({
          ...(positionedNodes.find((node) => node.id === item.id) || item),
          value: item.category,
          fullName: item.name,
          symbol: 'roundRect',
          symbolSize: estimateNodeSymbolSize(item, forExport, fontScale),
          itemStyle: {
            color:
              item.category === 'root'
                ? '#ff8f6b'
                : item.category === 'knowledge'
                  ? '#52c7ea'
                  : '#7f9cff'
          }
        })),
        links: graph.links
      }
    ]
  }
}
