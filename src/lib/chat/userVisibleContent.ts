const INTERNAL_TOOL_PREFIX_REGEX =
  /^\s*(?:Payload:\s*|\/tool\s+)?(?:(?:user\.(?:setAttribute|updateProfile))|(?:health|nutrition|training|mindfulness|general|coordination|artifacts)\.[A-Za-z0-9_.-]+)\b\s*/i

function normalizeNewlines(content: string): string {
  return content.replace(/\r\n/g, '\n')
}

function stripLeadingJsonObject(line: string): string {
  if (!line.startsWith('{')) return line

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') {
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return line.slice(index + 1).trimStart()
      }
    }
  }

  return ''
}

function stripLeadingKeyValuePayload(line: string): string {
  let remainder = line
  let strippedAny = false

  while (true) {
    const match = remainder.match(/^(?:[A-Za-z_][A-Za-z0-9_.-]*):(?:"(?:\\.|[^"])*"|[^\s]+)\s*/u)
    if (!match) break
    strippedAny = true
    remainder = remainder.slice(match[0].length).trimStart()
  }

  return strippedAny ? remainder : line
}

function sanitizeAssistantVisibleLine(line: string): string {
  const normalized = line.trim()
  const prefixMatch = normalized.match(INTERNAL_TOOL_PREFIX_REGEX)
  if (!prefixMatch) return normalized

  const remainder = normalized.slice(prefixMatch[0].length).trimStart()
  if (!remainder) return ''

  if (remainder.startsWith('{')) {
    const withoutJsonPayload = stripLeadingJsonObject(remainder).trimStart()
    return withoutJsonPayload
  }

  const withoutKeyValuePayload = stripLeadingKeyValuePayload(remainder).trimStart()
  if (withoutKeyValuePayload !== remainder) return withoutKeyValuePayload

  return ''
}

export function sanitizeAssistantVisibleContent(content: string): string {
  const normalized = normalizeNewlines(content)
  const keptLines = normalized
    .split('\n')
    .map((line) => sanitizeAssistantVisibleLine(line))
    .filter((line) => line.length > 0)

  return keptLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function hasVisibleAssistantContent(content: string): boolean {
  return sanitizeAssistantVisibleContent(content).length > 0
}
