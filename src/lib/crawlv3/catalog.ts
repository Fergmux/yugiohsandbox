import type {
  Crawlv3CatalogCard,
  Crawlv3CatalogConfig,
  Crawlv3StatusDefinition,
  Crawlv3StatusType,
} from '@/types/crawlv3'

import { CRAWLV3_DEV_CONFIG } from './dev-config'

export function createDefaultCrawlv3Config(): Crawlv3CatalogConfig {
  return JSON.parse(JSON.stringify(CRAWLV3_DEV_CONFIG.defaultRoomConfig)) as Crawlv3CatalogConfig
}

function normalizeNewlineInQuotes(input: string, index: number): { value: string; skipNext: boolean } {
  if (input[index] !== '\r') return { value: input[index] ?? '', skipNext: false }
  if (input[index + 1] === '\n') return { value: '\n', skipNext: true }
  return { value: '\n', skipNext: false }
}

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          inQuotes = false
        }
        continue
      }

      if (char === '\r') {
        const normalized = normalizeNewlineInQuotes(text, index)
        cell += normalized.value
        if (normalized.skipNext) index += 1
        continue
      }

      cell += char
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === ',') {
      row.push(cell)
      cell = ''
      continue
    }

    if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    if (char === '\r') {
      continue
    }

    cell += char
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

export function rowsToRecords(rows: string[][]): Record<string, string>[] {
  if (!rows.length) return []

  const [rawHeaders, ...bodyRows] = rows
  const headers = rawHeaders.map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, '').trim() : header.trim(),
  )

  return bodyRows
    .filter((row) => row.some((value) => value.trim().length > 0))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ''])))
}

export function parseImageOverrides(overridesText: string): Record<string, string> {
  const entries = overridesText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const map: Record<string, string> = {}

  for (const entry of entries) {
    const separatorIndex = entry.includes(',') ? entry.indexOf(',') : entry.indexOf('=')
    if (separatorIndex === -1) continue

    const id = entry.slice(0, separatorIndex).trim()
    const url = entry.slice(separatorIndex + 1).trim()

    if (!id || !url) continue
    map[id] = url
  }

  return map
}

export function resolveCatalogCardImage(cardId: string, config: Crawlv3CatalogConfig): string {
  const overrides = parseImageOverrides(config.imageOverridesText)
  if (overrides[cardId]) return overrides[cardId]

  if (!config.imageUrlTemplate.trim()) return ''

  return config.imageUrlTemplate.includes('{id}')
    ? config.imageUrlTemplate.split('{id}').join(cardId)
    : config.imageUrlTemplate
}

function getMappedValue(row: Record<string, string>, headerName: string): string {
  if (!headerName.trim()) return ''
  return row[headerName.trim()] ?? ''
}

export function normalizeCatalogCards(
  rows: Record<string, string>[],
  config: Crawlv3CatalogConfig,
): Crawlv3CatalogCard[] {
  return rows
    .map((row) => {
      const id = getMappedValue(row, config.headers.id).trim()
      const title = getMappedValue(row, config.headers.title).trim()

      return {
        id,
        title,
        cost: getMappedValue(row, config.headers.cost).trim(),
        atk: getMappedValue(row, config.headers.atk).trim(),
        def: getMappedValue(row, config.headers.def).trim(),
        race: getMappedValue(row, config.headers.race).trim(),
        damageType: getMappedValue(row, config.headers.damageType).trim(),
        description: getMappedValue(row, config.headers.description).trim(),
        imageUrl: resolveCatalogCardImage(id, config),
      }
    })
    .filter((card) => card.id.length > 0 && card.title.length > 0)
}

export async function loadCatalogCards(config: Crawlv3CatalogConfig): Promise<Crawlv3CatalogCard[]> {
  const response = await fetch(config.csvUrl)
  if (!response.ok) {
    throw new Error(`Failed to load CSV: ${response.status}`)
  }

  const csvText = await response.text()
  const rows = rowsToRecords(parseCsvText(csvText))
  return normalizeCatalogCards(rows, config)
}

function normalizeStatusType(value: string): Crawlv3StatusType | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'buff' || normalized === 'debuff') return normalized
  return null
}

export function normalizeStatusDefinitions(
  rows: Record<string, string>[],
  config: Crawlv3CatalogConfig,
): Crawlv3StatusDefinition[] {
  return rows
    .map((row) => {
      const id = getMappedValue(row, config.statusHeaders.id).trim()
      const name = getMappedValue(row, config.statusHeaders.name).trim()
      const type = normalizeStatusType(getMappedValue(row, config.statusHeaders.type))
      const description = getMappedValue(row, config.statusHeaders.description).trim()

      if (!id || !name || !type) return null

      return {
        id,
        name,
        type,
        description,
      }
    })
    .filter((status): status is Crawlv3StatusDefinition => !!status)
}

export async function loadStatusDefinitions(config: Crawlv3CatalogConfig): Promise<Crawlv3StatusDefinition[]> {
  const response = await fetch(config.statusCsvUrl)
  if (!response.ok) {
    throw new Error(`Failed to load status CSV: ${response.status}`)
  }

  const csvText = await response.text()
  const rows = rowsToRecords(parseCsvText(csvText))
  return normalizeStatusDefinitions(rows, config)
}
