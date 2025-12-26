"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"

/* ================= TYPES ================= */

type Attachment = {
  id: string
  filename: string
}

type SentMailStatus = "unread" | "singleCheck" | "doubleCheck" | "read"

type SentMail = {
  id: string
  /** Kann bei Import fehlen → optional & robust gehandhabt */
  subject?: string
  /** Kann bei Import fehlen → optional & robust gehandhabt */
  sentAt?: string
  attachments: Attachment[]
  status?: SentMailStatus
  /** Optionale originale Gmail-Labels (z. B. UNREAD, ✓, ✓✓ etc.) */
  gmailLabels?: string[]
}

type Contact = {
  id: string
  name: string
  email: string
  categoryId?: string | null
  position?: number
  sentMails: SentMail[]
}

type ManualDraft = {
  id: string
  sentAt: string
}

type ThemeMode = "light" | "dark"

type SortMode = "custom" | "az" | "priority"

/* ================= MOCK DATA ================= */

const MOCK_CONTACTS: Contact[] = [
  {
    id: "c1",
    name: "Mike Producer",
    email: "mike@producer.com",
    categoryId: "cat-1",
    sentMails: [
      {
        id: "m1",
        subject: "Beat Pack 01",
        sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        attachments: [
          { id: "a1", filename: "beat_pack_01.zip" },
          { id: "a2", filename: "tracklist.txt" }
        ],
        status: "doubleCheck",
        gmailLabels: ["✓✓", "IMPORTANT"]
      },
      {
        id: "m2",
        subject: "Collab Idea",
        sentAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        attachments: [{ id: "a3", filename: "collab_idea.mp3" }],
        status: "singleCheck",
        gmailLabels: ["✓"]
      }
    ]
  },
  {
    id: "c2",
    name: "Sara Songwriter",
    email: "sara@songs.com",
    categoryId: "cat-2",
    sentMails: [
      {
        id: "m3",
        subject: "Topline Pack",
        sentAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        attachments: [
          { id: "a4", filename: "topline_pack_01.zip" },
          { id: "a5", filename: "lyrics.txt" }
        ],
        status: "doubleCheck",
        gmailLabels: ["✓✓"]
      }
    ]
  },
  {
    id: "c3",
    name: "Alex A&R",
    email: "alex@label.com",
    categoryId: "cat-1",
    sentMails: [
      {
        id: "m4",
        subject: "Listening Session",
        sentAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        attachments: [{ id: "a6", filename: "demo_pack.zip" }],
        status: "unread",
        gmailLabels: ["UNREAD"]
      }
    ]
  },
  {
    id: "c4",
    name: "No Category Guy",
    email: "nocat@example.com",
    categoryId: null,
    sentMails: [
      {
        id: "m5",
        subject: "Random Demo",
        sentAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        attachments: [{ id: "a7", filename: "random_demo.mp3" }],
        status: "read",
        gmailLabels: ["READ"]
      }
    ]
  }
]

/* ================= HELPERS ================= */

const generateId = () => {
  return "id-" + Math.random().toString(36).substr(2, 9)
}

function filterContacts(list: Contact[], search: string) {
  if (!search) return list
  return list.filter(
    c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  )
}

function safeDateMs(dateIso?: string) {
  if (!dateIso) return undefined
  const t = new Date(dateIso).getTime()
  if (!Number.isFinite(t)) return undefined
  return t
}

function daysSince(dateIso?: string) {
  const ms = safeDateMs(dateIso)
  if (ms === undefined) return undefined
  return (Date.now() - ms) / (1000 * 60 * 60 * 24)
}

function getContactLastSent(contact: Contact): string | undefined {
  const mails = contact.sentMails ?? []
  let maxMs: number | undefined
  let bestIso: string | undefined

  for (const m of mails) {
    if (!m.sentAt) continue
    const ms = safeDateMs(m.sentAt)
    if (ms === undefined) continue
    if (maxMs === undefined || ms > maxMs) {
      maxMs = ms
      bestIso = m.sentAt
    }
  }

  return bestIso
}

function getSortedContactsForCategory(
  allContacts: Contact[],
  categoryId: string | null,
  search: string,
  sortMode: SortMode
): Contact[] {
  let list = allContacts.filter(c =>
    categoryId === null ? !c.categoryId : c.categoryId === categoryId
  )

  list = filterContacts(list, search)

  if (sortMode === "az") {
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    )
  }

  if (sortMode === "priority") {
    const scored = list.map(c => {
      const last = getContactLastSent(c)
      const d = daysSince(last)
      const score = d === undefined ? Number.POSITIVE_INFINITY : d
      return { c, score }
    })

    return scored.sort((a, b) => b.score - a.score).map(x => x.c)
  }

  return list
}

function getStatusColor(lastSentAt?: string, priorityAfterDays = 30) {
  const days = daysSince(lastSentAt)
  if (days === undefined) return "bg-gray-300 dark:bg-zinc-700"

  if (days >= priorityAfterDays) return "bg-red-400"
  if (days >= priorityAfterDays / 2) return "bg-yellow-300"
  return "bg-green-400"
}

function formatDate(dateIso?: string) {
  if (!dateIso) return ""
  const d = new Date(dateIso)
  if (!Number.isFinite(d.getTime())) return ""
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  })
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function sanitizeEmail(email: string) {
  return email.trim().replace(/[^\w@.+-]/g, "")
}

function isValidEmail(email: string) {
  // sehr einfache, aber robuste Email-Validierung
  if (!email) return false
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

/* ================= ICONS ================= */

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M5 12h14M12 5v14" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862A2 2 0 015.867 19.142L5 7m5-4h4a1 1 0 011 1v3M4 7h16"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function NoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6M9 16h6M9 8h6M5 3h10a2 2 0 012 2v14l-4-2H5a2 2 0 01-2-2V5a2 2 0 012-2z"
      />
    </svg>
  )
}

/* ================= HOOKS ================= */

function useOnClickOutside(
  refs: Array<React.RefObject<HTMLElement | null>>,
  handler: () => void,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) return

    const listener = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      const clickedInside = refs.some(ref => ref.current?.contains(target))
      if (!clickedInside) handler()
    }

    document.addEventListener("mousedown", listener)
    document.addEventListener("touchstart", listener)

    return () => {
      document.removeEventListener("mousedown", listener)
      document.removeEventListener("touchstart", listener)
    }
  }, [refs, handler, enabled])
}

/* ================= COMPONENTS ================= */

type ContactRowProps = {
  contact: Contact
  priorityAfterDays: number
  manualDrafts: ManualDraft[]
  setManualDrafts: React.Dispatch<React.SetStateAction<ManualDraft[]>>
  onUpdateMailNote: (contactId: string, mailId: string, note: string) => void
  onDeleteContact?: (contactId: string) => void
  onDeleteMail?: (contactId: string, mailId: string) => void
  onUpdateContactName?: (contactId: string, name: string) => void
  onUpdateContactEmail?: (contactId: string, email: string) => void
  isDeleting: boolean
  onManualDraftPlaced: (draftId: string) => void
  justPlacedDraftId?: string | null
  onReorderMail: (contactId: string, mailId: string, newIndex: number) => void
}

function ContactRow({
  contact,
  priorityAfterDays,
  manualDrafts,
  setManualDrafts,
  onUpdateMailNote,
  onDeleteContact,
  onDeleteMail,
  onUpdateContactName,
  onUpdateContactEmail,
  isDeleting,
  onManualDraftPlaced,
  justPlacedDraftId,
  onReorderMail
}: ContactRowProps) {
  const mails = contact.sentMails ?? []

  const lastSent = useMemo(() => getContactLastSent(contact), [contact])

  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [tempName, setTempName] = useState(contact.name)
  const [tempEmail, setTempEmail] = useState(contact.email)
  const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null)
  const [justDroppedMailId, setJustDroppedMailId] = useState<string | null>(null)

  const scrollerRef = useRef<HTMLDivElement>(null)

  const handleNameSave = () => {
    if (onUpdateContactName && tempName.trim() && tempName !== contact.name) {
      onUpdateContactName(contact.id, tempName.trim())
    }
    setIsEditingName(false)
  }

  const handleEmailSave = () => {
    if (onUpdateContactEmail && tempEmail.trim() && tempEmail !== contact.email) {
      onUpdateContactEmail(contact.id, tempEmail.trim())
    }
    setIsEditingEmail(false)
  }

  useEffect(() => {
    setTempName(contact.name)
  }, [contact.name])

  useEffect(() => {
    setTempEmail(contact.email)
  }, [contact.email])

  useEffect(() => {
    if (!justDroppedMailId) return
    const timeout = setTimeout(() => setJustDroppedMailId(null), 400)
    return () => clearTimeout(timeout)
  }, [justDroppedMailId])

  const handleDragStartMail = (mailId: string, e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("mail", mailId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOverZone = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const mailId = e.dataTransfer.getData("mail")
    if (!mailId) return
    if (activeInsertIndex !== index) setActiveInsertIndex(index)
  }

  const handleDropMailAt = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const mailId = e.dataTransfer.getData("mail")
    if (!mailId) return
    setActiveInsertIndex(null)
    onReorderMail(contact.id, mailId, index)
    setJustDroppedMailId(mailId)
  }

  const clearActiveInsert = () => setActiveInsertIndex(null)

  const renderDropZone = (index: number) => (
    <div
      key={`dz-${index}`}
      onDragOver={e => handleDragOverZone(index, e)}
      onDrop={e => handleDropMailAt(index, e)}
      onDragLeave={clearActiveInsert}
      className={`h-10 w-1 rounded-full self-stretch transition-colors ${
        activeInsertIndex === index ? "bg-blue-500" : "bg-transparent"
      }`}
    />
  )

  return (
    <div
      className={`grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,3fr)_auto] gap-3 px-4 py-3 border-t border-zinc-100 dark:border-zinc-900/60 ${
        isDeleting ? "opacity-80" : ""
      }`}
      draggable={!isDeleting}
      onDragStart={e => {
        if (isDeleting) return
        e.dataTransfer.setData("contact", contact.id)
        e.dataTransfer.effectAllowed = "move"
      }}
    >
      {/* Name */}
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-zinc-400" />
        {isEditingName ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              value={tempName}
              onChange={e => setTempName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={e => {
                if (e.key === "Enter") handleNameSave()
                if (e.key === "Escape") {
                  setTempName(contact.name)
                  setIsEditingName(false)
                }
              }}
              className="text-sm bg-transparent border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 flex-1 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={handleNameSave}
              className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="text-sm font-medium text-left text-zinc-900 dark:text-zinc-50 hover:underline"
            onClick={() => setIsEditingName(true)}
          >
            {contact.name}
          </button>
        )}
      </div>

      {/* Email */}
      <div className="flex items-center">
        {isEditingEmail ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              type="email"
              value={tempEmail}
              onChange={e => setTempEmail(e.target.value)}
              onBlur={handleEmailSave}
              onKeyDown={e => {
                if (e.key === "Enter") handleEmailSave()
                if (e.key === "Escape") {
                  setTempEmail(contact.email)
                  setIsEditingEmail(false)
                }
              }}
              className="text-sm bg-transparent border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 flex-1 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={handleEmailSave}
              className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="text-sm text-left text-zinc-600 dark:text-zinc-300 hover:underline"
            onClick={() => setIsEditingEmail(true)}
          >
            {contact.email}
          </button>
        )}
      </div>

      {/* Mails */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">Activity</span>
            {lastSent && (
              <>
                <span className="text-[11px] text-zinc-400">•</span>
                <span className="text-[11px] text-zinc-500">Last sent: {formatDate(lastSent)}</span>
              </>
            )}
          </div>

          <div className={`flex items-center gap-1`}>
            <div
              className={`w-16 h-1.5 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 ${
                lastSent ? "" : "opacity-40"
              }`}
            >
              <div className={`h-full ${getStatusColor(lastSent, priorityAfterDays)}`} />
            </div>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "thin" }}
        >
          {mails.map((mail, index) => (
            <React.Fragment key={mail.id}>
              {renderDropZone(index)}
              <div
                className={`relative flex-shrink-0 w-64 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 px-3 py-2 text-xs transition-all ${
                  justDroppedMailId === mail.id ? "animate-dropIn" : ""
                }`}
                draggable={!isDeleting}
                onDragStart={e => handleDragStartMail(mail.id, e)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="truncate font-medium text-xs text-zinc-900 dark:text-zinc-50">
                        {mail.subject || "No subject"}
                      </span>
                      {mail.gmailLabels?.includes("UNREAD") && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                          UNREAD
                        </span>
                      )}
                      {mail.gmailLabels?.includes("✓✓") && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                          ✓✓
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 mb-1">
                      Sent: {formatDate(mail.sentAt) || "Unknown"}
                    </div>
                    {mail.attachments.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {mail.attachments.map(att => (
                          <div
                            key={att.id}
                            className="flex items-center gap-1 text-[11px] text-zinc-700 dark:text-zinc-200"
                          >
                            <span className="inline-block w-3 h-3 rounded bg-zinc-300 dark:bg-zinc-700" />
                            <span className="truncate">{att.filename}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const note = prompt("Add / edit note for this mail:", "") ?? ""
                        onUpdateMailNote(contact.id, mail.id, note)
                      }}
                      className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100"
                      title="Add note"
                    >
                      <NoteIcon className="w-4 h-4" />
                    </button>

                    {onDeleteMail && isDeleting && (
                      <button
                        type="button"
                        onClick={() => onDeleteMail(contact.id, mail.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          ))}

          {renderDropZone(mails.length)}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-start justify-end">
        {onDeleteContact && isDeleting ? (
          <button
            type="button"
            onClick={() => onDeleteContact(contact.id)}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Delete contact
          </button>
        ) : (
          <span className="text-[10px] text-zinc-400 uppercase tracking-wide">Drag card to reorder</span>
        )}
      </div>
    </div>
  )
}

/* ================= SEARCH BAR ================= */

type SearchBarProps = {
  search: string
  setSearch: (value: string) => void
}

function SearchBar({ search, setSearch }: SearchBarProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSearchClick = () => {
    if (!isExpanded) {
      setIsExpanded(true)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 10)
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const relatedTarget = e.relatedTarget as HTMLElement
    if (relatedTarget?.tagName === "BUTTON" && relatedTarget.title === "Clear search") return
    if (!search) setIsExpanded(false)
  }

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={handleSearchClick}
        className="w-10 h-10 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M11 5a6 6 0 100 12 6 6 0 000-12z"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="relative w-64">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onBlur={handleBlur}
            className="w-full pl-3 pr-7 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-md bg-transparent focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            placeholder="Search name or email…"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("")
                inputRef.current?.focus()
              }}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              title="Clear search"
              tabIndex={-1}
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ================= MANUAL DRAFT SOURCE ================= */

type ManualDraftSourceProps = {
  isDeletingMode: boolean
  manualDrafts: ManualDraft[]
  setManualDrafts: React.Dispatch<React.SetStateAction<ManualDraft[]>>
  onDraftCreated?: (draftId: string) => void
  isPulsing?: boolean
  isDragging?: boolean
}

function ManualDraftSource({
  isDeletingMode,
  manualDrafts,
  setManualDrafts,
  onDraftCreated,
  isPulsing,
  isDragging
}: ManualDraftSourceProps) {
  const topCardRef = useRef<HTMLDivElement>(null)

  if (isDeletingMode) return null

  return (
    <div
      draggable
      onDragStart={e => {
        const draft: ManualDraft = { id: generateId(), sentAt: new Date().toISOString() }
        setManualDrafts(prev => [...prev, draft])
        e.dataTransfer.setData("manualDraft", draft.id)
        e.dataTransfer.effectAllowed = "copy"
        if (onDraftCreated) onDraftCreated(draft.id)
      }}
      className={`relative flex flex-col items-center justify-center w-28 h-16 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/40 cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? "scale-[1.02]" : ""
      }`}
    >
      <div className="absolute -top-6 left-1/2 -translate-x-1/2">
        <div
          ref={topCardRef}
          className={`w-20 h-10 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex items-center justify-center text-[10px] font-medium text-zinc-600 dark:text-zinc-300 ${
            isPulsing ? "animate-wobble" : ""
          }`}
        >
          DRAG ME
        </div>
      </div>
    </div>
  )
}

/* ================= NEW CATEGORY & UNCATEGORIZED SECTIONS (WITH SORTING) ================= */

function CategorySectionNew({
  category,
  isDeletingMode,
  selectedItems,
  onToggleSelection,
  onUpdateCategoryName,
  contacts,
  search,
  sortMode,
  priorityAfterDays,
  manualDrafts,
  setManualDrafts,
  onUpdateMailNote,
  onUpdateContactName,
  onUpdateContactEmail,
  onDeleteContact,
  onDeleteMail,
  onDragContactToCategory,
  onManualDraftPlaced,
  justPlacedDraftId,
  onReorderMail,
  onReorderContact
}: {
  category: Category
  isDeletingMode: boolean
  selectedItems: string[]
  onToggleSelection: (itemId: string) => void
  onUpdateCategoryName: (categoryId: string, name: string) => void
  contacts: Contact[]
  search: string
  sortMode: SortMode
  priorityAfterDays: number
  manualDrafts: ManualDraft[]
  setManualDrafts: React.Dispatch<React.SetStateAction<ManualDraft[]>>
  onUpdateMailNote: (contactId: string, mailId: string, note: string) => void
  onUpdateContactName: (contactId: string, name: string) => void
  onUpdateContactEmail: (contactId: string, email: string) => void
  onDeleteContact: (contactId: string) => void
  onDeleteMail: (contactId: string, mailId: string) => void
  onDragContactToCategory: (contactId: string, categoryId: string) => void
  onManualDraftPlaced: (draftId: string) => void
  justPlacedDraftId?: string | null
  onReorderMail: (contactId: string, mailId: string, newIndex: number) => void
  onReorderContact: (contactId: string, categoryId: string | null, newIndex: number) => void
}) {
  const [isEditingCategory, setIsEditingCategory] = useState(false)
  const [tempCategoryName, setTempCategoryName] = useState(category.name)
  const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null)

  const visibleContacts = useMemo(
    () => getSortedContactsForCategory(contacts, category.id, search, sortMode),
    [contacts, category.id, search, sortMode]
  )

  const handleCategorySave = () => {
    if (tempCategoryName.trim() && tempCategoryName !== category.name) {
      onUpdateCategoryName(category.id, tempCategoryName.trim())
    }
    setIsEditingCategory(false)
  }

  useEffect(() => {
    setTempCategoryName(category.name)
  }, [category.name])

  const handleGapDragOver = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    if (sortMode !== "custom" || isDeletingMode) return
    const contactId = e.dataTransfer.getData("contact")
    if (!contactId) return
    e.preventDefault()
    if (activeInsertIndex !== index) setActiveInsertIndex(index)
  }

  const handleGapDrop = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    if (sortMode !== "custom" || isDeletingMode) return
    e.preventDefault()
    e.stopPropagation()
    setActiveInsertIndex(null)
    const contactId = e.dataTransfer.getData("contact")
    if (!contactId) return
    onReorderContact(contactId, category.id, index)
  }

  const clearActiveGap = () => setActiveInsertIndex(null)

  const renderGap = (index: number) => (
    <div
      key={`gap-${index}`}
      onDragOver={e => handleGapDragOver(index, e)}
      onDrop={e => handleGapDrop(index, e)}
      onDragLeave={clearActiveGap}
      className={`h-2 mx-4 rounded-full transition-colors ${
        sortMode === "custom" && activeInsertIndex === index
          ? "bg-blue-400/70 dark:bg-blue-500/80"
          : "bg-transparent"
      }`}
    />
  )

  return (
    <div
      className="border border-zinc-200 dark:border-zinc-800 rounded overflow-hidden"
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        if (isDeletingMode) return
        const contactId = e.dataTransfer.getData("contact")
        if (!contactId) return
        if (sortMode === "custom") {
          onReorderContact(contactId, category.id, visibleContacts.length)
        } else {
          onDragContactToCategory(contactId, category.id)
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
        <div className="flex items-center gap-2">
          {isDeletingMode && (
            <input
              type="checkbox"
              checked={selectedItems.includes(`category_${category.id}`)}
              onChange={() => onToggleSelection(`category_${category.id}`)}
              className="h-4 w-4 rounded text-red-500 focus:ring-red-500"
            />
          )}

          {isEditingCategory ? (
            <div className="flex items-center gap-1">
              <input
                value={tempCategoryName}
                onChange={e => setTempCategoryName(e.target.value)}
                onBlur={handleCategorySave}
                onKeyDown={e => {
                  if (e.key === "Enter") handleCategorySave()
                  if (e.key === "Escape") {
                    setTempCategoryName(category.name)
                    setIsEditingCategory(false)
                  }
                }}
                className="text-xs font-semibold uppercase bg-transparent border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <button onClick={handleCategorySave} className="text-xs text-blue-500 hover:text-blue-700 px-2">
                ✓
              </button>
            </div>
          ) : (
            <div
              className="text-xs font-semibold uppercase text-zinc-700 dark:text-zinc-200 flex-1 hover:bg-zinc-100 dark:hover:bg-zinc-900 px-2 py-1 rounded cursor-text"
              onClick={() => setIsEditingCategory(true)}
              title="Click to edit category name"
            >
              {category.name}
            </div>
          )}
        </div>
      </div>

      {/* Contacts */}
      {visibleContacts.length === 0
        ? null
        : visibleContacts.map((contact, index) => (
            <React.Fragment key={contact.id}>
              {sortMode === "custom" && renderGap(index)}

              <div className="relative">
                {isDeletingMode && (
                  <div className="absolute left-2 top-1/2 transform -translate-y-1/2 z-20">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(`contact_${contact.id}`)}
                      onChange={() => onToggleSelection(`contact_${contact.id}`)}
                      className="h-4 w-4 rounded text-red-500 focus:ring-red-500"
                    />
                  </div>
                )}

                <ContactRow
                  contact={contact}
                  priorityAfterDays={priorityAfterDays}
                  manualDrafts={manualDrafts}
                  setManualDrafts={setManualDrafts}
                  onUpdateMailNote={onUpdateMailNote}
                  onUpdateContactName={onUpdateContactName}
                  onUpdateContactEmail={onUpdateContactEmail}
                  onDeleteContact={isDeletingMode ? onDeleteContact : undefined}
                  onDeleteMail={isDeletingMode ? onDeleteMail : undefined}
                  isDeleting={isDeletingMode}
                  onManualDraftPlaced={onManualDraftPlaced}
                  justPlacedDraftId={justPlacedDraftId}
                  onReorderMail={onReorderMail}
                />
              </div>
            </React.Fragment>
          ))}

      {sortMode === "custom" && visibleContacts.length > 0 && renderGap(visibleContacts.length)}
    </div>
  )
}

function UncategorizedSection({
  isDeletingMode,
  selectedItems,
  toggleItemSelection,
  contacts,
  search,
  sortMode,
  priorityAfterDays,
  manualDrafts,
  setManualDrafts,
  onUpdateMailNote,
  onUpdateContactName,
  onUpdateContactEmail,
  onDeleteContact,
  onDeleteMail,
  onManualDraftPlaced,
  justPlacedDraftId,
  onReorderMail,
  onReorderContact
}: {
  isDeletingMode: boolean
  selectedItems: string[]
  toggleItemSelection: (itemId: string) => void
  contacts: Contact[]
  search: string
  sortMode: SortMode
  priorityAfterDays: number
  manualDrafts: ManualDraft[]
  setManualDrafts: React.Dispatch<React.SetStateAction<ManualDraft[]>>
  onUpdateMailNote: (contactId: string, mailId: string, note: string) => void
  onUpdateContactName: (contactId: string, name: string) => void
  onUpdateContactEmail: (contactId: string, email: string) => void
  onDeleteContact: (contactId: string) => void
  onDeleteMail: (contactId: string, mailId: string) => void
  onManualDraftPlaced: (draftId: string) => void
  justPlacedDraftId?: string | null
  onReorderMail: (contactId: string, mailId: string, newIndex: number) => void
  onReorderContact: (contactId: string, categoryId: string | null, newIndex: number) => void
}) {
  const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null)

  const visibleContacts = useMemo(
    () => getSortedContactsForCategory(contacts, null, search, sortMode),
    [contacts, search, sortMode]
  )

  const handleGapDragOver = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    if (sortMode !== "custom" || isDeletingMode) return
    const contactId = e.dataTransfer.getData("contact")
    if (!contactId) return
    e.preventDefault()
    if (activeInsertIndex !== index) setActiveInsertIndex(index)
  }

  const handleGapDrop = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    if (sortMode !== "custom" || isDeletingMode) return
    e.preventDefault()
    e.stopPropagation()
    setActiveInsertIndex(null)
    const contactId = e.dataTransfer.getData("contact")
    if (!contactId) return
    onReorderContact(contactId, null, index)
  }

  const clearActiveGap = () => setActiveInsertIndex(null)

  const renderGap = (index: number) => (
    <div
      key={`uncat-gap-${index}`}
      onDragOver={e => handleGapDragOver(index, e)}
      onDrop={e => handleGapDrop(index, e)}
      onDragLeave={clearActiveGap}
      className={`h-2 mx-4 rounded-full transition-colors ${
        sortMode === "custom" && activeInsertIndex === index
          ? "bg-blue-400/70 dark:bg-blue-500/80"
          : "bg-transparent"
      }`}
    />
  )

  return (
    <div
      className="border border-zinc-200 dark:border-zinc-800 rounded overflow-hidden"
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        if (isDeletingMode) return
        const contactId = e.dataTransfer.getData("contact")
        if (!contactId) return

        if (sortMode === "custom") {
          onReorderContact(contactId, null, visibleContacts.length)
        } else {
          onReorderContact(contactId, null, visibleContacts.length)
        }
      }}
    >
      <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
        Uncategorized
      </div>

      {visibleContacts.length === 0
        ? null
        : visibleContacts.map((contact, index) => (
            <React.Fragment key={contact.id}>
              {sortMode === "custom" && renderGap(index)}

              <div className="relative">
                {isDeletingMode && (
                  <div className="absolute left-2 top-1/2 transform -translate-y-1/2 z-20">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(`contact_${contact.id}`)}
                      onChange={() => toggleItemSelection(`contact_${contact.id}`)}
                      className="h-4 w-4 rounded text-red-500 focus:ring-red-500"
                    />
                  </div>
                )}

                <ContactRow
                  contact={contact}
                  priorityAfterDays={priorityAfterDays}
                  manualDrafts={manualDrafts}
                  setManualDrafts={setManualDrafts}
                  onUpdateMailNote={onUpdateMailNote}
                  onUpdateContactName={onUpdateContactName}
                  onUpdateContactEmail={onUpdateContactEmail}
                  onDeleteContact={isDeletingMode ? onDeleteContact : undefined}
                  onDeleteMail={isDeletingMode ? onDeleteMail : undefined}
                  isDeleting={isDeletingMode}
                  onManualDraftPlaced={onManualDraftPlaced}
                  justPlacedDraftId={justPlacedDraftId}
                  onReorderMail={onReorderMail}
                />
              </div>
            </React.Fragment>
          ))}

      {sortMode === "custom" && visibleContacts.length > 0 && renderGap(visibleContacts.length)}
    </div>
  )
}

/* ================= MAIN DASHBOARD ================= */

export default function DashboardPage() {
  const [categories, setCategories] = useState<Category[]>([
    { id: "cat-1", name: "Producer" },
    { id: "cat-2", name: "Songwriter" }
  ])

  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [priorityAfterDays, setPriorityAfterDays] = useState(30)
  const [scanning, setScanning] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>("custom")

  const [manualDrafts, setManualDrafts] = useState<ManualDraft[]>([])
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showDataMenu, setShowDataMenu] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContactName, setNewContactName] = useState("")
  const [newContactEmail, setNewContactEmail] = useState("")
  const [isDeletingMode, setIsDeletingMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [theme, setTheme] = useState<ThemeMode>("light")
  const [showSettings, setShowSettings] = useState(false)
  const [justPlacedDraftId, setJustPlacedDraftId] = useState<string | null>(null)

  const [isDraggingManualDraft, setIsDraggingManualDraft] = useState(false)
  const [isManualDraftSourcePulsing, setIsManualDraftSourcePulsing] = useState(false)

  const addMenuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const dataMenuRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const closeAllMenus = () => {
    setShowAddMenu(false)
    setShowUserMenu(false)
    setShowDataMenu(false)
    setShowAddCategory(false)
    setShowAddContact(false)
  }

  useOnClickOutside([addMenuRef, userMenuRef, dataMenuRef, settingsRef], closeAllMenus, true)

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("dashboard-theme") as ThemeMode | null
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme)
      document.documentElement.classList.toggle("dark", savedTheme === "dark")
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      const initialTheme: ThemeMode = prefersDark ? "dark" : "light"
      setTheme(initialTheme)
      document.documentElement.classList.toggle("dark", initialTheme === "dark")
    }
  }, [])

  useEffect(() => {
    if (!loading) {
      const storedContacts = window.localStorage.getItem("dashboard-contacts")
      const storedCategories = window.localStorage.getItem("dashboard-categories")

      if (storedContacts && storedCategories) {
        try {
          setContacts(JSON.parse(storedContacts))
          setCategories(JSON.parse(storedCategories))
          return
        } catch (error) {
          console.error("Error parsing stored data:", error)
        }
      }
    }
  }, [loading])

  useEffect(() => {
    if (!loading) {
      window.localStorage.setItem("dashboard-contacts", JSON.stringify(contacts))
      window.localStorage.setItem("dashboard-categories", JSON.stringify(categories))
    }
  }, [contacts, categories, loading])

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 600)
    setTimeout(() => {
      setContacts(MOCK_CONTACTS)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    window.localStorage.setItem("dashboard-theme", theme)
  }, [theme])

  const handleScan = () => {
    if (scanning) return
    setScanning(true)
    setTimeout(() => setScanning(false), 2000)
  }

  const handleUpdateMailNote = (contactId: string, mailId: string, note: string) => {
    console.log("Note updated for", { contactId, mailId, note })
  }

  const handleChangeAccount = () => {
    alert("Change account clicked (demo only)")
  }

  const handleExportGmail = () => {
    alert("Export from Gmail clicked (demo only)")
  }

  const handleImportCsv = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (file: File) => {
    const text = await file.text()
    const imported = parseCsv(text)
    if (!imported.length) {
      alert("No valid rows found in CSV.")
      return
    }

    const newContacts: Contact[] = imported.map(row => ({
      id: generateId(),
      name: row.name || "(no name)",
      email: sanitizeEmail(row.email),
      categoryId: null,
      sentMails: []
    }))

    setContacts(prev => [...prev, ...newContacts])
  }

  const parseCsv = (text: string): { name: string; email: string }[] => {
    type ImportedRow = { name: string; email: string }

    const lines = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)

    if (lines.length === 0) return []

    const sample = lines.slice(0, 5).join("\n")
    const candidates = [",", ";", "\t"]
    const delimiter =
      candidates
        .map(d => ({ d, count: (sample.match(new RegExp(`\\${d}`, "g")) ?? []).length }))
        .sort((a, b) => b.count - a.count)[0]?.d ?? ","

    const rows: ImportedRow[] = []
    for (const line of lines) {
      const cols = line
        .split(delimiter)
        .map(c => c.trim().replace(/^"|"$/g, ""))

      const name = cols[0] ?? ""
      const email = sanitizeEmail(cols[1] ?? "")
      if (!name && !email) continue

      rows.push({ name, email })
    }

    if (rows.length > 1) {
      const [first, second] = rows
      if (sanitizeEmail(first.email) === "" && sanitizeEmail(second.email) !== "") {
        return rows.slice(1)
      }
    }

    return rows
  }

  const updateMailNote = (contactId: string, mailId: string, note: string) => {
    console.log("Mail note updated", { contactId, mailId, note })
  }

  const updateContactName = (contactId: string, name: string) => {
    setContacts(prev => prev.map(contact => (contact.id === contactId ? { ...contact, name } : contact)))
  }

  const updateContactEmail = (contactId: string, email: string) => {
    setContacts(prev => prev.map(contact => (contact.id === contactId ? { ...contact, email } : contact)))
  }

  const updateCategoryName = (categoryId: string, name: string) => {
    setCategories(prev => prev.map(category => (category.id === categoryId ? { ...category, name } : category)))
  }

  const deleteMail = (contactId: string, mailId: string) => {
    if (confirm("Are you sure you want to delete this mail?")) {
      setContacts(prev =>
        prev.map(contact => {
          if (contact.id === contactId) {
            return { ...contact, sentMails: contact.sentMails.filter(mail => mail.id !== mailId) }
          }
          return contact
        })
      )
    }
  }

  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactEmail.trim()) return
    const email = sanitizeEmail(newContactEmail)
    if (!isValidEmail(email)) {
      alert("Please enter a valid email.")
      return
    }

    const newContact: Contact = {
      id: generateId(),
      name: newContactName.trim(),
      email,
      categoryId: null,
      sentMails: []
    }

    setContacts(prev => [...prev, newContact])
    setNewContactName("")
    setNewContactEmail("")
    setShowAddContact(false)
  }

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return
    const newCategory: { id: string; name: string } = {
      id: generateId(),
      name: newCategoryName.trim()
    }
    setCategories(prev => [...prev, newCategory])
    setNewCategoryName("")
    setShowAddCategory(false)
  }

  const handleDeleteContact = (contactId: string) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      setContacts(prev => prev.filter(c => c.id !== contactId))
    }
  }

  const handleDragContactToCategory = (contactId: string, categoryId: string) => {
    setContacts(prev => prev.map(c => (c.id === contactId ? { ...c, categoryId } : c)))
  }

  const handleDragContactToUncategorized = (contactId: string) => {
    setContacts(prev => prev.map(c => (c.id === contactId ? { ...c, categoryId: null } : c)))
  }

  const handleManualDraftPlaced = (draftId: string) => {
    setManualDrafts(prev => prev.filter(d => d.id !== draftId))
    setJustPlacedDraftId(draftId)
    setIsManualDraftSourcePulsing(true)
    setTimeout(() => setIsManualDraftSourcePulsing(false), 600)
  }

  const handleReorderMail = (contactId: string, mailId: string, newIndex: number) => {
    setContacts(prev =>
      prev.map(c => {
        if (c.id !== contactId) return c
        const currentIndex = c.sentMails.findIndex(m => m.id === mailId)
        if (currentIndex === -1 || currentIndex === newIndex) return c

        const next = [...c.sentMails]
        const [moved] = next.splice(currentIndex, 1)
        const clampedIndex = Math.max(0, Math.min(newIndex, next.length))
        next.splice(clampedIndex, 0, moved)
        return { ...c, sentMails: next }
      })
    )
  }

  const handleReorderContact = (contactId: string, targetCategoryId: string | null, newIndex: number) => {
    setContacts(prev => {
      const moving = prev.find(c => c.id === contactId)
      if (!moving) return prev

      const updatedMoving: Contact = { ...moving, categoryId: targetCategoryId ?? null }

      const others = prev.filter(c => c.id !== contactId)

      const sameCategory = others.filter(c =>
        targetCategoryId === null ? !c.categoryId : c.categoryId === targetCategoryId
      )

      const clampedIndex = Math.max(0, Math.min(newIndex, sameCategory.length))

      const newSameCategory = [...sameCategory]
      newSameCategory.splice(clampedIndex, 0, updatedMoving)

      let sameCatCursor = 0
      const result: Contact[] = []

      for (const c of others) {
        const isTarget =
          targetCategoryId === null ? !c.categoryId : c.categoryId === targetCategoryId

        if (isTarget) {
          result.push(newSameCategory[sameCatCursor])
          sameCatCursor++
        } else {
          result.push(c)
        }
      }

      while (sameCatCursor < newSameCategory.length) {
        result.push(newSameCategory[sameCatCursor++])
      }

      return result
    })
  }

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => (prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]))
  }

  const allSelectableIds = useMemo(() => {
    const ids: string[] = []
    for (const category of categories) {
      ids.push(`category_${category.id}`)
    }
    for (const contact of contacts) {
      ids.push(`contact_${contact.id}`)
      for (const mail of contact.sentMails) {
        ids.push(`mail_${mail.id}`)
      }
    }
    return ids
  }, [categories, contacts])

  const deleteItems = (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return

    const hasContacts = idsToDelete.some(id => id.startsWith("contact_"))
    const hasMails = idsToDelete.some(id => id.startsWith("mail_"))
    const hasCategories = idsToDelete.some(id => id.startsWith("category_"))

    const parts: string[] = []
    if (hasContacts) parts.push("contacts")
    if (hasMails) parts.push("mails")
    if (hasCategories) parts.push("categories")

    if (
      confirm(
        `Are you sure you want to delete ${idsToDelete.length} items? (${parts.join(
          ", "
        )}) This cannot be undone.`
      )
    ) {
      const contactIds = idsToDelete.filter(id => id.startsWith("contact_")).map(id => id.replace("contact_", ""))
      const mailIds = idsToDelete.filter(id => id.startsWith("mail_")).map(id => id.replace("mail_", ""))
      const categoryIds = idsToDelete
        .filter(id => id.startsWith("category_"))
        .map(id => id.replace("category_", ""))

      if (contactIds.length > 0) {
        setContacts(prev => prev.filter(c => !contactIds.includes(c.id)))
      }

      if (mailIds.length > 0) {
        setContacts(prev =>
          prev.map(c => ({
            ...c,
            sentMails: c.sentMails.filter(m => !mailIds.includes(m.id))
          }))
        )
      }

      if (categoryIds.length > 0) {
        setCategories(prev => prev.filter(c => !categoryIds.includes(c.id)))
        setContacts(prev =>
          prev.map(c => (c.categoryId && categoryIds.includes(c.categoryId) ? { ...c, categoryId: null } : c))
        )
      }

      setSelectedItems([])
      setIsDeletingMode(false)
    }
  }

  const handleDeleteSelected = () => deleteItems(selectedItems)
  const handleSelectAll = () => setSelectedItems(allSelectableIds)
  const handleClearSelection = () => setSelectedItems([])
  const handleDeleteAll = () => deleteItems(allSelectableIds)

  const handleCsvExport = () => {
    const categoryNameById = new Map(categories.map(c => [c.id, c.name]))
    const lines = [
      ["name", "email", "category"].join(","),
      ...contacts.map(c => {
        const cat = c.categoryId ? categoryNameById.get(c.categoryId) ?? "" : ""
        const safe = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`

        return [safe(c.name), safe(c.email), safe(cat)].join(",")
      })
    ]
    downloadTextFile("contacts_export.csv", lines.join("\n"))
  }

  const handleCsvImport = () => {
    fileInputRef.current?.click()
  }

  const handleThemeToggle = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"))
  }

  const handleOpenSettings = () => {
    setShowSettings(true)
    closeAllMenus()
  }

  const handleManualDraftCreated = (draftId: string) => {
    console.log("Manual draft created:", draftId)
  }

  const handleManualDraftDragStart = () => {
    setIsDraggingManualDraft(true)
  }

  const handleManualDraftDragEnd = () => {
    setIsDraggingManualDraft(false)
  }

  useEffect(() => {
    if (!justPlacedDraftId) return
    const timeout = setTimeout(() => setJustPlacedDraftId(null), 500)
    return () => clearTimeout(timeout)
  }, [justPlacedDraftId])

  const hasUncategorizedContacts = contacts.filter(c => !c.categoryId).length > 0

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-zinc-400 bg-white dark:bg-zinc-950">
        Loading dashboard…
      </div>
    )
  }

  return (
    <div
      className={[
        theme === "dark" ? "dark" : "",
        "h-screen flex flex-col",
        "bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
      ].join(" ")}
      style={{
        fontFamily:
          '"Azeret Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
      }}
    >
      <style jsx global>{`
        @keyframes wobble {
          0% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(-2deg);
          }
          50% {
            transform: rotate(2deg);
          }
          75% {
            transform: rotate(-1deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }
        .animate-wobble {
          animation: wobble 0.55s ease-in-out infinite;
        }

        @keyframes dropIn {
          0% {
            transform: scale(1.06);
          }
          60% {
            transform: scale(0.98);
          }
          85% {
            transform: scale(1.02);
          }
          100% {
            transform: scale(1);
          }
        }
        .animate-dropIn {
          animation: dropIn 0.35s ease-out;
        }

        @keyframes stackPush {
          0% {
            transform: translateY(0);
          }
          55% {
            transform: translateY(-4px);
          }
          100% {
            transform: translateY(0);
          }
        }
        .animate-stackPush {
          animation: stackPush 0.25s ease-out;
        }

        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation: marquee 14s linear infinite;
        }
      `}</style>

      {/* HEADER */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight">Contact Flow</span>
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-500">
                Beta
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-1">
              <span>Send packs faster. Follow up smarter.</span>
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-900">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Gmail sync live</span>
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <SearchBar search={search} setSearch={setSearch} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* SCAN BUTTON */}
          <button
            onClick={handleScan}
            disabled={scanning || isDeletingMode}
            className={`relative flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium border transition-all ${
              scanning
                ? "border-blue-500 bg-blue-500 text-white shadow-sm"
                : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-900/60"
            } ${isDeletingMode ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            {scanning ? (
              <>
                <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Scanning…</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
                  <path d="M4 9h16M9 4v16" strokeWidth={2} />
                </svg>
                <span>Scan inbox</span>
              </>
            )}
          </button>

          {/* MANUAL DRAFT SOURCE */}
          <ManualDraftSource
            isDeletingMode={isDeletingMode}
            manualDrafts={manualDrafts}
            setManualDrafts={setManualDrafts}
            onDraftCreated={handleManualDraftCreated}
            isPulsing={isManualDraftSourcePulsing}
            isDragging={isDraggingManualDraft}
          />

          {/* DATA MENU */}
          <div className="relative" ref={dataMenuRef}>
            <button
              onClick={() => {
                if (isDeletingMode) return
                setShowDataMenu(v => !v)
                setShowAddMenu(false)
                setShowUserMenu(false)
              }}
              className={`w-10 h-10 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors ${
                isDeletingMode ? "opacity-40 cursor-not-allowed" : ""
              }`}
              title="Data"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5 5 5M12 5v11"
                />
              </svg>
            </button>

            {showDataMenu && (
              <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg py-2 text-sm z-30">
                <button
                  onClick={() => {
                    handleCsvExport()
                    setShowDataMenu(false)
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 4h16v4H4zM4 10h16v10H4zM9 14h6"
                    />
                  </svg>
                  <span>Export as CSV</span>
                </button>

                <button
                  onClick={() => {
                    handleCsvImport()
                    setShowDataMenu(false)
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16M6 10l6-6 6 6"
                    />
                  </svg>
                  <span>Import CSV</span>
                </button>

                <div className="border-t border-zinc-200 dark:border-zinc-800 my-1" />

                <button
                  onClick={() => {
                    handleExportGmail()
                    setShowDataMenu(false)
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 4h16v16H4zM4 8l8 5 8-5"
                    />
                  </svg>
                  <span>Sync from Gmail</span>
                </button>
              </div>
            )}
          </div>

          {/* ADD MENU */}
          <div className="relative" ref={addMenuRef}>
            <button
              onClick={() => {
                if (isDeletingMode) return
                setShowAddMenu(v => !v)
                setShowUserMenu(false)
                setShowDataMenu(false)
              }}
              className={`w-10 h-10 rounded-md flex items-center justify-center bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition-all ${
                isDeletingMode ? "opacity-40 cursor-not-allowed" : ""
              }`}
              title="Add"
            >
              <PlusIcon className="w-4 h-4" />
            </button>

            {showAddMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg py-2 text-sm z-30">
                <button
                  onClick={() => {
                    setShowAddContact(true)
                    setShowAddCategory(false)
                    setShowAddMenu(false)
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16M4 12h16M9 8a3 3 0 116 0 3 3 0 01-6 0z"
                    />
                  </svg>
                  <div>
                    <div className="font-medium">New Contact</div>
                    <div className="text-xs text-zinc-500">Add a single contact</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowAddCategory(true)
                    setShowAddContact(false)
                    setShowAddMenu(false)
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 6h16M4 12h8M4 18h12"
                    />
                  </svg>
                  <div>
                    <div className="font-medium">New Category</div>
                    <div className="text-xs text-zinc-500">Group contacts by lane</div>
                  </div>
                </button>

                <div className="border-t border-zinc-200 dark:border-zinc-800 my-1" />

                <button
                  onClick={() => {
                    handleImportCsv()
                    setShowAddMenu(false)
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5 5 5M12 5v11"
                    />
                  </svg>
                  <div>
                    <div className="font-medium">File Upload</div>
                    <div className="text-xs text-zinc-500">Upload a CSV / sheet export</div>
                  </div>
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,text/csv,text/tab-separated-values"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                void handleFileSelected(file)
                e.currentTarget.value = ""
              }}
            />
          </div>

          {/* TRASH BUTTON */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (isDeletingMode && selectedItems.length > 0) {
                  handleDeleteSelected()
                } else {
                  setIsDeletingMode(!isDeletingMode)
                  if (!isDeletingMode) setSelectedItems([])
                }
                closeAllMenus()
              }}
              className={`w-10 h-10 rounded-md flex items-center justify-center transition-all duration-200 ${
                isDeletingMode
                  ? "bg-red-500 text-white shadow-sm"
                  : "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
              }`}
              title={
                isDeletingMode
                  ? selectedItems.length > 0
                    ? `Delete ${selectedItems.length} selected items`
                    : "Exit delete mode"
                  : "Enter delete mode"
              }
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>

          {/* USER MENU */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => {
                if (isDeletingMode) return
                setShowUserMenu(v => !v)
                setShowAddMenu(false)
                setShowDataMenu(false)
              }}
              className={`w-10 h-10 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors ${
                isDeletingMode ? "opacity-40 cursor-not-allowed" : ""
              }`}
              title="User"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.572c-1.756-.426-1.756-2.924 0-3.35A1.724 1.724 0 004.45 7.753c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.066z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg py-2 text-sm z-30">
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-400 flex items-center justify-center text-xs font-semibold text-white dark:text-zinc-900">
                    CF
                  </div>
                  <div>
                    <div className="font-medium text-sm">Demo User</div>
                    <div className="text-xs text-zinc-500">demo@contactflow.app</div>
                  </div>
                </div>

                <button
                  onClick={handleOpenSettings}
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543.826 3.31 2.37 2.37a1.724 1.724 0 002.572 1.066c.426 1.756 2.924 1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543.826 3.31 2.37 2.37a1.724 1.724 0 002.572 1.066c.426 1.756 2.924 1.756 3.35 0a1.724 1.724 0 002.573-1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.572"
                    />
                  </svg>
                  <div>
                    <div className="font-medium">Settings</div>
                    <div className="text-xs text-zinc-500">Theme & preferences</div>
                  </div>
                </button>

                <button
                  onClick={handleChangeAccount}
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 border-t border-zinc-200 dark:border-zinc-800"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 3h4a2 2 0 012 2v4M10 21H6a2 2 0 01-2-2v-4M16 7l-4-4m0 0L8 7m4-4v12"
                    />
                  </svg>
                  <div>
                    <div className="font-medium">Change Account</div>
                    <div className="text-xs text-zinc-500">Switch to different account</div>
                  </div>
                </button>

                <button
                  onClick={() => alert("Sign out (demo only)")}
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 border-t border-zinc-200 dark:border-zinc-800 text-red-500"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H9m4 5v1a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h6a2 2 0 012 2v1"
                    />
                  </svg>
                  <div>
                    <div className="font-medium">Sign out</div>
                    <div className="text-xs text-zinc-500">End demo session</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-auto">
        <div className="min-w-[900px] px-4 py-4">
          {/* Toolbar above table */}
          <div className="flex items-center justify-between mb-4">
            {isDeletingMode ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-red-600">
                  Delete mode
                </span>
                <button
                  onClick={handleSelectAll}
                  className="px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                >
                  Select all
                </button>
                <button
                  onClick={handleClearSelection}
                  className="px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                >
                  Clear
                </button>
                <button
                  onClick={handleDeleteAll}
                  className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                >
                  Delete all
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase text-zinc-500 tracking-wide">
                  Sort
                </span>
                <select
                  value={sortMode}
                  onChange={e => setSortMode(e.target.value as SortMode)}
                  className="text-sm px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                >
                  <option value="custom">Custom</option>
                  <option value="az">A–Z</option>
                  <option value="priority">Priority</option>
                </select>
              </div>
            )}
          </div>

          <div className="space-y-8">
            {categories.map(category => (
              <CategorySectionNew
                key={category.id}
                category={category}
                isDeletingMode={isDeletingMode}
                selectedItems={selectedItems}
                onToggleSelection={toggleItemSelection}
                onUpdateCategoryName={updateCategoryName}
                contacts={contacts}
                search={search}
                sortMode={sortMode}
                priorityAfterDays={priorityAfterDays}
                manualDrafts={manualDrafts}
                setManualDrafts={setManualDrafts}
                onUpdateMailNote={updateMailNote}
                onUpdateContactName={updateContactName}
                onUpdateContactEmail={updateContactEmail}
                onDeleteContact={handleDeleteContact}
                onDeleteMail={deleteMail}
                onDragContactToCategory={handleDragContactToCategory}
                onManualDraftPlaced={handleManualDraftPlaced}
                justPlacedDraftId={justPlacedDraftId}
                onReorderMail={handleReorderMail}
                onReorderContact={handleReorderContact}
              />
            ))}

            {hasUncategorizedContacts && (
              <UncategorizedSection
                isDeletingMode={isDeletingMode}
                selectedItems={selectedItems}
                toggleItemSelection={toggleItemSelection}
                contacts={contacts}
                search={search}
                sortMode={sortMode}
                priorityAfterDays={priorityAfterDays}
                manualDrafts={manualDrafts}
                setManualDrafts={setManualDrafts}
                onUpdateMailNote={updateMailNote}
                onUpdateContactName={updateContactName}
                onUpdateContactEmail={updateContactEmail}
                onDeleteContact={handleDeleteContact}
                onDeleteMail={deleteMail}
                onManualDraftPlaced={handleManualDraftPlaced}
                justPlacedDraftId={justPlacedDraftId}
                onReorderMail={handleReorderMail}
                onReorderContact={handleReorderContact}
              />
            )}
          </div>
        </div>
      </main>

      {/* ADD CONTACT MODAL */}
      {showAddContact && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onMouseDown={() => closeAllMenus()}
        >
          <div
            className="bg-white dark:bg-zinc-950 rounded-lg p-6 w-96 border border-zinc-200 dark:border-zinc-800"
            onMouseDown={e => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-4">Add New Contact</h3>
            <input
              type="text"
              placeholder="Name"
              value={newContactName}
              onChange={e => setNewContactName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleAddContact()
                if (e.key === "Escape") setShowAddContact(false)
              }}
              className="w-full border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 mb-3 bg-transparent"
              onFocus={closeAllMenus}
              autoFocus
            />
            <input
              type="email"
              placeholder="Email"
              value={newContactEmail}
              onChange={e => setNewContactEmail(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleAddContact()
                if (e.key === "Escape") setShowAddContact(false)
              }}
              className="w-full border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 mb-4 bg-transparent"
              onFocus={closeAllMenus}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddContact(false)}
                className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
              >
                Cancel
              </button>
              <button
                onClick={handleAddContact}
                className="px-4 py-2 bg-black text-white rounded dark:bg-white dark:text-black"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CATEGORY MODAL */}
      {showAddCategory && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onMouseDown={() => closeAllMenus()}
        >
          <div
            className="bg-white dark:bg-zinc-950 rounded-lg p-6 w-96 border border-zinc-200 dark:border-zinc-800"
            onMouseDown={e => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-4">Add New Category</h3>
            <input
              type="text"
              placeholder="Category name"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleAddCategory()
                if (e.key === "Escape") setShowAddCategory(false)
              }}
              className="w-full border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 mb-4 bg-transparent"
              onFocus={closeAllMenus}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddCategory(false)}
                className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                className="px-4 py-2 bg-black text-white rounded dark:bg-white dark:text-black"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onMouseDown={() => {
            setShowSettings(false)
          }}
        >
          <div
            ref={settingsRef}
            className="bg-white dark:bg-zinc-950 rounded-lg p-6 w-96 border border-zinc-200 dark:border-zinc-800"
            onMouseDown={e => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-4">Settings</h3>

            <div className="space-y-4 text-sm">
              <div>
                <div className="font-medium mb-1">Theme</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTheme("light")}
                    className={`px-3 py-1 rounded border text-xs ${
                      theme === "light"
                        ? "border-zinc-900 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    Light
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`px-3 py-1 rounded border text-xs ${
                      theme === "dark"
                        ? "border-zinc-900 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    Dark
                  </button>
                </div>
              </div>

              <div>
                <div className="font-medium mb-1">Priority threshold</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={priorityAfterDays}
                    onChange={e => setPriorityAfterDays(Number(e.target.value) || 30)}
                    className="w-20 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 bg-transparent text-sm"
                  />
                  <span className="text-xs text-zinc-500">days after last send</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded hover:bg-zinc-50 dark:hover:bg-zinc-900/40 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
