export function downloadTextFile(filename, content, type = 'application/json;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportMatrixCsv(matrix) {
  const header = ['ID', '能力类别', '能力名称', '能力等级', '典型场景', '来源文本']
  const rows = matrix.map((item) => [
    item.id,
    item.abilityType,
    item.abilityName,
    item.level,
    item.scenario,
    item.sourceText
  ])

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')

  downloadTextFile('ability-matrix.csv', `\ufeff${csv}`, 'text/csv;charset=utf-8')
}

export function exportGraphJson(filename, graph) {
  downloadTextFile(filename, JSON.stringify(graph, null, 2))
}
