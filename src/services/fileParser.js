export async function readStandardFile(file) {
  const lowerName = file.name.toLowerCase()

  if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
    return file.text()
  }

  if (lowerName.endsWith('.docx')) {
    const mammoth = (await import('mammoth')).default
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }

  if (lowerName.endsWith('.pdf')) {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString()
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const pages = []
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map((item) => item.str).join(' ')
      pages.push(pageText)
    }
    return pages.join('\n')
  }

  throw new Error('暂只支持 TXT、MD、DOCX、PDF 文件')
}
