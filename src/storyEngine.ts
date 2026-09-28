export type EntityMap<T> = Record<string, T>

export type CharacterState = {
  name: string
  status: string
  location: string
  goals: string[]
  knowledge: string[]
  inventory: string[]
  notes: string[]
}

export type LoreEntry = {
  id: string
  title: string
  detail: string
  knownBy: string[]
  chapterId: string
}

export type WorldRuleEntry = LoreEntry & {
  category: 'veil' | 'harmony' | 'chaos' | 'guardians' | 'memory' | 'corruption' | 'cosmology' | 'magic'
}

export type WorldBibleEntry = {
  id: string
  title: string
  detail: string
  kind: 'lore' | 'metaphysics' | 'story-premise'
  category:
    | WorldRuleEntry['category']
    | 'history'
    | 'character'
    | 'setting'
    | 'cross-media'
  status: 'canon' | 'working' | 'open'
  visibility: 'unrevealed' | 'foreshadowed' | 'revealed'
  tags: string[]
  implications: string[]
}

export type RelationshipState = {
  id: string
  source: string
  target: string
  feeling: string
  evidence: string[]
}

export type AuthorNote = {
  id: string
  text: string
  category: 'edit' | 'concern' | 'idea' | 'research' | 'task'
  chapterId: string
  chapterTitle: string
}

export type StoryState = {
  plotPoints: string[]
  characters: EntityMap<CharacterState>
  lore: LoreEntry[]
  worldRules: WorldRuleEntry[]
  relationships: RelationshipState[]
  authorNotes: AuthorNote[]
}

export type ChapterAnalysis = {
  summary: string
  delta: StoryState
}

export type Chapter = {
  id: string
  title: string
  text: string
  sourcePath?: string
  summary: string
  delta: StoryState
  createdAt: string
}

export type ChangeRequest = {
  id: string
  kind: 'revision' | 'lore_backfill'
  title: string
  target: string
  instruction: string
  affectedChapterIds: string[]
  createdAt: string
}

export type StoryProject = {
  title: string
  chapters: Chapter[]
  worldBible: WorldBibleEntry[]
  changes: ChangeRequest[]
}

const plotMarkers = [
  'decided',
  'discovers',
  'discovered',
  'reveals',
  'revealed',
  'attacks',
  'attacked',
  'escapes',
  'escaped',
  'betrays',
  'betrayed',
  'finds',
  'found',
  'learns',
  'learned',
  'promises',
  'promised',
  'dies',
  'killed',
  'arrives',
  'leaves',
  'confronts',
  'confronted',
]

const loreMarkers = [
  'kingdom',
  'empire',
  'city',
  'temple',
  'guild',
  'prophecy',
  'magic',
  'war',
  'curse',
  'law',
  'legend',
  'ritual',
  'artifact',
  'history',
  'ancient',
  'planet',
  'station',
]

const worldRuleMarkers = [
  'veil',
  'lifeforce',
  'life force',
  'harmony',
  'balance',
  'chaos',
  'guardian',
  'guardians',
  'sylvanna',
  'thalios',
  'aeronir',
  'ignathar',
  'manifestation',
  'corruption',
  'corrupted',
  'severed',
  'severance',
  'forgotten',
  'forget',
  'remember',
  'memory',
  'myth',
  'universe',
  'existence',
  'domain',
  'power',
]

const goalMarkers = ['wants', 'needs', 'seeks', 'plans', 'hopes', 'must', 'tries']
const inventoryMarkers = ['takes', 'took', 'carries', 'carried', 'holds', 'held', 'keeps', 'kept', 'pockets']
const positiveMarkers = ['trusts', 'likes', 'loves', 'thanks', 'protects', 'helps', 'forgives']
const negativeMarkers = ['hates', 'distrusts', 'fears', 'blames', 'threatens', 'attacks', 'betrays']

export const emptyState = (): StoryState => ({
  plotPoints: [],
  characters: {},
  lore: [],
  worldRules: [],
  relationships: [],
  authorNotes: [],
})

export const defaultProject = (): StoryProject => ({
  title: '',
  chapters: [],
  worldBible: [],
  changes: [],
})

export function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function analyzeChapter(title: string, text: string, chapterId: string): ChapterAnalysis {
  const authorNotes = extractAuthorNotes(text, chapterId, title)
  const cleanText = stripAuthorNotes(text)
  const sentences = splitSentences(cleanText)
  const names = findCharacterNames(cleanText, title)
  const summary = summarize(sentences, title)
  const plotPoints = findPlotPoints(sentences)
  const characters = buildCharacters(sentences, names)
  const lore = buildLore(sentences, names, chapterId)
  const worldRules = buildWorldRules(sentences, names, chapterId)
  const relationships = buildRelationships(sentences, names)

  return {
    summary,
    delta: {
      plotPoints,
      characters,
      lore,
      worldRules,
      relationships,
      authorNotes,
    },
  }
}

export function computeStoryState(chapters: Chapter[], throughChapterId?: string): StoryState {
  const state = emptyState()
  const endIndex = throughChapterId
    ? Math.max(0, chapters.findIndex((chapter) => chapter.id === throughChapterId))
    : chapters.length - 1

  chapters.slice(0, endIndex + 1).forEach((chapter) => mergeState(state, chapter.delta))
  return state
}

export function createRewriteBrief(project: StoryProject, request: ChangeRequest) {
  const chapters = project.chapters.filter((chapter) => request.affectedChapterIds.includes(chapter.id))
  const chapterList = chapters.map((chapter) => `- ${chapter.title}: ${chapter.summary}`).join('\n')
  const heading = request.kind === 'lore_backfill' ? 'Lore backfill' : 'Targeted edit'

  return [
    `${heading}: ${request.title}`,
    `Target: ${request.target}`,
    '',
    'Change instruction:',
    request.instruction,
    '',
    'Affected chapters:',
    chapterList || '- No chapter matches yet. Apply during the next relevant revision pass.',
    '',
    'Rewrite guardrails:',
    '- Preserve the surrounding voice, chronology, and point of view.',
    '- Change only passages needed to satisfy the instruction.',
    request.kind === 'lore_backfill'
      ? '- Plant the idea subtly before it matters; avoid explaining the whole history too early.'
      : '- Keep the edit focused on the requested story-state change.',
    '- Reconcile character knowledge, inventory, relationship tone, and lore continuity after the edit.',
  ].join('\n')
}

export function applyChangeMarkers(project: StoryProject, request: ChangeRequest) {
  const brief = createRewriteBrief(project, request)

  return project.chapters
    .map((chapter) => {
      const marker = request.affectedChapterIds.includes(chapter.id)
        ? `\n\n[Revision note]\n${brief}\n[/Revision note]\n\n`
        : '\n\n'

      return `# ${chapter.title}${marker}${chapter.text}`
    })
    .join('\n\n')
}

function mergeState(target: StoryState, incoming: StoryState) {
  target.plotPoints.push(...incoming.plotPoints.filter((point) => !target.plotPoints.includes(point)))

  Object.values(incoming.characters).forEach((character) => {
    const current = target.characters[character.name] ?? {
      name: character.name,
      status: 'Present',
      location: 'Unknown',
      goals: [],
      knowledge: [],
      inventory: [],
      notes: [],
    }

    target.characters[character.name] = {
      ...current,
      status: character.status || current.status,
      location: character.location || current.location,
      goals: unique([...current.goals, ...character.goals]),
      knowledge: unique([...current.knowledge, ...character.knowledge]),
      inventory: unique([...current.inventory, ...character.inventory]),
      notes: unique([...current.notes, ...character.notes]),
    }
  })

  incoming.lore.forEach((entry) => {
    if (!target.lore.some((current) => normalize(current.detail) === normalize(entry.detail))) {
      target.lore.push(entry)
    }
  })

  ;(incoming.worldRules ?? []).forEach((entry) => {
    if (!target.worldRules.some((current) => normalize(current.detail) === normalize(entry.detail))) {
      target.worldRules.push(entry)
    }
  })

  incoming.relationships.forEach((relationship) => {
    const existing = target.relationships.find((current) => current.id === relationship.id)

    if (existing) {
      existing.feeling = relationship.feeling
      existing.evidence = unique([...existing.evidence, ...relationship.evidence])
      return
    }

    target.relationships.push(relationship)
  })

  target.authorNotes.push(
    ...(incoming.authorNotes ?? []).filter((note) => !target.authorNotes.some((current) => current.id === note.id)),
  )
}

function extractAuthorNotes(text: string, chapterId: string, chapterTitle: string) {
  return [...text.matchAll(/\[([^\][]+)]/g)]
    .map((match, index) => match[1]?.trim() ? {
      id: `${chapterId}-note-${index}`,
      text: match[1].trim(),
      category: categorizeAuthorNote(match[1]),
      chapterId,
      chapterTitle,
    } : null)
    .filter((note): note is AuthorNote => Boolean(note))
}

function stripAuthorNotes(text: string) {
  return text.replace(/\s*\[[^\][]+]\s*/g, ' ').trim()
}

function categorizeAuthorNote(text: string): AuthorNote['category'] {
  const lowered = text.toLowerCase()

  if (containsAny(lowered, ['fix', 'revise', 'rewrite', 'edit', 'change', 'cut', 'move'])) return 'edit'
  if (containsAny(lowered, ['concern', 'problem', 'issue', 'weak', 'confusing', 'unclear'])) return 'concern'
  if (containsAny(lowered, ['idea', 'maybe', 'explore', 'could', 'what if'])) return 'idea'
  if (containsAny(lowered, ['research', 'check', 'verify', 'look up'])) return 'research'

  return 'task'
}

function splitSentences(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function summarize(sentences: string[], title: string) {
  if (!sentences.length) {
    return `No source text has been added for ${title || 'this chapter'} yet.`
  }

  const lead = sentences.slice(0, 2).join(' ')
  const turningPoint = sentences.find((sentence) => containsAny(sentence, plotMarkers))

  if (turningPoint && !lead.includes(turningPoint)) {
    return `${lead} Key turn: ${turningPoint}`
  }

  return lead
}

function findCharacterNames(text: string, title: string) {
  const matches = text.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/g) ?? []
  const blocked = new Set([
    'The',
    'A',
    'An',
    'And',
    'But',
    'When',
    'Then',
    'This',
    'That',
    'Chapter',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
    ...title.split(/\s+/),
  ])

  const counts = matches.reduce<Record<string, number>>((acc, match) => {
    if (blocked.has(match)) return acc
    acc[match] = (acc[match] ?? 0) + 1
    return acc
  }, {})

  return Object.entries(counts)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name]) => name)
}

function findPlotPoints(sentences: string[]) {
  const candidates = sentences.filter((sentence) => containsAny(sentence, plotMarkers))
  return (candidates.length ? candidates : sentences.slice(0, 3)).slice(0, 8)
}

function buildCharacters(sentences: string[], names: string[]) {
  return names.reduce<EntityMap<CharacterState>>((acc, name) => {
    const evidence = sentences.filter((sentence) => sentence.includes(name))
    const goalSentence = evidence.find((sentence) => containsAny(sentence, goalMarkers))
    const inventorySentence = evidence.find((sentence) => containsAny(sentence, inventoryMarkers))
    const knowledge = evidence.filter((sentence) => containsAny(sentence, ['knows', 'learns', 'realizes', 'discovers']))

    acc[name] = {
      name,
      status: evidence.some((sentence) => /dead|dies|killed|wounded|injured/i.test(sentence))
        ? 'At risk'
        : 'Active',
      location: inferLocation(evidence),
      goals: goalSentence ? [goalSentence] : [],
      knowledge: knowledge.slice(0, 4),
      inventory: inventorySentence ? [inventorySentence] : [],
      notes: evidence.slice(0, 3),
    }

    return acc
  }, {})
}

function buildLore(sentences: string[], names: string[], chapterId: string) {
  return sentences
    .filter((sentence) => containsAny(sentence, loreMarkers))
    .slice(0, 8)
    .map((sentence, index) => ({
      id: `${chapterId}-lore-${index}`,
      title: inferLoreTitle(sentence),
      detail: sentence,
      knownBy: names.filter((name) => sentence.includes(name)),
      chapterId,
    }))
}

function buildWorldRules(sentences: string[], names: string[], chapterId: string) {
  return sentences
    .filter((sentence) => containsAny(sentence, worldRuleMarkers))
    .slice(0, 8)
    .map((sentence, index) => ({
      id: `${chapterId}-rule-${index}`,
      title: inferWorldRuleTitle(sentence),
      detail: sentence,
      knownBy: names.filter((name) => sentence.includes(name)),
      chapterId,
      category: inferWorldRuleCategory(sentence),
    }))
}

function buildRelationships(sentences: string[], names: string[]) {
  const relationships: RelationshipState[] = []

  names.forEach((source) => {
    names.forEach((target) => {
      if (source >= target) return

      const evidence = sentences.filter((sentence) => sentence.includes(source) && sentence.includes(target))
      if (!evidence.length) return

      const tone = evidence.some((sentence) => containsAny(sentence, negativeMarkers))
        ? 'Tense'
        : evidence.some((sentence) => containsAny(sentence, positiveMarkers))
          ? 'Warm'
          : 'Connected'

      relationships.push({
        id: [source, target].sort().join('__'),
        source,
        target,
        feeling: tone,
        evidence: evidence.slice(0, 3),
      })
    })
  })

  return relationships
}

function inferLocation(sentences: string[]) {
  const locationSentence = sentences.find((sentence) => /\b(in|at|inside|outside|near)\s+the\s+[A-Za-z]+/i.test(sentence))
  return locationSentence?.match(/\b(?:in|at|inside|outside|near)\s+the\s+([A-Za-z]+)/i)?.[1] ?? 'Unknown'
}

function inferLoreTitle(sentence: string) {
  const words = sentence
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 5)

  return words.join(' ') || 'Lore note'
}

function inferWorldRuleTitle(sentence: string) {
  const category = inferWorldRuleCategory(sentence)
  const labels: Record<WorldRuleEntry['category'], string> = {
    veil: 'Veil rule',
    harmony: 'Harmony rule',
    chaos: 'Chaos rule',
    guardians: 'Guardian rule',
    memory: 'Memory rule',
    corruption: 'Corruption rule',
    cosmology: 'Cosmology rule',
    magic: 'Magic rule',
  }

  return labels[category]
}

function inferWorldRuleCategory(sentence: string): WorldRuleEntry['category'] {
  const lowered = sentence.toLowerCase()

  if (containsAny(lowered, ['veil'])) return 'veil'
  if (containsAny(lowered, ['guardian', 'sylvanna', 'thalios', 'aeronir', 'ignathar'])) return 'guardians'
  if (containsAny(lowered, ['chaos'])) return 'chaos'
  if (containsAny(lowered, ['harmony', 'balance', 'lifeforce', 'life force'])) return 'harmony'
  if (containsAny(lowered, ['corrupt', 'malakar'])) return 'corruption'
  if (containsAny(lowered, ['forgotten', 'forget', 'remember', 'memory', 'myth'])) return 'memory'
  if (containsAny(lowered, ['universe', 'existence', 'manifestation', 'domain'])) return 'cosmology'

  return 'magic'
}

function containsAny(value: string, markers: string[]) {
  const lowered = value.toLowerCase()
  return markers.some((marker) => lowered.includes(marker))
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\W+/g, '')
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
