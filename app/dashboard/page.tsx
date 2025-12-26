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
  sentAt?: string
  subject: string
  attachments: Attachment[]
  status: SentMailStatus
  note?: string
}

type Contact = {
  id: string
  name: string
  email: string
  categoryId: string | null
  sentMails: SentMail[]
}

type Category = {
  id: string
  name: string
}

type ManualDraft = {
  id: string
  subject: string
  status: "idle" | "dragging"
}

type ThemeMode = "light" | "dark"

type SortMode = "custom" | "alpha" | "priority"

type ImportedRow = {
  name: string
  email: string
}

/* ================= MOCK FALLBACK ================= */

const MOCK_CONTACTS: Contact[] = [
  {
    id: "c1",
    name: "Max Mustermann",
    email: "max@example.com",
    categoryId: "cat-1",
    sentMails: [
      {
        id: "m1",
        sentAt: "2024-01-10T10:00:00.000Z",
        subject: "Beat Pack 001",
        attachments: [{ id: "a1", filename: "beatpack_001.zip" }],
        status: "doubleCheck",
        note: "Hat gut reagiert, meinte wir sollen in Kontakt bleiben."
      },
      {
        id: "m2",
        sentAt: "2024-02-15T18:30:00.000Z",
        subject: "Neue Ideen",
        attachments: [{ id: "a2", filename: "demo_ideas.wav" }],
        status: "singleCheck"
      }
    ]
  },
  {
    id: "c2",
    name: "Sarah Song",
    email: "sarah@example.com",
    categoryId: "cat-2",
    sentMails: [
      {
        id: "m3",
        sentAt: "2023-11-05T14:20:00.000Z",
        subject: "Topline Collab",
        attachments: [{ id: "a3", filename: "topline_idea.mp3" }],
        status: "read",
        note: "Hat sehr schnell geantwortet."
      }
    ]
  },
  {
    id: "c3",
    name: "Unsortierter Kontakt",
    email: "unsorted@example.com",
    categoryId: null,
    sentMails: []
  }
]

/* ================= HELPERS ================= */

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

function getLastSentIso(contact: Contact): string | undefined {
  let maxMs: number | undefined
  let bestIso: string | undefined

  for (const m of contact.sentMails ?? []) {
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

function getStatusColor(lastSentAt?: string, priorityAfterDays?: number) {
  const d = daysSince(lastSentAt)
  if (d === undefined) return "bg-zinc-50 dark:bg-zinc-900/40"

  if (priorityAfterDays && d > priorityAfterDays) {
    return "bg-red-50/80 dark:bg-red-900/30"
  }
  if (d > 60) return "bg-amber-50/80 dark:bg-amber-900/30"
  if (d > 30) return "bg-yellow-50/80 dark:bg-yellow-900/20"
  return "bg-emerald-50/60 dark:bg-emerald-900/20"
}

function getStatusTint(lastSentAt?: string, priorityAfterDays?: number) {
  const d = daysSince(lastSentAt)
  if (d === undefined) return ""

  if (priorityAfterDays && d > priorityAfterDays) {
    return "border-l-4 border-l-red-500/70"
  }
  if (d > 60) return "border-l-4 border-l-amber-500/70"
  if (d > 30) return "border-l-4 border-l-yellow-500/70"
  return "border-l-4 border-l-emerald-500/70"
}

function formatShortDate(dateIso?: string) {
  if (!dateIso) return "—"
  const d = new Date(dateIso)
  if (!Number.isFinite(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { year: "2-digit", month: "short", day: "numeric" })
}

function formatRelative(dateIso?: string) {
  const d = daysSince(dateIso)
  if (d === undefined) return "—"

  if (d < 1) return "today"
  if (d < 2) return "yesterday"
  if (d < 7) return `${Math.floor(d)}d ago`
  if (d < 31) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

function filterContacts(contacts: Contact[], search: string) {
  const term = search.trim().toLowerCase()
  if (!term) return contacts
  return contacts.filter(c => {
    const haystack = `${c.name} ${c.email}`.toLowerCase()
    return haystack.includes(term)
  })
}

/* ================= CSV PARSING ================= */

function detectCsvDelimiter(text: string): string {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)

  if (lines.length === 0) return ","

  const sample = lines.slice(0, 5).join("\n")
  const candidates = [",", ";", "\t"]
  const delimiter =
    candidates
      .map(d => ({ d, count: (sample.match(new RegExp(`\\${d}`, "g")) ?? []).length }))
      .sort((a, b) => b.count - a.count)[0]?.d ?? ","

  return delimiter
}

function parseCsv(text: string): ImportedRow[] {
  const delimiter = detectCsvDelimiter(text)

  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter(Boolean)

  if (lines.length === 0) return []

  const [headerRaw, ...rows] = lines
  const header = headerRaw.split(delimiter).map(h => h.trim().replace(/^"|"$/g, "").toLowerCase())

  const nameIndex =
    header.findIndex(h => h === "name" || h === "full name" || h === "contact" || h === "kontakt") ?? 0
  const emailIndex = header.findIndex(h => h === "email" || h === "e-mail" || h === "mail")

  if (emailIndex === -1) {
    console.warn("No obvious email column found in CSV header:", header)
  }

  const result: ImportedRow[] = []

  for (const row of rows) {
    const cols = row.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ""))
    const name = cols[nameIndex] ?? ""
    const email = emailIndex >= 0 ? cols[emailIndex] ?? "" : ""

    if (!name && !email) continue

    result.push({ name, email })
  }

  return result
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/* ================= ICONS ================= */

function AddCategoryIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        d="M4 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 11v4m2-2H10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ================= CONTACT ROW ================= */

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
  onReorderMail,
  isJustReordered
}: {
  contact: Contact
  priorityAfterDays: number
  manualDrafts: ManualDraft[]
  setManualDrafts: React.Dispatch<React.SetStateAction<ManualDraft[]>>
  onUpdateMailNote: (contactId: string, mailId: string, note: string) => void
  onDeleteContact?: (contactId: string) => void
  onDeleteMail?: (contactId: string, mailId: string) => void
  onUpdateContactName?: (contactId: string, name: string) => void
  onUpdateContactEmail?: (contactId: string, email: string) => void
  isDeleting?: boolean
  onManualDraftPlaced?: (draftId: string) => void
  justPlacedDraftId?: string | null
  onReorderMail?: (contactId: string, mailId: string, newIndex: number) => void
  isJustReordered?: boolean
}) {
  const mails = contact.sentMails ?? []

  // robust: nimmt das neueste gültige Datum aller Mails, ignoriert fehlende/kaputte
  const lastSent = useMemo(() => {
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
  }, [mails])

  const tint = getStatusTint(lastSent, priorityAfterDays)
  const bg = getStatusColor(lastSent, priorityAfterDays)

  const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null)
  const [localJustPlacedDraftId, setLocalJustPlacedDraftId] = useState<string | null>(null)

  useEffect(() => {
    if (!justPlacedDraftId) return
    setLocalJustPlacedDraftId(justPlacedDraftId)
    const t = window.setTimeout(() => setLocalJustPlacedDraftId(null), 400)
    return () => window.clearTimeout(t)
  }, [justPlacedDraftId])

  useEffect(() => {
    const t = window.setTimeout(() => {
      setActiveInsertIndex(null)
    }, 300)
    return () => window.clearTimeout(t)
  }, [contact.id, mails.length, manualDrafts.length])

  const handleDropMailAt = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setActiveInsertIndex(null)

    const raw = e.dataTransfer.getData("sentMail")
    if (!raw) return

    try {
      const payload = JSON.parse(raw) as { contactId: string; mailId: string }
      if (payload.contactId !== contact.id) return
      if (!onReorderMail) return
      onReorderMail(contact.id, payload.mailId, index)
    } catch (err) {
      console.error("Invalid drag payload for sentMail:", err)
    }
  }

  const handleDragOverZone = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    const raw = e.dataTransfer.getData("sentMail")
    if (!raw) return
    try {
      const payload = JSON.parse(raw) as { contactId: string; mailId: string }
      if (payload.contactId !== contact.id) return
      e.preventDefault()
      if (activeInsertIndex !== index) setActiveInsertIndex(index)
    } catch {
      return
    }
  }

  const renderDropZone = (index: number) => (
    <div
      key={`dz-${contact.id}-${index}`}
      onDragOver={e => handleDragOverZone(index, e)}
      onDrop={e => handleDropMailAt(index, e)}
      onDragLeave={() => {
        setActiveInsertIndex(prev => (prev === index ? null : prev))
      }}
      className={`h-2 mx-4 rounded transition-colors ${
        activeInsertIndex === index ? "bg-blue-500/60" : "bg-transparent"
      }`}
    />
  )

  return (
    <div
      className={[
        "grid grid-cols-[260px_1fr] border-b border-zinc-200 dark:border-zinc-800",
        tint,
        "hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40",
        isJustReordered ? "animate-dropIn" : ""
      ].join(" ")}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        if (isDeleting) return
        const draftId = e.dataTransfer.getData("manualDraft")
        if (!draftId) return

        setManualDrafts(prev =>
          prev.map(d => (d.id === draftId ? { ...d, status: "idle" } : d))
        )

        if (!onManualDraftPlaced) return
        onManualDraftPlaced(draftId)
      }}
    >
      {/* LEFT COLUMN: CONTACT INFO */}
      <div className={`flex flex-col border-r border-zinc-200 dark:border-zinc-800 ${bg}`}>
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              defaultValue={contact.name}
              onBlur={e => onUpdateContactName?.(contact.id, e.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
              spellCheck={false}
            />
            <input
              type="email"
              defaultValue={contact.email}
              onBlur={e => onUpdateContactEmail?.(contact.id, e.target.value)}
              className="w-full bg-transparent text-xs text-zinc-500 dark:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 mt-0.5"
              spellCheck={false}
            />
          </div>

          {onDeleteContact && isDeleting && (
            <button
              className="ml-2 text-xs text-red-500 hover:text-red-700"
              onClick={() => onDeleteContact(contact.id)}
              title="Delete contact"
            >
              Delete
            </button>
          )}
        </div>

        <div className="flex items-center justify-between px-4 pb-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <div>
            Last sent: <span className="font-medium">{formatShortDate(lastSent)}</span>
          </div>
          <div className="text-[10px] uppercase tracking-wide">
            {lastSent ? formatRelative(lastSent) : "No mails yet"}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: SENT MAILS */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
          <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            Sent Mails ({mails.length})
          </div>
          <div className="text-[11px] text-zinc-400">
            Drag & drop mails to reorder • drop manual card here to attach
          </div>
        </div>

        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {mails.map((mail, index) => (
            <React.Fragment key={mail.id}>
              {renderDropZone(index)}

              <div
                className={[
                  "flex items-center justify-between px-4 py-2 text-sm",
                  localJustPlacedDraftId === mail.id ? "animate-dropIn" : ""
                ].join(" ")}
                draggable={!isDeleting}
                onDragStart={e => {
                  if (isDeleting) return
                  e.dataTransfer.setData(
                    "sentMail",
                    JSON.stringify({ contactId: contact.id, mailId: mail.id })
                  )
                }}
                onDragEnd={e => {
                  e.preventDefault()
                  setActiveInsertIndex(null)
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      mail.status === "unread"
                        ? "bg-zinc-400"
                        : mail.status === "singleCheck"
                        ? "bg-blue-500"
                        : mail.status === "doubleCheck"
                        ? "bg-emerald-500"
                        : "bg-purple-500"
                    }`}
                    title={mail.status}
                  />
                  <div className="flex flex-col min-w-0">
                    <div className="font-medium truncate">{mail.subject || "No subject"}</div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{formatShortDate(mail.sentAt)}</span>
                      {mail.attachments.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828a4
2 0 00-6-6L6.343 9.172"
                            />
                          </svg>
                          {mail.attachments.length} file(s)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <textarea
                    defaultValue={mail.note ?? ""}
                    onBlur={e => onUpdateMailNote(contact.id, mail.id, e.target.value)}
                    className="text-xs bg-transparent border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 min-w-[160px] max-w-[220px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows={2}
                    placeholder="Add note…"
                  />

                  {onDeleteMail && isDeleting && (
                    <button
                      className="text-[11px] text-red-500 hover:text-red-700"
                      onClick={() => onDeleteMail(contact.id, mail.id)}
                      title="Delete this mail"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </React.Fragment>
          ))}

          {renderDropZone(mails.length)}
        </div>
      </div>
    </div>
  )
}

/* ================= CATEGORY SECTION ================= */

function CategorySection({
  category,
  isDeletingMode,
  selectedItems,
  onToggleSelection,
  onUpdateCategoryName,
  contacts,
  search,
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
  sortMode,
  onReorderContact
}: {
  category: Category
  isDeletingMode: boolean
  selectedItems: string[]
  onToggleSelection: (itemId: string) => void
  onUpdateCategoryName: (categoryId: string, name: string) => void
  contacts: Contact[]
  search: string
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
  sortMode: SortMode
  onReorderContact: (categoryId: string | null, contactId: string, newIndex: number) => void
}) {
  const [isEditingCategory, setIsEditingCategory] = useState(false)
  const [tempCategoryName, setTempCategoryName] = useState(category.name)

  const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null)
  const [justDroppedContactId, setJustDroppedContactId] = useState<string | null>(null)

  const handleCategorySave = () => {
    if (tempCategoryName.trim() && tempCategoryName !== category.name) {
      onUpdateCategoryName(category.id, tempCategoryName.trim())
    }
    setIsEditingCategory(false)
  }

  useEffect(() => {
    setTempCategoryName(category.name)
  }, [category.name])

  const allCategoryContacts = contacts.filter(c => c.categoryId === category.id)
  const visibleContacts = filterContacts(allCategoryContacts, search)
  const sortedContacts = [...visibleContacts]

  if (sortMode === "alpha") {
    sortedContacts.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sortMode === "priority") {
    sortedContacts.sort((a, b) => {
      const aIso = getLastSentIso(a)
      const bIso = getLastSentIso(b)

      const aDays = aIso ? daysSince(aIso) ?? 0 : Infinity
      const bDays = bIso ? daysSince(bIso) ?? 0 : Infinity

      if (aDays === bDays) return a.name.localeCompare(b.name)
      return bDays - aDays
    })
  }

  const handleDropContactAt = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setActiveInsertIndex(null)

    if (sortMode !== "custom" || isDeletingMode) return

    const contactId = e.dataTransfer.getData("contact")
    if (!contactId) return

    const dragged = allCategoryContacts.find(c => c.id === contactId)
    if (!dragged) return

    onReorderContact(category.id, contactId, index)
    setJustDroppedContactId(contactId)
    window.setTimeout(() => setJustDroppedContactId(null), 450)
  }

  const handleDragOverZone = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    if (sortMode !== "custom" || isDeletingMode) return

    const contactId = e.dataTransfer.getData("contact")
    if (!contactId) return
    const dragged = allCategoryContacts.find(c => c.id === contactId)
    if (!dragged) return

    e.preventDefault()
    if (activeInsertIndex !== index) setActiveInsertIndex(index)
  }

  const renderDropZone = (index: number) => (
    <div
      key={`dz-contact-${category.id}-${index}`}
      onDragOver={e => handleDragOverZone(index, e)}
      onDrop={e => handleDropContactAt(index, e)}
      onDragLeave={() => {
        setActiveInsertIndex(prev => (prev === index ? null : prev))
      }}
      className={`h-2 mx-4 rounded transition-colors ${
        activeInsertIndex === index ? "bg-blue-500/60" : "bg-transparent"
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
        onDragContactToCategory(contactId, category.id)
      }}
    >
      <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
        <div className="flex items-center gap-2 flex-1">
          {isDeletingMode && (
            <input
              type="checkbox"
              checked={selectedItems.includes(`category_${category.id}`)}
              onChange={() => onToggleSelection(`category_${category.id}`)}
              className="h-4 w-4 rounded text-red-500 focus:ring-red-500"
            />
          )}

          {isEditingCategory ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tempCategoryName}
                onChange={e => setTempCategoryName(e.target.value)}
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
              className="text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-300 tracking-wide hover:bg-zinc-100 dark:hover:bg-zinc-900 px-2 py-1 rounded cursor-text"
              onClick={() => setIsEditingCategory(true)}
              title="Click to edit category name"
            >
              {category.name}
            </div>
          )}
        </div>
      </div>

      {sortedContacts.map((contact, index) => (
        <React.Fragment key={contact.id}>
          {sortMode === "custom" && !isDeletingMode && renderDropZone(index)}

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
              isJustReordered={justDroppedContactId === contact.id}
            />
          </div>
        </React.Fragment>
      ))}

      {sortMode === "custom" && !isDeletingMode && sortedContacts.length > 0 && renderDropZone(sortedContacts.length)}
    </div>
  )
}

/* ================= UNCATEGORIZED SECTION ================= */

function UncategorizedSection({
  contacts,
  search,
  priorityAfterDays,
  manualDrafts,
  setManualDrafts,
  isDeletingMode,
  selectedItems,
  onToggleSelection,
  onUpdateMailNote,
  onUpdateContactName,
  onUpdateContactEmail,
  onDeleteContact,
  onDeleteMail,
  onManualDraftPlaced,
  justPlacedDraftId,
  onReorderMail,
  sortMode,
  onReorderContact
}: {
  contacts: Contact[]
  search: string
  priorityAfterDays: number
  manualDrafts: ManualDraft[]
  setManualDrafts: React.Dispatch<React.SetStateAction<ManualDraft[]>>
  isDeletingMode: boolean
  selectedItems: string[]
  onToggleSelection: (itemId: string) => void
  onUpdateMailNote: (contactId: string, mailId: string, note: string) => void
  onUpdateContactName: (contactId: string, name: string) => void
  onUpdateContactEmail: (contactId: string, email: string) => void
  onDeleteContact: (contactId: string) => void
  onDeleteMail: (contactId: string, mailId: string) => void
  onManualDraftPlaced: (draftId: string) => void
  justPlacedDraftId?: string | null
  onReorderMail: (contactId: string, mailId: string, newIndex: number) => void
  sortMode: SortMode
  onReorderContact: (categoryId: string | null, contactId: string, newIndex: number) => void
}) {
  const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null)
  const [justDroppedContactId, setJustDroppedContactId] = useState<string | null>(null)

  const allUncategorized = contacts.filter(c => !c.categoryId)
  const visibleContacts = filterContacts(allUncategorized, search)
  const sortedContacts = [...visibleContacts]

  if (sortMode === "alpha") {
    sortedContacts.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sortMode === "priority") {
    sortedContacts.sort((a, b) => {
      const aIso = getLastSentIso(a)
      const bIso = getLastSentIso(b)

      const aDays = aIso ? daysSince(aIso) ?? 0 : Infinity
      const bDays = bIso ? daysSince(bIso) ?? 0 : Infinity

      if (aDays === bDays) return a.name.localeCompare(b.name)
      return bDays - aDays
    })
  }

  const handleDropContactAt = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setActiveInsertIndex(null)

    if (sortMode !== "custom" || isDeletingMode) return

    const contactId = e.dataTransfer.getData("contact")
    if (!contactId) return

    const dragged = allUncategorized.find(c => c.id === contactId)
    if (!dragged) return

    onReorderContact(null, contactId, index)
    setJustDroppedContactId(contactId)
    window.setTimeout(() => setJustDroppedContactId(null), 450)
  }

  const handleDragOverZone = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    if (sortMode !== "custom" || isDeletingMode) return

    const contactId = e.dataTransfer.getData("contact")
    if (!contactId) return
    const dragged = allUncategorized.find(c => c.id === contactId)
    if (!dragged) return

    e.preventDefault()
    if (activeInsertIndex !== index) setActiveInsertIndex(index)
  }

  const renderDropZone = (index: number) => (
    <div
      key={`dz-uncategorized-${index}`}
      onDragOver={e => handleDragOverZone(index, e)}
      onDrop={e => handleDropContactAt(index, e)}
      onDragLeave={() => {
        setActiveInsertIndex(prev => (prev === index ? null : prev))
      }}
      className={`h-2 mx-4 rounded transition-colors ${
        activeInsertIndex === index ? "bg-blue-500/60" : "bg-transparent"
      }`}
    />
  )

  if (sortedContacts.length === 0) return null

  return (
    <div
      className="border border-zinc-200 dark:border-zinc-800 rounded overflow-hidden"
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        if (isDeletingMode) return
        const contactId = e.dataTransfer.getData("contact")
        if (!contactId) return
        onReorderContact(null, contactId, sortedContacts.length)
      }}
    >
      <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
        Uncategorized
      </div>

      {sortedContacts.map((contact, index) => (
        <React.Fragment key={contact.id}>
          {sortMode === "custom" && !isDeletingMode && renderDropZone(index)}

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
              isJustReordered={justDroppedContactId === contact.id}
            />
          </div>
        </React.Fragment>
      ))}

      {sortMode === "custom" && !isDeletingMode && sortedContacts.length > 0 && renderDropZone(sortedContacts.length)}
    </div>
  )
}

/* ================= EXPANDING SEARCH BAR ================= */

function ExpandingSearchBar({
  search,
  setSearch,
  onFocus
}: {
  search: string
  setSearch: (value: string) => void
  onFocus?: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus()
      onFocus?.()
    }
  }, [isExpanded, onFocus])

  return (
    <div className="relative w-full max-w-xs">
      <div
        className={[
          "flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-1.5 text-xs transition-all",
          isExpanded ? "shadow-sm w-64" : "w-32"
        ].join(" ")}
      >
        <svg
          className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setIsExpanded(true)}
          onBlur={() => {
            if (!search) setIsExpanded(false)
          }}
          placeholder="Search contacts…"
          className="bg-transparent flex-1 outline-none text-xs text-zinc-700 dark:text-zinc-100 placeholder:text-zinc-400"
        />
      </div>
    </div>
  )
}

/* ================= MANUAL DRAFT SOURCE ================= */

function ManualDraftSource({
  manualDrafts,
  setManualDrafts
}: {
  manualDrafts: ManualDraft[]
  setManualDrafts: React.Dispatch<React.SetStateAction<ManualDraft[]>>
}) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragStart = (draft: ManualDraft, e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("manualDraft", draft.id)
    setManualDrafts(prev => prev.map(d => (d.id === draft.id ? { ...d, status: "dragging" } : d)))
    setIsDragging(true)
  }

  const handleDragEnd = (draft: ManualDraft, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setManualDrafts(prev => prev.map(d => (d.id === draft.id ? { ...d, status: "idle" } : d)))
    setIsDragging(false)
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 pointer-events-none">
      <div className="relative">
        <div className="w-40 h-20 rounded-xl bg-zinc-900 text-zinc-50 shadow-lg border border-zinc-700 flex items-center justify-center text-xs font-medium pointer-events-auto">
          <div
            draggable
            onDragStart={e =>
              handleDragStart(
                { id: "manual-draft-1", subject: "New idea", status: "dragging" },
                e
              )
            }
            onDragEnd={e =>
              handleDragEnd(
                { id: "manual-draft-1", subject: "New idea", status: "idle" },
                e
              )
            }
            className={`absolute inset-0 rounded border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 ${
              isDragging ? "animate-wobble" : ""
            }`}
          >
            DRAG ME
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================= MAIN ================= */

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

  const [showAddContact, setShowAddContact] = useState(false)
  const [newContactName, setNewContactName] = useState("")
  const [newContactEmail, setNewContactEmail] = useState("")

  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")

  const [theme, setTheme] = useState<ThemeMode>("light")

  const [isDeletingMode, setIsDeletingMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  const [showCsvPreview, setShowCsvPreview] = useState(false)
  const [csvPreviewRows, setCsvPreviewRows] = useState<ImportedRow[]>([])
  const [csvImportCategoryId, setCsvImportCategoryId] = useState<string | null>(null)

  const [justPlacedDraftId, setJustPlacedDraftId] = useState<string | null>(null)

  const addMenuRef = useRef<HTMLDivElement | null>(null)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const dataMenuRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const closeAllMenus = () => {
    setShowAddMenu(false)
    setShowUserMenu(false)
    setShowDataMenu(false)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        addMenuRef.current &&
        !addMenuRef.current.contains(e.target as Node) &&
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node) &&
        dataMenuRef.current &&
        !dataMenuRef.current.contains(e.target as Node)
      ) {
        closeAllMenus()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    const stored = window.localStorage.getItem("contact-dashboard-theme")
    if (stored === "dark" || stored === "light") {
      setTheme(stored)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem("contact-dashboard-theme", theme)
    if (theme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [theme])

  useEffect(() => {
    try {
      const storedContacts = window.localStorage.getItem("contact-dashboard-contacts")
      const storedCategories = window.localStorage.getItem("contact-dashboard-categories")

      if (storedContacts && storedCategories) {
        const parsedContacts: Contact[] = JSON.parse(storedContacts)
        const parsedCategories: Category[] = JSON.parse(storedCategories)

        const fixedContacts = parsedContacts.map(c => ({
          ...c,
          categoryId: c.categoryId === null || typeof c.categoryId === "string" ? c.categoryId : null,
          sentMails: (c.sentMails ?? []).map(m => ({
            ...m,
            sentAt: m.sentAt ?? undefined,
            attachments: m.attachments ?? []
          }))
        }))

        setContacts(fixedContacts)
        setCategories(parsedCategories)
        setLoading(false)
      } else {
        setTimeout(() => {
          setContacts(MOCK_CONTACTS)
          setLoading(false)
        }, 500)
      }
    } catch (error) {
      console.error("Error loading data:", error)
      setContacts(MOCK_CONTACTS)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (loading) return
    try {
      window.localStorage.setItem("contact-dashboard-contacts", JSON.stringify(contacts))
      window.localStorage.setItem("contact-dashboard-categories", JSON.stringify(categories))
    } catch (error) {
      console.error("Error saving data:", error)
    }
  }, [contacts, categories, loading])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-zinc-400 bg-white dark:bg-zinc-950">
        Loading dashboard…
      </div>
    )
  }

  const hasUncategorizedContacts = contacts.some(c => !c.categoryId)

  const handleUpdateMailNote = (contactId: string, mailId: string, note: string) => {
    setContacts(prev =>
      prev.map(c =>
        c.id === contactId
          ? {
              ...c,
              sentMails: c.sentMails.map(m => (m.id === mailId ? { ...m, note } : m))
            }
          : c
      )
    )
  }

  const handleUpdateContactName = (contactId: string, name: string) => {
    setContacts(prev => prev.map(c => (c.id === contactId ? { ...c, name } : c)))
  }

  const handleUpdateContactEmail = (contactId: string, email: string) => {
    setContacts(prev => prev.map(c => (c.id === contactId ? { ...c, email } : c)))
  }

  const handleDeleteMail = (contactId: string, mailId: string) => {
    if (!confirm("Are you sure you want to delete this mail entry?")) return
    setContacts(prev =>
      prev.map(c =>
        c.id === contactId
          ? {
              ...c,
              sentMails: c.sentMails.filter(m => m.id !== mailId)
            }
          : c
      )
    )
  }

  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactEmail.trim()) return
    const newContact: Contact = {
      id: `contact-${Date.now()}`,
      name: newContactName.trim(),
      email: newContactEmail.trim(),
      categoryId: null,
      sentMails: []
    }
    setContacts(prev => [newContact, ...prev])
    setNewContactName("")
    setNewContactEmail("")
    setShowAddContact(false)
  }

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return
    const newCategory: Category = {
      id: `cat-${Date.now()}`,
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

  const handleReorderContact = (categoryId: string | null, contactId: string, newIndex: number) => {
    setContacts(prev => {
      const next = [...prev]

      // Alle Kontakte innerhalb der gewünschten Kategorie (oder Uncategorized)
      const groupIndexes: number[] = []
      for (let i = 0; i < next.length; i++) {
        const c = next[i]
        const inGroup = categoryId ? c.categoryId === categoryId : !c.categoryId
        if (inGroup) groupIndexes.push(i)
      }

      if (groupIndexes.length === 0) return prev

      const group = groupIndexes.map(i => next[i])
      const currentIndexInGroup = group.findIndex(c => c.id === contactId)
      if (currentIndexInGroup === -1) return prev

      const clampedNewIndex = Math.max(0, Math.min(newIndex, group.length))

      const reordered = [...group]
      const [moved] = reordered.splice(currentIndexInGroup, 1)
      reordered.splice(clampedNewIndex, 0, moved)

      groupIndexes.forEach((idx, i) => {
        next[idx] = reordered[i]
      })

      return next
    })
  }

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => (prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]))
  }

  const allSelectableIds = useMemo(() => {
    const ids: string[] = []
    categories.forEach(c => ids.push(`category_${c.id}`))
    contacts.forEach(c => ids.push(`contact_${c.id}`))
    return ids
  }, [categories, contacts])

  const deleteItems = (idsToDelete: string[]) => {
    const contactIds = idsToDelete.filter(id => id.startsWith("contact_"))
    const categoryIds = idsToDelete.filter(id => id.startsWith("category_"))

    let message = ""

    if (contactIds.length > 0) {
      message += `Delete ${contactIds.length} selected contact(s)? This cannot be undone.\n`
    }

    if (categoryIds.length > 0) {
      message += `Delete ${categoryIds.length} selected category(ies)? Contacts will be moved to Uncategorized.`
    }

    if (!message) return

    if (confirm(message)) {
      if (contactIds.length > 0) {
        const contactIdsOnly = contactIds.map(id => id.replace("contact_", ""))
        setContacts(prev => prev.filter(c => !contactIdsOnly.includes(c.id)))
      }

      if (categoryIds.length > 0) {
        const categoryIdsOnly = categoryIds.map(id => id.replace("category_", ""))
        setCategories(prev => prev.filter(c => !categoryIdsOnly.includes(c.id)))
        setContacts(prev =>
          prev.map(c => (c.categoryId && categoryIdsOnly.includes(c.categoryId) ? { ...c, categoryId: null } : c))
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

  const handleCsvTextImport = (text: string) => {
    const rows = parseCsv(text)
    setCsvPreviewRows(rows)
    setShowCsvPreview(true)
  }

  const handleFilePick = () => {
    if (!fileInputRef.current) return
    fileInputRef.current.value = ""
    fileInputRef.current.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      handleCsvTextImport(text)
    } catch (error) {
      console.error("Error reading file:", error)
      alert("Could not read the selected file.")
    }
  }

  const applyCsvImport = () => {
    if (!csvPreviewRows.length) return

    const mappedContacts: Contact[] = csvPreviewRows.map(row => ({
      id: `import-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: row.name || "(no name)",
      email: row.email || "",
      categoryId: csvImportCategoryId,
      sentMails: []
    }))

    setContacts(prev => [...mappedContacts, ...prev])
    setShowCsvPreview(false)
    setCsvPreviewRows([])
    setCsvImportCategoryId(null)
  }

  const handleManualDraftPlaced = (draftId: string) => {
    setJustPlacedDraftId(draftId)
    setTimeout(() => setJustPlacedDraftId(null), 400)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 mr-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              CRM
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Contact Flowboard</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Track who you&apos;ve sent music to – and who&apos;s overdue.
              </div>
            </div>
          </div>

          {/* LEFT SECTION: SEARCH + SCAN */}
          <div className="flex-1 flex items-center gap-3">
            <ExpandingSearchBar
              search={search}
              setSearch={setSearch}
              onFocus={() => {
                closeAllMenus()
              }}
            />

            <button
              onClick={() => {
                if (isDeletingMode) return
                setScanning(true)
                closeAllMenus()
                setTimeout(() => setScanning(false), 1500)
              }}
              className={`inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-[11px] font-medium transition-all ${
                scanning
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
              } ${isDeletingMode ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={isDeletingMode}
            >
              <svg
                className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582M20 4v5h-.581M4 20v-5h.582M20 20v-5h-.581M5 9h14M5 15h14"
                />
              </svg>
              {scanning ? "Scanning mailbox…" : "Scan mailbox"}
            </button>
          </div>

          {/* DATA MENU */}
          <div className="relative" ref={dataMenuRef}>
            <button
              onClick={() => {
                if (isDeletingMode) return
                setShowDataMenu(v => !v)
                setShowUserMenu(false)
                setShowAddMenu(false)
              }}
              className={`w-10 h-10 rounded-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors ${
                isDeletingMode ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title={isDeletingMode ? "Cannot open menu in delete mode" : "Data & import/export"}
              disabled={isDeletingMode}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4h16v4H4zM4 10h16v10H4zM8 14h4"
                />
              </svg>
            </button>

            {showDataMenu && !isDeletingMode && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg text-sm z-40">
                <button
                  onClick={() => {
                    handleCsvExport()
                    setShowDataMenu(false)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 transition-colors"
                >
                  <svg className="w-5 h-5 text-zinc-700 dark:text-zinc-200" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-3-3m3 3l3-3M5 21h14" />
                  </svg>
                  <div>
                    <div className="font-medium">CSV Export</div>
                    <div className="text-xs text-zinc-500">Download contacts as CSV</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowDataMenu(false)
                    handleFilePick()
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 border-t border-zinc-200 dark:border-zinc-800 transition-colors"
                >
                  <svg className="w-5 h-5 text-zinc-700 dark:text-zinc-200" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5 5 5M12 5v11" />
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
              onChange={handleFileSelected}
            />
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
              className={`w-10 h-10 rounded-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors ${
                isDeletingMode ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title={isDeletingMode ? "Cannot open menu in delete mode" : "Add contact or category"}
              disabled={isDeletingMode}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>

            {showAddMenu && !isDeletingMode && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg text-sm z-40">
                <button
                  onClick={() => {
                    setShowAddContact(true)
                    setShowAddMenu(false)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 transition-colors"
                >
                  <svg className="w-5 h-5 text-zinc-700 dark:text-zinc-200" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 4v8m4-4H8" />
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 21h14" />
                  </svg>
                  <div>
                    <div className="font-medium">Add Contact</div>
                    <div className="text-xs text-zinc-500">New person to track</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowAddCategory(true)
                    setShowAddMenu(false)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 border-t border-zinc-200 dark:border-zinc-800 transition-colors"
                >
                  <AddCategoryIcon className="w-5 h-5 text-zinc-700 dark:text-zinc-200" />
                  <div>
                    <div className="font-medium">Add Category</div>
                    <div className="text-xs text-zinc-500">Group contacts by role</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* TRASH BUTTON + SORT DROPDOWN */}
          <div className="flex items-center gap-3">
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4a1 1 0 011 1v3H9V4a1 1 0 011-1zM4 7h16"
                />
              </svg>
            </button>

            {!isDeletingMode && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Sort</span>
                <select
                  value={sortMode}
                  onChange={e => setSortMode(e.target.value as SortMode)}
                  className="text-xs border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 bg-transparent text-zinc-900 dark:text-zinc-100"
                >
                  <option value="custom">Custom</option>
                  <option value="alpha">A–Z</option>
                  <option value="priority">Priority</option>
                </select>
              </div>
            )}
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
              className={`w-10 h-10 rounded-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors ${
                isDeletingMode ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title={isDeletingMode ? "Cannot open menu in delete mode" : "User menu"}
              disabled={isDeletingMode}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A4 4 0 019 15h6a4 4 0 013.879 2.804M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {showUserMenu && !isDeletingMode && (
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg text-sm z-40">
                <button
                  onClick={() => {
                    setTheme(t => (t === "light" ? "dark" : "light"))
                    setShowUserMenu(false)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 transition-colors"
                >
                  <svg className="w-5 h-5 text-zinc-700 dark:text-zinc-200" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M8.05 8.05L6.636 6.636m10.728 0l-1.414 1.414M8.05 15.95l-1.414 1.414"
                    />
                  </svg>
                  <div>
                    <div className="font-medium">Toggle Theme</div>
                    <div className="text-xs text-zinc-500">
                      Currently <span className="font-semibold">{theme === "light" ? "Light" : "Dark"}</span>
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-auto">
        <div className="min-w-[900px] px-4 py-4 space-y-8">
          {isDeletingMode && (
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-zinc-500">
                {selectedItems.length > 0 ? `${selectedItems.length} item(s) selected` : "Select items to delete"}
              </div>
              <div className="flex items-center gap-2">
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
            </div>
          )}

          {categories.map(category => (
            <CategorySection
              key={category.id}
              category={category}
              isDeletingMode={isDeletingMode}
              selectedItems={selectedItems}
              onToggleSelection={toggleItemSelection}
              onUpdateCategoryName={newName => {
                setCategories(prev =>
                  prev.map(c => (c.id === category.id ? { ...c, name: newName } : c))
                )
              }}
              contacts={contacts}
              search={search}
              priorityAfterDays={priorityAfterDays}
              manualDrafts={manualDrafts}
              setManualDrafts={setManualDrafts}
              onUpdateMailNote={handleUpdateMailNote}
              onUpdateContactName={handleUpdateContactName}
              onUpdateContactEmail={handleUpdateContactEmail}
              onDeleteContact={handleDeleteContact}
              onDeleteMail={handleDeleteMail}
              onDragContactToCategory={handleDragContactToCategory}
              onManualDraftPlaced={handleManualDraftPlaced}
              justPlacedDraftId={justPlacedDraftId}
              onReorderMail={handleReorderMail}
              sortMode={sortMode}
              onReorderContact={handleReorderContact}
            />
          ))}

          {hasUncategorizedContacts && (
            <UncategorizedSection
              contacts={contacts}
              search={search}
              priorityAfterDays={priorityAfterDays}
              manualDrafts={manualDrafts}
              setManualDrafts={setManualDrafts}
              isDeletingMode={isDeletingMode}
              selectedItems={selectedItems}
              onToggleSelection={toggleItemSelection}
              onUpdateMailNote={handleUpdateMailNote}
              onUpdateContactName={handleUpdateContactName}
              onUpdateContactEmail={handleUpdateContactEmail}
              onDeleteContact={handleDeleteContact}
              onDeleteMail={handleDeleteMail}
              onManualDraftPlaced={handleManualDraftPlaced}
              justPlacedDraftId={justPlacedDraftId}
              onReorderMail={handleReorderMail}
              sortMode={sortMode}
              onReorderContact={handleReorderContact}
            />
          )}

          {/* ADD CONTACT MODAL – ENTER bestätigt, ESC schließt */}
          {showAddContact && (
            <div
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
              onMouseDown={() => setShowAddContact(false)}
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
                  className="w-full border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 mb-3 bg-transparent text-sm"
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
                  className="w-full border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 mb-4 bg-transparent text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddContact(false)}
                    className="px-3 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddContact}
                    className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
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
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
              onMouseDown={() => setShowAddCategory(false)}
            >
              <div
                className="bg-white dark:bg-zinc-950 rounded-lg p-6 w-80 border border-zinc-200 dark:border-zinc-800"
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
                  className="w-full border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 mb-4 bg-transparent text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddCategory(false)}
                    className="px-3 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCategory}
                    className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CSV PREVIEW MODAL */}
          {showCsvPreview && (
            <div
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
              onMouseDown={() => setShowCsvPreview(false)}
            >
              <div
                className="bg-white dark:bg-zinc-950 rounded-lg p-6 w-[600px] max-h-[80vh] border border-zinc-200 dark:border-zinc-800 flex flex-col"
                onMouseDown={e => e.stopPropagation()}
              >
                <h3 className="font-semibold mb-4">Import CSV Preview</h3>
                <div className="text-xs text-zinc-500 mb-3">
                  Detected <span className="font-semibold">{csvPreviewRows.length}</span> row(s). Choose a category and
                  confirm import.
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-zinc-500">Assign to category:</span>
                  <select
                    value={csvImportCategoryId ?? ""}
                    onChange={e => setCsvImportCategoryId(e.target.value || null)}
                    className="text-xs border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 bg-transparent text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 overflow-auto border border-zinc-200 dark:border-zinc-800 rounded mb-4">
                  <table className="min-w-full text-xs">
                    <thead className="bg-zinc-50 dark:bg-zinc-900/40 border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-zinc-600 dark:text-zinc-300">Name</th>
                        <th className="text-left px-3 py-2 font-semibold text-zinc-600 dark:text-zinc-300">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreviewRows.map((row, i) => (
                        <tr key={i} className="border-b border-zinc-200 dark:border-zinc-800">
                          <td className="px-3 py-1.5">{row.name}</td>
                          <td className="px-3 py-1.5 text-zinc-500 dark:text-zinc-400">{row.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowCsvPreview(false)}
                    className="px-3 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={applyCsvImport}
                    className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Import
                  </button>
                </div>
              </div>
            </div>
          )}

          <ManualDraftSource manualDrafts={manualDrafts} setManualDrafts={setManualDrafts} />
        </div>
      </main>

      <style jsx global>{`
        @keyframes wobble {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
          75% { transform: rotate(-1deg); }
          100% { transform: rotate(0deg); }
        }
        .animate-wobble { animation: wobble 0.55s ease-in-out infinite; }

        @keyframes dropIn {
          0% { transform: scale(1.06); }
          60% { transform: scale(0.98); }
          85% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        .animate-dropIn { animation: dropIn 0.35s ease-out; }

        @keyframes stackPush {
          0% { transform: translateY(0); }
          55% { transform: translateY(-4px); }
          100% { transform: translateY(0); }
        }
        .animate-stackPush { animation: stackPush 0.25s ease-out; }

        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-container { max-width: 100%; }
      `}</style>
    </div>
  )
}
