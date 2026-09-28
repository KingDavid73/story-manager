import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookMarked,
  Brain,
  ClipboardList,
  Download,
  GitBranch,
  Library,
  ListPlus,
  Network,
  Orbit,
  PenLine,
  RefreshCcw,
  Save,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import type {
  AuthorNote,
  Chapter,
  ChangeRequest,
  LoreEntry,
  StoryProject,
  StoryState,
  WorldBibleEntry,
  WorldRuleEntry,
} from './storyEngine'
import {
  applyChangeMarkers,
  createId,
  createRewriteBrief,
  defaultProject,
  emptyState,
} from './storyEngine'

const storageKey = 'story-manager-project-v1'
const externalProjectPath = '/story-data/project.json'
const reworkProjectPath = '/story-data/rework.json'
const noChapterId = 'none'
const worldBibleId = 'world-bible'

type StatePanel = 'plot' | 'characters' | 'lore' | 'worldRules' | 'relationships' | 'notes' | 'changes'
type AppMode = 'workshop' | 'rework'
type ReworkChapter = {
  id: string
  title: string
  sourcePath: string
}
type ReworkProject = {
  title: string
  chapters: ReworkChapter[]
}

function App() {
  const [project, setProject] = useStoredProject()
  const [appMode, setAppMode] = useState<AppMode>('workshop')
  const [selectedChapterId, setSelectedChapterId] = useState(project.chapters[0]?.id ?? noChapterId)
  const [reworkProject, setReworkProject] = useState<ReworkProject>({ title: 'Reworked manuscript', chapters: [] })
  const [selectedReworkChapterId, setSelectedReworkChapterId] = useState('')
  const [reworkText, setReworkText] = useState('')
  const [reworkStatus, setReworkStatus] = useState('Loading revised manuscript')
  const [activePanel, setActivePanel] = useState<StatePanel>('plot')
  const [changeTitle, setChangeTitle] = useState('')
  const [changeTarget, setChangeTarget] = useState('')
  const [changeInstruction, setChangeInstruction] = useState('')
  const [loreTitle, setLoreTitle] = useState('')
  const [loreDetail, setLoreDetail] = useState('')
  const [loreRevealChapterId, setLoreRevealChapterId] = useState('')
  const [loreMode, setLoreMode] = useState<'plant' | 'history'>('plant')
  const [query, setQuery] = useState('')
  const [dataStatus, setDataStatus] = useState('Local workspace')
  const [sourceText, setSourceText] = useState('')
  const [sourceStatus, setSourceStatus] = useState('No source file loaded')
  const [sourceDirty, setSourceDirty] = useState(false)

  const selectedChapter = project.chapters.find((chapter) => chapter.id === selectedChapterId)
  const worldBibleMode = selectedChapterId === worldBibleId
  const selectedState = selectedChapter?.delta ?? emptyState()
  const visibleChapters = useMemo(
    () => filterChapters(project.chapters, query),
    [project.chapters, query],
  )
  const latestBrief = project.changes[0] ? createRewriteBrief(project, project.changes[0]) : ''
  const selectedReworkChapter = reworkProject.chapters.find((chapter) => chapter.id === selectedReworkChapterId)
  const visibleReworkChapters = useMemo(
    () => filterReworkChapters(reworkProject.chapters, query),
    [reworkProject.chapters, query],
  )

  const loadReworkData = useCallback(async () => {
    try {
      const response = await fetch(`${reworkProjectPath}?t=${Date.now()}`)
      if (!response.ok) throw new Error('Missing rework index')

      const loaded = await response.json() as ReworkProject
      setReworkProject(loaded)
      setSelectedReworkChapterId((current) => (
        loaded.chapters.some((chapter) => chapter.id === current)
          ? current
          : loaded.chapters[0]?.id ?? ''
      ))
      setReworkStatus(`Loaded ${loaded.chapters.length} revised chapter(s)`)
    } catch {
      setReworkProject({ title: 'Reworked manuscript', chapters: [] })
      setSelectedReworkChapterId('')
      setReworkStatus('No revised chapters found')
    }
  }, [])

  const loadProjectData = useCallback(async (showMissing = true) => {
    try {
      const response = await fetch(`${externalProjectPath}?t=${Date.now()}`)
      if (!response.ok) {
        if (showMissing) setDataStatus('No project JSON found')
        return
      }

      const loadedProject = normalizeStoredProject(await response.json() as StoryProject)
      setProject(loadedProject)
      setSelectedChapterId(loadedProject.chapters[0]?.id ?? noChapterId)
      setDataStatus(`Loaded ${loadedProject.chapters.length} chapter(s) from project JSON`)
    } catch {
      setDataStatus('Could not load project JSON')
    }
  }, [setProject])

  useEffect(() => {
    let ignore = false

    void fetch(`${externalProjectPath}?t=${Date.now()}`)
      .then((response) => response.ok ? response.json() : null)
      .then((projectJson) => {
        if (ignore || !projectJson) return

        const loadedProject = normalizeStoredProject(projectJson as StoryProject)
        setProject(loadedProject)
        setSelectedChapterId(loadedProject.chapters[0]?.id ?? noChapterId)
        setDataStatus(`Loaded ${loadedProject.chapters.length} chapter(s) from project JSON`)
      })
      .catch(() => {
        if (!ignore) setDataStatus('Local workspace')
      })

    return () => {
      ignore = true
    }
  }, [setProject])

  useEffect(() => {
    let ignore = false

    void fetch(`${reworkProjectPath}?t=${Date.now()}`)
      .then((response) => response.ok ? response.json() : null)
      .then((loadedProject) => {
        if (ignore || !loadedProject) return

        const loaded = loadedProject as ReworkProject
        setReworkProject(loaded)
        setSelectedReworkChapterId(loaded.chapters[0]?.id ?? '')
        setReworkStatus(`Loaded ${loaded.chapters.length} revised chapter(s)`)
      })
      .catch(() => {
        if (!ignore) setReworkStatus('No revised chapters found')
      })

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!selectedReworkChapter) {
      void Promise.resolve().then(() => setReworkText(''))
      return
    }

    let ignore = false
    void fetch(`/api/chapter-source?path=${encodeURIComponent(selectedReworkChapter.sourcePath)}&t=${Date.now()}`)
      .then((response) => response.ok ? response.text() : '')
      .then((content) => {
        if (!ignore) setReworkText(content)
      })
      .catch(() => {
        if (!ignore) setReworkText('')
      })

    return () => {
      ignore = true
    }
  }, [selectedReworkChapter])

  useEffect(() => {
    if (!selectedChapter?.sourcePath) {
      void Promise.resolve().then(() => {
        setSourceText(selectedChapter?.text ?? '')
        setSourceStatus(selectedChapter ? 'No source file linked for this chapter' : 'No source file loaded')
        setSourceDirty(false)
      })
      return
    }

    let ignore = false

    void fetch(`/api/chapter-source?path=${encodeURIComponent(selectedChapter.sourcePath)}&t=${Date.now()}`)
      .then((response) => response.ok ? response.text() : '')
      .then((content) => {
        if (ignore) return

        setSourceText(content)
        setSourceStatus(content ? `Loaded ${selectedChapter.sourcePath}` : 'Source file is empty or missing')
        setSourceDirty(false)
      })
      .catch(() => {
        if (!ignore) {
          setSourceText('')
          setSourceStatus('Could not load source file')
          setSourceDirty(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [selectedChapter])

  function loadChapter(chapter: Chapter) {
    setSelectedChapterId(chapter.id)
  }

  function loadWorldBible() {
    setSelectedChapterId(worldBibleId)
  }

  function selectMode(mode: AppMode) {
    setAppMode(mode)
    setQuery('')
  }

  function createChangeRequest() {
    if (!changeTitle.trim() || !changeInstruction.trim()) return

    const affectedChapterIds = findAffectedChapters(project.chapters, changeTarget, changeInstruction)
    const request: ChangeRequest = {
      id: createId('change'),
      kind: 'revision',
      title: changeTitle.trim(),
      target: changeTarget.trim() || 'Unspecified',
      instruction: changeInstruction.trim(),
      affectedChapterIds,
      createdAt: new Date().toISOString(),
    }

    setProject((current) => ({
      ...current,
      changes: [request, ...current.changes],
    }))
    setActivePanel('changes')
    setChangeTitle('')
    setChangeInstruction('')
  }

  function createLoreBackfill() {
    if (!loreTitle.trim() || !loreDetail.trim()) return

    const affectedChapterIds = findLoreBackfillChapters(
      project.chapters,
      loreRevealChapterId || selectedChapter?.id,
      loreDetail,
    )
    const instruction = [
      loreMode === 'plant'
        ? 'Plant early, subtle setup for this lore/history so it feels earned later.'
        : 'Back-fill historical context without over-explaining it before the reveal.',
      '',
      loreDetail.trim(),
      '',
      'Track who could plausibly know this, what language or symbols might foreshadow it, and which earlier scenes can carry a small clue.',
    ].join('\n')
    const request: ChangeRequest = {
      id: createId('backfill'),
      kind: 'lore_backfill',
      title: loreTitle.trim(),
      target: loreRevealChapterId
        ? `Before ${project.chapters.find((chapter) => chapter.id === loreRevealChapterId)?.title ?? 'selected reveal'}`
        : 'Earlier chapters',
      instruction,
      affectedChapterIds,
      createdAt: new Date().toISOString(),
    }

    setProject((current) => ({
      ...current,
      changes: [request, ...current.changes],
    }))
    setActivePanel('changes')
    setLoreTitle('')
    setLoreDetail('')
  }

  function downloadMarkedCopy(request: ChangeRequest) {
    const output = applyChangeMarkers(project, request)
    downloadText(`${slug(project.title)}-${slug(request.title)}.md`, output)
  }

  async function saveChapterSource() {
    if (!selectedChapter?.sourcePath) return

    try {
      const response = await fetch(`/api/chapter-source?path=${encodeURIComponent(selectedChapter.sourcePath)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
        body: sourceText,
      })

      if (!response.ok) throw new Error('Save failed')

      setSourceDirty(false)
      setSourceStatus(`Saved ${selectedChapter.sourcePath}`)
    } catch {
      setSourceStatus('Could not save source file')
    }
  }

  function resetProject() {
    setProject(defaultProject())
    setSelectedChapterId(noChapterId)
    setDataStatus('Local workspace reset')
  }

  return (
    <main className="app-shell">
      <aside className="chapter-rail">
        <div className="brand-row">
          <div className="brand-mark">
            <GitBranch size={19} />
          </div>
          <div>
            <label htmlFor="project-title">Story Manager</label>
            <input
              id="project-title"
              value={project.title}
              placeholder="Untitled story"
              onChange={(event) => setProject((current) => ({ ...current, title: event.target.value }))}
            />
          </div>
        </div>

        <div className="mode-switch" aria-label="Workspace mode">
          <button
            type="button"
            className={appMode === 'workshop' ? 'active' : ''}
            onClick={() => selectMode('workshop')}
          >
            <GitBranch size={16} />
            Workshop
          </button>
          <button
            type="button"
            className={appMode === 'rework' ? 'active' : ''}
            onClick={() => selectMode('rework')}
          >
            <BookOpen size={16} />
            Reworked book
          </button>
        </div>

        <div className="search-box">
          <Search size={16} />
          <input
            aria-label="Search chapters"
            placeholder={appMode === 'rework' ? 'Search revised chapters' : 'Search chapters'}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {appMode === 'workshop' && (
          <button
            type="button"
            className={worldBibleMode ? 'world-bible-node active' : 'world-bible-node'}
            onClick={loadWorldBible}
          >
            <BookMarked size={19} />
            <span>
              <strong>World Bible</strong>
              <small>
                {project.worldBible.length} global entries,{' '}
                {project.worldBible.filter((entry) => entry.kind === 'metaphysics').length} metaphysical
              </small>
            </span>
          </button>
        )}

        <div className="chapter-list" aria-label="Chapter nodes">
          {appMode === 'workshop' ? visibleChapters.map((chapter, index) => (
              <button
                type="button"
                key={chapter.id}
                className={chapter.id === selectedChapter?.id ? 'chapter-node active' : 'chapter-node'}
                onClick={() => loadChapter(chapter)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{chapter.title}</strong>
                <small>{chapter.summary}</small>
              </button>
            )) : visibleReworkChapters.map((chapter, index) => (
              <button
                type="button"
                key={chapter.id}
                className={chapter.id === selectedReworkChapter?.id ? 'chapter-node rework-node active' : 'chapter-node rework-node'}
                onClick={() => setSelectedReworkChapterId(chapter.id)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{chapter.title}</strong>
                <small>{chapter.sourcePath}</small>
              </button>
            ))}
          {appMode === 'workshop' && !project.chapters.length && (
            <div className="empty-panel">
              <BookOpen size={22} />
              <p>Add a chapter to start building the skeleton.</p>
            </div>
          )}
          {appMode === 'rework' && !reworkProject.chapters.length && (
            <div className="empty-panel">
              <BookOpen size={22} />
              <p>Revised chapters will appear here as they are drafted.</p>
            </div>
          )}
        </div>

        <div className="rail-actions">
          {appMode === 'workshop' ? (
            <>
              <button type="button" className="icon-button" title="Reset local project" onClick={resetProject}>
                <RefreshCcw size={18} />
              </button>
              <button type="button" className="icon-button" title="Load project JSON" onClick={() => void loadProjectData()}>
                <Download size={18} />
              </button>
            </>
          ) : (
            <button type="button" className="icon-button" title="Reload revised manuscript" onClick={() => void loadReworkData()}>
              <RefreshCcw size={18} />
            </button>
          )}
        </div>
        <p className="data-status">{appMode === 'rework' ? reworkStatus : dataStatus}</p>
      </aside>

      <section className={appMode === 'rework' ? 'workspace reader-workspace' : 'workspace'}>
        {appMode === 'rework' ? (
          <ReworkReader
            project={reworkProject}
            chapter={selectedReworkChapter}
            text={reworkText}
            onSelect={setSelectedReworkChapterId}
          />
        ) : (
          <>
        <header className="workspace-header">
          <div>
            <p>{worldBibleMode ? 'Project canon' : 'Chapter workspace'}</p>
            <h1>{worldBibleMode ? 'World Bible' : selectedChapter?.title ?? 'No chapter loaded'}</h1>
          </div>
          <div className="header-stats">
            {worldBibleMode ? (
              <>
                <Stat icon={<BookMarked size={16} />} label="Entries" value={project.worldBible.length.toString()} />
                <Stat
                  icon={<Orbit size={16} />}
                  label="Metaphysics"
                  value={project.worldBible.filter((entry) => entry.kind === 'metaphysics').length.toString()}
                />
                <Stat
                  icon={<Sparkles size={16} />}
                  label="Working"
                  value={project.worldBible.filter((entry) => entry.status === 'working').length.toString()}
                />
                <Stat
                  icon={<Brain size={16} />}
                  label="Open"
                  value={project.worldBible.filter((entry) => entry.status === 'open').length.toString()}
                />
              </>
            ) : (
              <>
                <Stat icon={<BookOpen size={16} />} label="Chapters" value={project.chapters.length.toString()} />
                <Stat icon={<Users size={16} />} label="Characters" value={Object.keys(selectedState.characters).length.toString()} />
                <Stat icon={<Library size={16} />} label="Lore" value={selectedState.lore.length.toString()} />
                <Stat icon={<Orbit size={16} />} label="Rules" value={selectedState.worldRules.length.toString()} />
                <Stat icon={<ClipboardList size={16} />} label="Notes" value={selectedState.authorNotes.length.toString()} />
              </>
            )}
          </div>
        </header>

        {worldBibleMode ? (
          <WorldBibleWorkspace entries={project.worldBible} />
        ) : (
          <div className="main-grid">
            <section className="chapter-overview">
              <div className="section-heading">
                <div>
                  <p>Chapter overview</p>
                  <h2>{selectedChapter?.title ?? 'Waiting for analyzed chapters'}</h2>
                </div>
              </div>

              {selectedChapter ? (
                <ChapterOverview chapter={selectedChapter} />
              ) : (
                <div className="empty-panel">
                  <BookOpen size={22} />
                  <p>Analyzed chapters will appear after project JSON is generated from chat.</p>
                </div>
              )}
            </section>

            <section className="state-panel">
              <div className="section-heading">
                <div>
                  <p>Story state</p>
                  <h2>{selectedChapter ? `In ${selectedChapter.title}` : 'Select a chapter'}</h2>
                </div>
              </div>

              <div className="tabs" role="tablist" aria-label="Story state views">
                <TabButton active={activePanel === 'plot'} icon={<ListPlus size={16} />} label="Plot" onClick={() => setActivePanel('plot')} />
                <TabButton active={activePanel === 'characters'} icon={<Users size={16} />} label="Cast" onClick={() => setActivePanel('characters')} />
                <TabButton active={activePanel === 'lore'} icon={<Brain size={16} />} label="Lore" onClick={() => setActivePanel('lore')} />
                <TabButton active={activePanel === 'worldRules'} icon={<Orbit size={16} />} label="Rules" onClick={() => setActivePanel('worldRules')} />
                <TabButton active={activePanel === 'relationships'} icon={<Network size={16} />} label="Links" onClick={() => setActivePanel('relationships')} />
                <TabButton active={activePanel === 'notes'} icon={<ClipboardList size={16} />} label="Notes" onClick={() => setActivePanel('notes')} />
                <TabButton active={activePanel === 'changes'} icon={<PenLine size={16} />} label="Edits" onClick={() => setActivePanel('changes')} />
              </div>

              <StatePanelView state={selectedState} panel={activePanel} changes={project.changes} onDownload={downloadMarkedCopy} />
            </section>
          </div>
        )}

        {!worldBibleMode && (
          <section className="source-dock">
            <div className="section-heading">
              <div>
                <p>Chapter source</p>
                <h2>{selectedChapter?.sourcePath ?? 'No linked source file'}</h2>
              </div>
              <button
                type="button"
                className="primary-button"
                disabled={!selectedChapter?.sourcePath || !sourceDirty}
                onClick={() => void saveChapterSource()}
              >
                <Save size={17} />
                Save source
              </button>
            </div>
            <textarea
              className="source-textarea"
              value={sourceText}
              disabled={!selectedChapter}
              onChange={(event) => {
                setSourceText(event.target.value)
                setSourceDirty(true)
              }}
              placeholder="Full chapter text loads here when the selected chapter has a sourcePath."
            />
            <p className="source-status">{sourceDirty ? `${sourceStatus} - unsaved changes` : sourceStatus}</p>
          </section>
        )}

        <section className="revision-dock">
          <div className="section-heading">
            <div>
              <p>Targeted revision</p>
              <h2>Make a story-state change</h2>
            </div>
            <button type="button" className="primary-button" onClick={createChangeRequest}>
              <Sparkles size={17} />
              Draft change
            </button>
          </div>
          <div className="revision-grid">
            <input
              value={changeTitle}
              onChange={(event) => setChangeTitle(event.target.value)}
              placeholder="Short edit title"
            />
            <input
              value={changeTarget}
              onChange={(event) => setChangeTarget(event.target.value)}
              placeholder="Target"
            />
            <textarea
              value={changeInstruction}
              onChange={(event) => setChangeInstruction(event.target.value)}
              placeholder="Describe the story-state change to make and what continuity should be protected."
            />
            <pre>{latestBrief || 'New change briefs will appear here after you draft one.'}</pre>
          </div>
        </section>

        <section className="revision-dock">
          <div className="section-heading">
            <div>
              <p>Lore backfill</p>
              <h2>Plant history in earlier chapters</h2>
            </div>
            <button type="button" className="primary-button" onClick={createLoreBackfill}>
              <Library size={17} />
              Draft backfill
            </button>
          </div>
          <div className="backfill-grid">
            <input
              value={loreTitle}
              onChange={(event) => setLoreTitle(event.target.value)}
              placeholder="Lore or history title"
            />
            <select value={loreRevealChapterId} onChange={(event) => setLoreRevealChapterId(event.target.value)}>
              <option value="">No reveal chapter selected</option>
              {project.chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  Reveal by {chapter.title}
                </option>
              ))}
            </select>
            <div className="segmented-control" aria-label="Lore backfill mode">
              <button
                type="button"
                className={loreMode === 'plant' ? 'active' : ''}
                onClick={() => setLoreMode('plant')}
              >
                Seed
              </button>
              <button
                type="button"
                className={loreMode === 'history' ? 'active' : ''}
                onClick={() => setLoreMode('history')}
              >
                History
              </button>
            </div>
            <textarea
              value={loreDetail}
              onChange={(event) => setLoreDetail(event.target.value)}
              placeholder="Describe the deeper lore, history, rule, secret, or cultural detail you want earlier chapters to foreshadow."
            />
            <p className="helper-copy">
              The app will target chapters before the reveal point, favoring chapters whose text already overlaps with the idea.
            </p>
          </div>
        </section>
          </>
        )}
      </section>
    </main>
  )
}

function ReworkReader({
  project,
  chapter,
  text,
  onSelect,
}: {
  project: ReworkProject
  chapter: ReworkChapter | undefined
  text: string
  onSelect: (chapterId: string) => void
}) {
  const chapterIndex = chapter ? project.chapters.findIndex((item) => item.id === chapter.id) : -1
  const previousChapter = chapterIndex > 0 ? project.chapters[chapterIndex - 1] : undefined
  const nextChapter = chapterIndex > -1 && chapterIndex < project.chapters.length - 1
    ? project.chapters[chapterIndex + 1]
    : undefined
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

  return (
    <>
      <header className="reader-header">
        <div>
          <p>Reworked manuscript</p>
          <h1>{project.title}</h1>
        </div>
        <div className="reader-meta">
          <span>{chapter?.title ?? 'No revised chapter selected'}</span>
          <span>{wordCount.toLocaleString()} words</span>
        </div>
      </header>

      {chapter ? (
        <article className="manuscript-reader">
          <ManuscriptBlocks text={text} fallbackTitle={chapter.title} />
        </article>
      ) : (
        <div className="reader-empty">
          <BookOpen size={28} />
          <p>The revised manuscript will appear here chapter by chapter.</p>
        </div>
      )}

      <nav className="reader-navigation" aria-label="Revised chapter navigation">
        <button type="button" disabled={!previousChapter} onClick={() => previousChapter && onSelect(previousChapter.id)}>
          <ArrowLeft size={17} />
          <span>{previousChapter?.title ?? 'Beginning'}</span>
        </button>
        <button type="button" disabled={!nextChapter} onClick={() => nextChapter && onSelect(nextChapter.id)}>
          <span>{nextChapter?.title ?? 'Latest revision'}</span>
          <ArrowRight size={17} />
        </button>
      </nav>
    </>
  )
}

function ManuscriptBlocks({ text, fallbackTitle }: { text: string; fallbackTitle: string }) {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)

  if (!blocks.length) return <h2>{fallbackTitle}</h2>

  return (
    <>
      {blocks.map((block, index) => {
        if (block === '---') return <hr key={`rule-${index}`} />
        if (block.startsWith('# ')) return <h2 key={`heading-${index}`}>{block.slice(2)}</h2>
        if (block.startsWith('## ')) return <h3 key={`subheading-${index}`}>{block.slice(3)}</h3>

        return <p key={`paragraph-${index}`}>{block.replace(/\n/g, ' ')}</p>
      })}
    </>
  )
}

function WorldBibleWorkspace({ entries }: { entries: WorldBibleEntry[] }) {
  const loreEntries = entries.filter((entry) => entry.kind !== 'metaphysics')
  const metaphysicsEntries = entries.filter((entry) => entry.kind === 'metaphysics')

  return (
    <div className="main-grid world-bible-grid">
      <section className="world-bible-panel">
        <div className="section-heading">
          <div>
            <p>Unbound lore</p>
            <h2>History and story possibilities</h2>
          </div>
        </div>
        <WorldBibleList
          entries={loreEntries}
          empty="Project-level history, characters, settings, and future story premises will appear here."
        />
      </section>

      <section className="world-bible-panel">
        <div className="section-heading">
          <div>
            <p>World rules</p>
            <h2>Metaphysical framework</h2>
          </div>
        </div>
        <WorldBibleList
          entries={metaphysicsEntries}
          empty="Metaphysical rules that apply beyond a single chapter will appear here."
        />
      </section>
    </div>
  )
}

function WorldBibleList({ entries, empty }: { entries: WorldBibleEntry[]; empty: string }) {
  if (!entries.length) return <Empty icon={<BookMarked size={22} />} text={empty} />

  return (
    <div className="stack-list">
      {entries.map((entry) => (
        <article className={`info-card bible-card bible-${entry.status}`} key={entry.id}>
          <header>
            <strong>{entry.title}</strong>
            <span>{labelForWorldBibleStatus(entry.status)}</span>
          </header>
          <p>{entry.detail}</p>
          {!!entry.implications.length && (
            <ul>
              {entry.implications.map((implication) => (
                <li key={implication}>{implication}</li>
              ))}
            </ul>
          )}
          <footer>
            <span>{labelForWorldBibleCategory(entry.category)}</span>
            <span>{labelForWorldBibleVisibility(entry.visibility)}</span>
            <small>{entry.tags.join(' / ')}</small>
          </footer>
        </article>
      ))}
    </div>
  )
}

function StatePanelView({
  state,
  panel,
  changes,
  onDownload,
}: {
  state: StoryState
  panel: StatePanel
  changes: ChangeRequest[]
  onDownload: (request: ChangeRequest) => void
}) {
  if (panel === 'plot') {
    return <ItemList icon={<ListPlus size={16} />} items={state.plotPoints} empty="Plot points will appear after a chapter is saved." />
  }

  if (panel === 'characters') {
    const characters = Object.values(state.characters)
    return (
      <div className="stack-list">
        {characters.map((character) => (
          <article className="info-card" key={character.name}>
            <header>
              <strong>{character.name}</strong>
              <span>{character.status}</span>
            </header>
            <dl>
              <dt>Location</dt>
              <dd>{character.location}</dd>
              <dt>Goals</dt>
              <dd>{character.goals[0] ?? 'No explicit goal found yet.'}</dd>
              <dt>Knowledge</dt>
              <dd>{character.knowledge[0] ?? 'No explicit knowledge found yet.'}</dd>
              <dt>Inventory</dt>
              <dd>{character.inventory[0] ?? 'No tracked item found yet.'}</dd>
            </dl>
          </article>
        ))}
        {!characters.length && <Empty icon={<Users size={22} />} text="Characters are detected from repeated names." />}
      </div>
    )
  }

  if (panel === 'lore') {
    return (
      <div className="stack-list">
        {state.lore.map((entry) => (
          <article className="info-card" key={entry.id}>
            <header>
              <strong>{entry.title}</strong>
              <span>{entry.knownBy.length ? entry.knownBy.join(', ') : 'Unassigned knowledge'}</span>
            </header>
            <p>{entry.detail}</p>
          </article>
        ))}
        {!state.lore.length && <Empty icon={<Library size={22} />} text="Lore appears when chapter text mentions world facts." />}
      </div>
    )
  }

  if (panel === 'worldRules') {
    return (
      <div className="stack-list">
        {state.worldRules.map((entry) => (
          <article className={`info-card rule-card rule-${entry.category}`} key={entry.id}>
            <header>
              <strong>{entry.title}</strong>
              <span>{labelForWorldRuleCategory(entry.category)}</span>
            </header>
            <p>{entry.detail}</p>
            <small>{entry.knownBy.length ? `Known by ${entry.knownBy.join(', ')}` : 'World-rule continuity'}</small>
          </article>
        ))}
        {!state.worldRules.length && (
          <Empty
            icon={<Orbit size={22} />}
            text="World rules appear when chapters mention the Veil, guardians, harmony, chaos, memory, or similar metaphysics."
          />
        )}
      </div>
    )
  }

  if (panel === 'relationships') {
    return (
      <div className="stack-list">
        {state.relationships.map((relationship) => (
          <article className="info-card" key={relationship.id}>
            <header>
              <strong>{relationship.source} / {relationship.target}</strong>
              <span>{relationship.feeling}</span>
            </header>
            <p>{relationship.evidence[0]}</p>
          </article>
        ))}
        {!state.relationships.length && <Empty icon={<Network size={22} />} text="Relationships appear when characters share scenes." />}
      </div>
    )
  }

  if (panel === 'notes') {
    return <AuthorNotesList notes={state.authorNotes} />
  }

  return (
    <div className="stack-list">
      {changes.map((change) => (
        <article className="info-card" key={change.id}>
          <header>
            <strong>{change.title}</strong>
            <button type="button" className="icon-button compact" title="Download marked copy" onClick={() => onDownload(change)}>
              <Download size={15} />
            </button>
          </header>
          <p>{change.instruction}</p>
          <small>
            {(change.kind ?? 'revision') === 'lore_backfill' ? 'Lore backfill' : 'Targeted edit'} -{' '}
            {change.affectedChapterIds.length} affected chapter(s)
          </small>
        </article>
      ))}
      {!changes.length && <Empty icon={<PenLine size={22} />} text="Draft targeted changes to produce rewrite briefs." />}
    </div>
  )
}

function ChapterOverview({ chapter }: { chapter: Chapter }) {
  const chapterState = chapter.delta

  return (
    <div className="overview-content">
      <article className="summary-block">
        <p>{chapter.summary}</p>
      </article>

      <div className="overview-metrics" aria-label="Selected chapter metrics">
        <MiniMetric label="Plot points" value={chapterState.plotPoints.length} />
        <MiniMetric label="Characters" value={Object.keys(chapterState.characters).length} />
        <MiniMetric label="Lore" value={chapterState.lore.length} />
        <MiniMetric label="Rules" value={chapterState.worldRules.length} />
        <MiniMetric label="Notes" value={chapterState.authorNotes.length} />
      </div>

      <section className="overview-section">
        <h3>Chunk State</h3>
        <ul>
          {chapterState.plotPoints.slice(0, 5).map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      <section className="overview-section">
        <h3>Tracked In This Chunk</h3>
        <p>
          {Object.keys(chapterState.characters).length} character(s), {chapterState.lore.length} lore item(s),{' '}
          {chapterState.worldRules.length} world rule(s), {chapterState.relationships.length} relationship link(s), and{' '}
          {chapterState.authorNotes.length} author note(s) tracked.
        </p>
      </section>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ItemList({ icon, items, empty }: { icon: ReactNode; items: string[]; empty: string }) {
  if (!items.length) return <Empty icon={icon} text={empty} />

  return (
    <ol className="plot-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  )
}

function AuthorNotesList({ notes }: { notes: AuthorNote[] }) {
  if (!notes.length) {
    return <Empty icon={<ClipboardList size={22} />} text="Bracketed notes will appear here as author tasks." />
  }

  return (
    <div className="stack-list">
      {notes.map((note) => (
        <article className="info-card note-card" key={note.id}>
          <header>
            <strong>{labelForNoteCategory(note.category)}</strong>
            <span>{note.chapterTitle}</span>
          </header>
          <p>{note.text}</p>
        </article>
      ))}
    </div>
  )
}

function Empty({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="empty-panel">
      {icon}
      <p>{text}</p>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="stat">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" className={active ? 'tab active' : 'tab'} onClick={onClick}>
      {icon}
      {label}
    </button>
  )
}

function useStoredProject() {
  const [project, setProject] = useState<StoryProject>(() => {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return defaultProject()

    try {
      return normalizeStoredProject(JSON.parse(stored) as StoryProject)
    } catch {
      return defaultProject()
    }
  })

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(project))
  }, [project])

  return [project, setProject] as const
}

function filterChapters(chapters: Chapter[], query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return chapters

  return chapters.filter((chapter) =>
    [chapter.title, chapter.summary, chapter.text].some((value) => value.toLowerCase().includes(normalized)),
  )
}

function filterReworkChapters(chapters: ReworkChapter[], query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return chapters

  return chapters.filter((chapter) => (
    `${chapter.title} ${chapter.sourcePath}`.toLowerCase().includes(normalized)
  ))
}

function findAffectedChapters(chapters: Chapter[], target: string, instruction: string) {
  const terms = `${target} ${instruction}`
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 3)

  const matches = chapters
    .filter((chapter) => {
      const haystack = `${chapter.title} ${chapter.summary} ${chapter.text}`.toLowerCase()
      return terms.some((term) => haystack.includes(term))
    })
    .map((chapter) => chapter.id)

  return matches.length ? matches : chapters.map((chapter) => chapter.id)
}

function findLoreBackfillChapters(chapters: Chapter[], revealChapterId: string | undefined, detail: string) {
  const revealIndex = revealChapterId
    ? chapters.findIndex((chapter) => chapter.id === revealChapterId)
    : chapters.length
  const candidates = chapters.slice(0, revealIndex > -1 ? revealIndex : chapters.length)
  const terms = detail
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 4)

  const matches = candidates
    .filter((chapter) => {
      const haystack = `${chapter.title} ${chapter.summary} ${chapter.text}`.toLowerCase()
      return terms.some((term) => haystack.includes(term))
    })
    .map((chapter) => chapter.id)

  return matches.length ? matches : candidates.map((chapter) => chapter.id)
}

function normalizeStoredProject(project: StoryProject): StoryProject {
  const normalizedProject = normalizeTextEncoding(project)

  return {
    ...defaultProject(),
    ...normalizedProject,
    worldBible: normalizedProject.worldBible ?? [],
    chapters: (normalizedProject.chapters ?? []).map((chapter) => ({
      ...chapter,
      delta: {
        ...chapter.delta,
        lore: chapter.delta.lore ?? [],
        worldRules: chapter.delta.worldRules ?? deriveWorldRulesFromLore(chapter.delta.lore ?? [], chapter.id),
        relationships: chapter.delta.relationships ?? [],
        authorNotes: chapter.delta.authorNotes ?? [],
      },
    })),
    changes: (normalizedProject.changes ?? []).map((change) => ({
      ...change,
      kind: change.kind ?? 'revision',
    })),
  }
}

function normalizeTextEncoding<T>(value: T): T {
  if (typeof value === 'string') {
    return repairTextEncoding(value) as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeTextEncoding(item)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        repairTextEncoding(key),
        normalizeTextEncoding(entry),
      ]),
    ) as T
  }

  return value
}

function repairTextEncoding(value: string) {
  return value.replace(/([A-Za-z])\?([A-Za-z])/g, '$1\u2019$2')
}

function deriveWorldRulesFromLore(lore: LoreEntry[], chapterId: string): WorldRuleEntry[] {
  return lore
    .filter((entry) => isWorldRuleDetail(entry.detail))
    .map((entry, index) => ({
      ...entry,
      id: `${chapterId}-derived-rule-${index}`,
      title: inferDerivedWorldRuleTitle(entry.detail),
      category: inferDerivedWorldRuleCategory(entry.detail),
    }))
}

function isWorldRuleDetail(detail: string) {
  return containsAny(detail, [
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
    'corrupt',
    'severed',
    'severance',
    'forgotten',
    'remember',
    'memory',
    'myth',
    'universe',
    'existence',
    'domain',
  ])
}

function inferDerivedWorldRuleTitle(detail: string) {
  const category = inferDerivedWorldRuleCategory(detail)
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

function inferDerivedWorldRuleCategory(detail: string): WorldRuleEntry['category'] {
  if (containsAny(detail, ['veil'])) return 'veil'
  if (containsAny(detail, ['guardian', 'sylvanna', 'thalios', 'aeronir', 'ignathar'])) return 'guardians'
  if (containsAny(detail, ['chaos'])) return 'chaos'
  if (containsAny(detail, ['harmony', 'balance', 'lifeforce', 'life force'])) return 'harmony'
  if (containsAny(detail, ['corrupt', 'malakar'])) return 'corruption'
  if (containsAny(detail, ['forgotten', 'forget', 'remember', 'memory', 'myth'])) return 'memory'
  if (containsAny(detail, ['universe', 'existence', 'manifestation', 'domain'])) return 'cosmology'

  return 'magic'
}

function labelForWorldRuleCategory(category: WorldRuleEntry['category']) {
  const labels: Record<WorldRuleEntry['category'], string> = {
    veil: 'Veil',
    harmony: 'Harmony',
    chaos: 'Chaos',
    guardians: 'Guardians',
    memory: 'Memory',
    corruption: 'Corruption',
    cosmology: 'Cosmology',
    magic: 'Magic',
  }

  return labels[category]
}

function labelForWorldBibleStatus(status: WorldBibleEntry['status']) {
  const labels: Record<WorldBibleEntry['status'], string> = {
    canon: 'Canon',
    working: 'Working',
    open: 'Open question',
  }

  return labels[status]
}

function labelForWorldBibleVisibility(visibility: WorldBibleEntry['visibility']) {
  const labels: Record<WorldBibleEntry['visibility'], string> = {
    unrevealed: 'Not yet revealed',
    foreshadowed: 'Foreshadowed',
    revealed: 'Revealed',
  }

  return labels[visibility]
}

function labelForWorldBibleCategory(category: WorldBibleEntry['category']) {
  const labels: Record<WorldBibleEntry['category'], string> = {
    veil: 'Veil',
    harmony: 'Harmony',
    chaos: 'Chaos',
    guardians: 'Guardians',
    memory: 'Memory',
    corruption: 'Corruption',
    cosmology: 'Cosmology',
    magic: 'Magic',
    history: 'History',
    character: 'Character',
    setting: 'Setting',
    'cross-media': 'Cross-media',
  }

  return labels[category]
}

function labelForNoteCategory(category: AuthorNote['category']) {
  const labels: Record<AuthorNote['category'], string> = {
    edit: 'Edit task',
    concern: 'Concern',
    idea: 'Idea',
    research: 'Research',
    task: 'Task',
  }

  return labels[category]
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'story'
}

function containsAny(value: string, markers: string[]) {
  const lowered = value.toLowerCase()
  return markers.some((marker) => lowered.includes(marker))
}

export default App
