/** Skip a JavaScript string, including nested ${...} inside template literals. */
function stringEnd(text: string, start: number): number {
  const quote = text[start]!
  let index = start + 1
  while (index < text.length) {
    if (text[index] === '\\') {
      index += 2
      continue
    }
    if (text[index] === quote)
      return index + 1
    if (quote === '`' && text.startsWith('${', index)) {
      index = javascriptEnd(text, index + 2, true)
      continue
    }
    index += 1
  }
  return text.length
}

/** A regexp cannot contain an unescaped newline; braces in it are not delimiters. */
function regexpEnd(text: string, start: number): number | undefined {
  let inClass = false
  for (let index = start + 1; index < text.length; index += 1) {
    const char = text[index]
    if (char === '\n' || char === '\r')
      return undefined
    if (char === '\\') {
      index += 1
      continue
    }
    if (char === '[')
      inClass = true
    else if (char === ']')
      inClass = false
    else if (char === '/' && !inClass)
      return index + 1
  }
  return undefined
}

/**
 * Locate a balanced expression or a blank-line-delimited MDX ESM block.
 * Keep lexical state across lines; unfinished code is protected through EOF.
 * This scanner locates opaque regions, rather than parsing or rewriting JS.
 */
function javascriptEnd(text: string, start: number, expression: boolean): number {
  const closers = expression ? ['}'] : []
  let expectOperand = true
  let index = start
  while (index < text.length) {
    if (!expression && closers.length === 0
      && (index === 0 || text[index - 1] === '\n')
      && /^[\t ]*\r?(?:\n|$)/.test(text.slice(index)))
      return index

    const char = text[index]!
    if (char === '"' || char === '\'' || char === '`') {
      index = stringEnd(text, index)
      expectOperand = false
      continue
    }
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index + 2)
      index = end < 0 ? text.length : end
      continue
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2)
      index = end < 0 ? text.length : end + 2
      continue
    }
    if (char === '/' && expectOperand) {
      const end = regexpEnd(text, index)
      if (end !== undefined) {
        index = end
        expectOperand = false
        continue
      }
    }
    if (char === '{' || char === '(' || char === '[') {
      closers.push(char === '{' ? '}' : char === '(' ? ')' : ']')
      expectOperand = true
    }
    else if (char === closers[closers.length - 1]) {
      closers.pop()
      if (expression && closers.length === 0)
        return index + 1
      expectOperand = false
    }
    else if (/[\w$\u0080-\uffff]/.test(char)) {
      const word = /^[\w$\u0080-\uffff]+/.exec(text.slice(index))![0]
      expectOperand = /^(?:return|throw|case|typeof|void|delete|yield|await|new|instanceof|in|of)$/.test(word)
      index += word.length
      continue
    }
    else if (!/\s/.test(char)) {
      expectOperand = char !== '.'
    }
    index += 1
  }
  return text.length
}

/**
 * Mask MDX code with equal-length opaque text so diagnostics keep their offsets.
 * Restore code after prose formatting; no placeholder can collide with input.
 */
export function protectMdxContent(content: string): { text: string, restore: (text: string) => string } {
  const ranges: [number, number][] = []
  let index = 0
  let fence: { marker: string, length: number } | undefined
  let frontMatter = content.startsWith('---\n') || content.startsWith('---\r\n')
  while (index < content.length) {
    const atLineStart = index === 0 || content[index - 1] === '\n'
    if (atLineStart) {
      const lineEnd = content.indexOf('\n', index)
      const nextLine = lineEnd < 0 ? content.length : lineEnd + 1
      const line = content.slice(index, lineEnd < 0 ? content.length : lineEnd).replace(/\r$/, '')
      if (frontMatter) {
        if (index > 0 && line === '---')
          frontMatter = false
        index = nextLine
        continue
      }
      if (fence) {
        const closing = /^ {0,3}(`+|~+)[\t ]*$/.exec(line)
        if (closing && closing[1]![0] === fence.marker && closing[1]!.length >= fence.length)
          fence = undefined
        index = nextLine
        continue
      }
      const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
      if (opening && !(opening[1]![0] === '`' && opening[2]!.includes('`'))) {
        fence = { marker: opening[1]![0]!, length: opening[1]!.length }
        index = nextLine
        continue
      }
      if (/^(?: {4}|\t)/.test(line)) {
        index = nextLine
        continue
      }
      if (/^ {0,3}(?:import|export)(?=\s|\/\*|\{|\*)/.test(line)) {
        const end = javascriptEnd(content, index, false)
        ranges.push([index, end])
        index = end
        continue
      }
    }
    if (content.startsWith('<!--', index)) {
      const end = content.indexOf('-->', index + 4)
      index = end < 0 ? content.length : end + 3
    }
    else if (content[index] === '\\') {
      index += 2
    }
    else if (content[index] === '`') {
      const marker = /^`+/.exec(content.slice(index))![0]
      const end = content.indexOf(marker, index + marker.length)
      const newline = content.indexOf('\n', index)
      index = end < 0 ? (newline < 0 ? content.length : newline) : end + marker.length
    }
    else if (content[index] === '<' && /^<\/?[A-Za-z>]/.test(content.slice(index))) {
      index += 1
      while (index < content.length && content[index] !== '>') {
        if (content[index] === '"' || content[index] === '\'') {
          index = stringEnd(content, index)
        }
        else if (content[index] === '{') {
          const end = javascriptEnd(content, index + 1, true)
          ranges.push([index, end])
          index = end
        }
        else {
          index += 1
        }
      }
      if (index < content.length)
        index += 1
    }
    else if (content[index] === '{') {
      const end = javascriptEnd(content, index + 1, true)
      ranges.push([index, end])
      index = end
    }
    else {
      index += 1
    }
  }

  let markerCode = 0xE000
  while (content.includes(String.fromCharCode(markerCode)))
    markerCode += 1
  const marker = String.fromCharCode(markerCode)
  const originals: string[] = []
  const parts: string[] = []
  let offset = 0
  const merged: [number, number][] = []
  for (const range of ranges) {
    const previous = merged[merged.length - 1]
    if (previous && previous[1] === range[0])
      previous[1] = range[1]
    else
      merged.push([...range])
  }
  for (const [start, end] of merged) {
    parts.push(content.slice(offset, start))
    parts.push(content.slice(start, end).replace(/[^\r\n]+/g, (code) => {
      originals.push(code)
      return marker.repeat(code.length)
    }))
    offset = end
  }
  parts.push(content.slice(offset))
  return {
    text: parts.join(''),
    restore: (text) => {
      let originalIndex = 0
      return text.replace(new RegExp(`${marker}+`, 'g'), () => originals[originalIndex++]!)
    },
  }
}
