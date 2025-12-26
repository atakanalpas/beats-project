"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"

/* ================= TYPES ================= */
type SortMode = "custom" | "az" | "priority"

type Attachment = {
  id: string
  filename: string
}

type SentMailStatus = "unread" | "singleCheck" | "doubleCheck" | "read"

type SentMail = {
  id: string
  /** Kann bei Import fehlen → optional & robust gehandhabt */
  sentAt?: string
  attachments: Attachment[]
  note?: string
  source?: "gmail" | "manual"
  /** Status aus Gmail: ungelesen / ein Häkchen / zwei Häkchen / gelesen */
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
  note?: string
  contactId?: string
}

type Category = {
  id: string
  name: string
}

type ThemeMode = "light" | "dark"

type ImportedRow = {
  name: string
  email: string
}

/* ================= MOCK FALLBACK ================= */

const MOCK_CONTACTS: Contact[] = [
  {
    id: "c1",
    name: "Max Producer",
    email: "max@beats.com",
    categoryId: "cat-1",
    sentMails: [
      {
        id: "m1",
        sentAt: "2024-09-12",
        attachments: [
          { id: "a1", filename: "beat_140bpm.wav" },
          { id: "a2", filename: "beat_alt.wav" }
        ],
        source: "gmail",
        status: "unread",
        gmailLabels: ["UNREAD", "✓✓"]
      }
    ]
  },
  {
    id: "c2",
    name: "Lisa Songwriter",
    email: "lisa@studio.com",
    categoryId: "cat-2",
    sentMails: []
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

function getStatusColor(lastSentAt?: string, priorityAfterDays = 30) {
  const days = daysSince(lastSentAt)
  if (days === undefined) return "bg-gray-300 dark:bg-zinc-700"

  if (days >= priorityAfterDays) return "bg-red-400"
  if (days >= priorityAfterDays * 0.6) return "bg-orange-300"
  if (days >= priorityAfterDays * 0.3) return "bg-yellow-200"
  return "bg-green-300"
}

function getStatusTint(lastSentAt?: string, priorityAfterDays = 30) {
  const days = daysSince(lastSentAt)
  if (days === undefined) return "bg-zinc-50 dark:bg-zinc-900/40"

  if (days >= priorityAfterDays) return "bg-red-50 dark:bg-red-950/30"
  if (days >= priorityAfterDays * 0.6) return "bg-orange-50 dark:bg-orange-950/25"
  if (days >= priorityAfterDays * 0.3) return "bg-yellow-50 dark:bg-yellow-950/20"
  return "bg-green-50 dark:bg-green-950/20"
}

function formatDate(dateIso?: string) {
  if (!dateIso) return "—"
  const ms = safeDateMs(dateIso)
  if (ms === undefined) return "—"
  return new Date(ms).toLocaleDateString()
}

function sanitizeEmail(email: string) {
  return email.trim()
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function parseCsvSimple(text: string): ImportedRow[] {
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
    const h = (rows[0].name + "," + rows[0].email).toLowerCase()
    if (h.includes("name") && (h.includes("mail") || h.includes("email"))) {
      return rows.slice(1)
    }
  }

  return rows
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Farbschema einer Mail-Karte auf Basis von Gmail-Status / Labels */
function getMailStatusTheme(mail: SentMail) {
  let status: SentMailStatus | undefined = mail.status

  if (!status && mail.gmailLabels && mail.gmailLabels.length > 0) {
    const labels = mail.gmailLabels.map(l => l.toLowerCase())
    if (labels.some(l => l.includes("unread"))) status = "unread"
    else if (labels.some(l => l.includes("double") || l.includes("✓✓"))) status = "doubleCheck"
    else if (labels.some(l => l.includes("single") || l.includes("✓"))) status = "singleCheck"
  }

  switch (status) {
    case "unread":
      return {
        card: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-700",
        dot: "bg-blue-500"
      }
    case "singleCheck":
      return {
        card: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-700",
        dot: "bg-amber-500"
      }
    case "doubleCheck":
    case "read":
      return {
        card: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-700",
        dot: "bg-emerald-500"
      }
    default:
      return {
        card: "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800",
        dot: "bg-zinc-300 dark:bg-zinc-600"
      }
  }
}

/* ================= ICONS ================= */

function AddContactIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-1.6 -1.6 19.2 19.2"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="currentColor"
    >
      <path d="m 8 1 c -1.65625 0 -3 1.34375 -3 3 s 1.34375 3 3 3 s 3 -1.34375 3 -3 s -1.34375 -3 -3 -3 z m -1.5 7 c -2.492188 0 -4.5 2.007812 -4.5 4.5 v 0.5 c 0 1.109375 0.890625 2 2 2 h 6 v -1 h -3 v -4 h 3 v -1.972656 c -0.164062 -0.019532 -0.332031 -0.027344 -0.5 -0.027344 z m 4.5 0 v 3 h -3 v 2 h 3 v 3 h 2 v -3 h 3 v -2 h -3 v -3 z m 0 0" />
    </svg>
  )
}

function AddCategoryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11 11C11 10.4477 11.4477 10 12 10C12.5523 10 13 10.4477 13 11V13H15C15.5523 13 16 13.4477 16 14C16 14.5523 15.5523 15 15 15H13V17C13 17.5523 12.5523 18 12 18C11.4477 18 11 17.5523 11 17V15H9C8.44771 15 8 14.5523 8 14C8 13.4477 8.44771 13 9 13H11V11Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1 4C1 2.34315 2.34315 1 4 1H7.76393C8.90025 1 9.93904 1.64201 10.4472 2.65836L11.3416 4.44721C11.511 4.786 11.8573 5 12.2361 5H20C21.6569 5 23 6.34315 23 8V20C23 21.6569 21.6569 23 20 23H4C2.34315 23 1 21.6569 1 20V4ZM4 3C3.44772 3 3 3.44772 3 4V20C3 20.5523 3.44772 21 4 21H20C20.5523 21 21 20.5523 21 20V8C21 7.44772 20.5523 7 20 7H12.2361C11.0998 7 10.061 6.35799 9.55279 5.34164L8.65836 3.55279C8.48897 3.214 8.1427 3 7.76393 3H4Z"
        fill="currentColor"
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

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      const clickedInside = refs.some(r => r.current?.contains(target))
      if (!clickedInside) handler()
    }

    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [refs, handler, enabled])
}

/* ================= HOVER MARQUEE (SPOTIFY-STYLE) ================= */

function HoverMarquee({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [overflow, setOverflow] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    const span = textRef.current
    if (!container || !span) return

    const check = () => {
      const cWidth = container.clientWidth
      const tWidth = span.scrollWidth
      setOverflow(tWidth > cWidth + 4)
    }

    check()
    const ro = new ResizeObserver(check)
    ro.observe(container)
    ro.observe(span)

    return () => ro.disconnect()
  }, [text])

  return (
    <div
      ref={containerRef}
      className="marquee-container relative w-full overflow-hidden whitespace-nowrap"
      title={text}
    >
      <div
        className={
          "marquee-inner inline-flex items-center gap-8" +
          (overflow ? " marquee-active" : "")
        }
      >
        <span ref={textRef} className="block">
          {text}
        </span>
        {overflow && (
          <span className="block" aria-hidden="true">
            {text}
          </span>
        )}
      </div>
    </div>
  )
}

/* ================= COMPONENTS ================= */

function SentMailCard({
  mail,
  contactId,
  onChangeNote,
  isDeleting,
  onDeleteMail,
  isJustDropped
}: {
  mail: SentMail
  contactId: string
  onChangeNote: (note: string) => void
  isDeleting?: boolean
  onDeleteMail?: () => void
  isJustDropped?: boolean
}) {
  const [open, setOpen] = useState(false)
  const theme = getMailStatusTheme(mail)

  return (
    <div
      className={[
        "min-w-[160px] rounded px-2 py-2 text-[11px] relative group border transition-transform",
        theme.card,
        isJustDropped ? "animate-dropIn" : ""
      ].join(" ")}
      draggable={!isDeleting}
      onDragStart={e => {
        if (isDeleting) return
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData(
          "sentMail",
          JSON.stringify({ contactId, mailId: mail.id })
        )
      }}
    >
      {isDeleting && onDeleteMail && (
        <button
          onClick={onDeleteMail}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] z-10 hover:bg-red-600"
          title="Delete this mail"
        >
          ✕
        </button>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1">
          <span className={`inline-block w-2 h-2 rounded-full ${theme.dot}`} />
          <div className="text-[10px] text-zinc-500">{formatDate(mail.sentAt)}</div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          title="Add note"
        >
          <NoteIcon className="w-4 h-4" />
        </button>
      </div>

      <ul className="mt-1">
        {mail.attachments.map(att => (
          <li key={att.id} className="truncate text-zinc-800 dark:text-zinc-200">
            {att.filename}
          </li>
        ))}
      </ul>

      {open && (
        <div className="mt-2 border-t border-zinc-200 dark:border-zinc-800 pt-2">
          <textarea
            placeholder="Add note…"
            value={mail.note ?? ""}
            onChange={e => onChangeNote(e.target.value)}
            className="w-full resize-none border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-[11px] bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none"
            rows={3}
          />
        </div>
      )}

      {!open && mail.note && (
        <div className="mt-2 text-[10px] text-zinc-600 dark:text-zinc-400 italic truncate">{mail.note}</div>
      )}
    </div>
  )
}

function ManualDraftCard({
  draft,
  setManualDrafts,
  isDeleting,
  isJustPlaced
}: {
  draft: ManualDraft
  setManualDrafts: React.Dispatch<React.SetStateAction<ManualDraft[]>>
  isDeleting?: boolean
  isJustPlaced?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={[
        "min-w-[140px] rounded border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-2 text-[11px] relative group transition-transform",
        isJustPlaced ? "animate-dropIn" : ""
      ].join(" ")}
    >
      {isDeleting && (
        <button
          onClick={() => setManualDrafts(prev => prev.filter(d => d.id !== draft.id))}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] z-10 hover:bg-red-600"
          title="Delete manual card"
        >
          ✕
        </button>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] text-zinc-500 mb-1">{formatDate(draft.sentAt)}</div>

        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          title="Add note"
        >
          <NoteIcon className="w-4 h-4" />
        </button>
      </div>

      {open ? (
        <textarea
          placeholder="Add note…"
          value={draft.note ?? ""}
          onChange={e =>
            setManualDrafts(prev =>
              prev.map(d => (d.id === draft.id ? { ...d, note: e.target.value } : d))
            )
          }
          className="w-full resize-none border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-[11px] bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none"
          rows={3}
        />
      ) : (
        <div className="text-[10px] text-zinc-600 dark:text-zinc-400 italic truncate">
          {draft.note ? draft.note : "No note"}
        </div>
      )}
    </div>
  )
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
    setTempEmail(contact.email)
  }, [contact.name, contact.email])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const t = window.setTimeout(() => {
      el.scrollLeft = el.scrollWidth
    }, 0)
    return () => window.clearTimeout(t)
  }, [contact.id, mails.length, manualDrafts.length])

  const handleDropMailAt = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setActiveInsertIndex(null)

    const raw = e.dataTransfer.getData("sentMail")
    if (!raw) return

    try {
      const payload = JSON.parse(raw) as { contactId: string; mailId: string }
      if (!payload.mailId || payload.contactId !== contact.id) return
      onReorderMail?.(contact.id, payload.mailId, index)
      setJustDroppedMailId(payload.mailId)
      window.setTimeout(() => setJustDroppedMailId(null), 450)
    } catch {
      // ignore
    }
  }

  const handleDragOverZone = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    const raw = e.dataTransfer.getData("sentMail")
    if (!raw) return
    e.preventDefault()
    if (activeInsertIndex !== index) setActiveInsertIndex(index)
  }

  const clearActiveInsert = () => {
    setActiveInsertIndex(null)
  }

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
      className={[
        "grid grid-cols-[260px_1fr] border-b border-zinc-200 dark:border-zinc-800",
        getStatusTint(lastSent, priorityAfterDays),
        "hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40"
      ].join(" ")}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        if (isDeleting) return
        const draftId = e.dataTransfer.getData("manualDraft")
        if (!draftId) return

        setManualDrafts(prev => prev.map(d => (d.id === draftId ? { ...d, contactId: contact.id } : d)))
        onManualDraftPlaced?.(draftId)
      }}
    >
      {/* LEFT */}
      <div className="sticky left-0 z-10 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex">
        {isDeleting && onDeleteContact && (
          <button
            onClick={() => onDeleteContact(contact.id)}
            className="px-3 flex items-center text-red-500 hover:text-red-700"
            title="Delete this contact"
          >
            ✕
          </button>
        )}

        <div
          draggable={!isDeleting}
          onDragStart={e => e.dataTransfer.setData("contact", contact.id)}
          className="px-2 flex items-center cursor-grab text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          title="Drag contact"
        >
          ⠿
        </div>

        <div className={`w-1 ${getStatusColor(lastSent, priorityAfterDays)}`} />

        <div className="px-4 py-2 flex-1 overflow-hidden">
          {/* NAME */}
          <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
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
                  className="px-2 py-1 text-sm w-full border border-zinc-200 dark:border-zinc-800 rounded bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button onClick={handleNameSave} className="text-xs text-blue-500 hover:text-blue-700 px-2">
                  ✓
                </button>
              </div>
            ) : (
              <div
                className="hover:bg-zinc-100 dark:hover:bg-zinc-900 px-2 py-1 rounded cursor-text truncate"
                onClick={() => setIsEditingName(true)}
                title="Click to edit name"
              >
                {contact.name}
              </div>
            )}
          </div>

          {/* EMAIL – mit Spotify-Marquee bei Hover, hart begrenzt + overflow hidden */}
          <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">
            {isEditingEmail ? (
              <div className="flex items-center gap-2">
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
                  className="px-2 py-1 text-xs w-full border border-zinc-200 dark:border-zinc-800 rounded bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button onClick={handleEmailSave} className="text-xs text-blue-500 hover:text-blue-700 px-2">
                  ✓
                </button>
              </div>
            ) : (
              <div
                className="hover:bg-zinc-100 dark:hover:bg-zinc-900 px-2 py-1 rounded cursor-text max-w-full overflow-hidden"
                onClick={() => setIsEditingEmail(true)}
                title={contact.email}
              >
                <HoverMarquee text={contact.email} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div ref={scrollerRef} className="overflow-x-auto">
        <div className="flex gap-2 px-3 py-2 items-center">
          {renderDropZone(0)}
          {mails.map((mail, index) => (
            <React.Fragment key={mail.id}>
              <SentMailCard
                mail={mail}
                contactId={contact.id}
                onChangeNote={note => onUpdateMailNote(contact.id, mail.id, note)}
                isDeleting={isDeleting}
                onDeleteMail={() => onDeleteMail?.(contact.id, mail.id)}
                isJustDropped={justDroppedMailId === mail.id}
              />
              {renderDropZone(index + 1)}
            </React.Fragment>
          ))}

          {manualDrafts
            .filter(d => d.contactId === contact.id)
            .map(draft => (
              <ManualDraftCard
                key={draft.id}
                draft={draft}
                setManualDrafts={setManualDrafts}
                isDeleting={isDeleting}
                isJustPlaced={!!justPlacedDraftId && draft.id === justPlacedDraftId}
              />
            ))}
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
  onReorderMail
}: {
  category: Category
  isDeletingMode: boolean
  selectedItems: string[]
  onToggleSelection: (itemId: string) => void
  onUpdateCategoryName: (categoryId: string, name: string) => void
  contacts: Contact[]
  search: string
  sortMode: "custom" | "az" | "priority"
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
}) {
  const [isEditingCategory, setIsEditingCategory] = useState(false)
  const [tempCategoryName, setTempCategoryName] = useState(category.name)

  useEffect(() => {
    setTempCategoryName(category.name)
  }, [category.name])

  const handleCategorySave = () => {
    if (tempCategoryName.trim() && tempCategoryName !== category.name) {
      onUpdateCategoryName(category.id, tempCategoryName.trim())
    }
    setIsEditingCategory(false)
  }

  // 🔹 SORTIERTE KONTAKTE (NEU, aber minimal)
  const sortedContacts = useMemo(() => {
    let list = filterContacts(
      contacts.filter(c => c.categoryId === category.id),
      search
    )

    if (sortMode === "az") {
      return [...list].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    }

    if (sortMode === "priority") {
      return [...list].sort((a, b) => {
        const da =
          daysSince(a.sentMails.at(-1)?.sentAt) ?? Infinity
        const db =
          daysSince(b.sentMails.at(-1)?.sentAt) ?? Infinity
        return db - da
      })
    }

    // custom → nichts verändern
    return list
  }, [contacts, search, sortMode, category.id])

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
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
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
                className="text-xs font-semibold uppercase bg-transparent focus:outline-none text-zinc-700 dark:text-zinc-200 flex-1 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
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

      {sortedContacts.map(contact => (
        <div key={contact.id} className="relative">
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
      ))}
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
    <div className="relative">
      <div
        className={`flex items-center transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? "w-52" : "w-10"
        }`}
      >
        <button
          onClick={handleSearchClick}
          className={`w-10 h-10 flex items-center justify-center transition-colors flex-shrink-0 ${
            isExpanded
              ? "text-zinc-600 dark:text-zinc-300"
              : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-md"
          }`}
          title="Search"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onBlur={handleBlur}
          onFocus={onFocus}
          placeholder="Search…"
          className={`px-3 py-2 bg-transparent focus:outline-none transition-all duration-300 text-sm text-zinc-900 dark:text-zinc-100 ${
            isExpanded ? "opacity-100 w-full pr-8" : "opacity-0 w-0"
          }`}
          style={{ textOverflow: "ellipsis" }}
        />
      </div>

      {search && isExpanded && (
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
  )
}

/* ================= MANUAL DRAFT SOURCE ================= */

function ManualDraftSource({
  isDeletingMode,
  setManualDrafts,
  onDraftCreated,
  isPulsing,
  isDragging
}: {
  isDeletingMode: boolean
  setManualDrafts: React.Dispatch<React.SetStateAction<ManualDraft[]>>
  onDraftCreated?: (draftId: string) => void
  isPulsing?: boolean
  isDragging?: boolean
}) {
  const topCardRef = useRef<HTMLDivElement>(null)

  if (isDeletingMode) return null

  return (
    <div
      draggable
      onDragStart={e => {
        const draft: ManualDraft = { id: generateId(), sentAt: new Date().toISOString() }
        setManualDrafts(prev => [...prev, draft])
        e.dataTransfer.setData("manualDraft", draft.id)

        if (topCardRef.current) {
          e.dataTransfer.setDragImage(topCardRef.current, 20, 20)
        }

        onDraftCreated?.(draft.id)
      }}
      className="fixed bottom-6 right-6 z-50 cursor-grab select-none"
      title="Drag a manual card"
    >
      <div className={`relative w-28 h-20 ${isPulsing ? "animate-stackPush" : ""}`}>
        <div className="absolute inset-0 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-800 translate-x-2 translate-y-2" />
        <div className="absolute inset-0 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 translate-x-1 translate-y-1" />
        <div
          ref={topCardRef}
          className={`absolute inset-0 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 flex items-center justify-center text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 ${
            isDragging ? "animate-wobble" : ""
          }`}
        >
          DRAG ME
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
  const [showSortMenu, setShowSortMenu] = useState(false)


  const [manualDrafts, setManualDrafts] = useState<ManualDraft[]>([])
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showDataMenu, setShowDataMenu] = useState(false)
  const [isDeletingMode, setIsDeletingMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  const [theme, setTheme] = useState<ThemeMode>("light")
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showUploadPreview, setShowUploadPreview] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportedRow[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])

  const [justPlacedDraftId, setJustPlacedDraftId] = useState<string | null>(null)
  const [stackPulse, setStackPulse] = useState(false)
  const [isDraggingDraft, setIsDraggingDraft] = useState(false)

  const [showAddContact, setShowAddContact] = useState(false)
  const [newContactName, setNewContactName] = useState("")
  const [newContactEmail, setNewContactEmail] = useState("")

  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")

  const addMenuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const dataMenuRef = useRef<HTMLDivElement>(null)

  useOnClickOutside([addMenuRef, userMenuRef, dataMenuRef], () => {
    setShowAddMenu(false)
    setShowUserMenu(false)
    setShowDataMenu(false)
  }, showAddMenu || showUserMenu || showDataMenu)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("asl_theme")
      if (stored === "light" || stored === "dark") setTheme(stored)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem("asl_theme", theme)
    } catch {}
  }, [theme])

  const closeAllMenus = () => {
    setShowAddMenu(false)
    setShowUserMenu(false)
    setShowDataMenu(false)
  }

  const handleSearchFocus = () => {
    closeAllMenus()
  }

  const handleScanMails = async () => {
    setScanning(true)
    closeAllMenus()

    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      alert("Scanning complete! Found 3 new emails.")
    } catch (error) {
      alert("Scanning failed: " + error)
    } finally {
      setScanning(false)
    }
  }

  const updateMailNote = (contactId: string, mailId: string, note: string) => {
    setContacts(prev =>
      prev.map(contact => {
        if (contact.id === contactId) {
          return {
            ...contact,
            sentMails: contact.sentMails.map(mail =>
              mail.id === mailId ? { ...mail, note } : mail
            )
          }
        }
        return contact
      })
    )
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

    const newCategory: Category = { id: generateId(), name: newCategoryName.trim() }
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

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => (prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]))
  }

  const allSelectableIds = useMemo(() => {
    const ids: string[] = []
    categories.forEach(c => ids.push(`category_${c.id}`))
    contacts.forEach(c => ids.push(`contact_${c.id}`))
    return ids
  }, [categories, contacts])

  const deleteItems = (itemsToDelete: string[]) => {
    if (itemsToDelete.length === 0) return

    const contactIds = itemsToDelete.filter(id => id.startsWith("contact_"))
    const categoryIds = itemsToDelete.filter(id => id.startsWith("category_"))

    let message = ""
    if (contactIds.length > 0 && categoryIds.length > 0) {
      message = `Delete ${contactIds.length} contact(s) and ${categoryIds.length} category(ies)? Contacts in categories will be moved to Uncategorized.`
    } else if (contactIds.length > 0) {
      message = `Delete ${contactIds.length} selected contact(s)?`
    } else if (categoryIds.length > 0) {
      message = `Delete ${categoryIds.length} selected category(ies)? Contacts will be moved to Uncategorized.`
    }

    if (!message) return

    if (confirm(message)) {
      if (contactIds.length > 0) {
        setContacts(prev => prev.filter(c => !contactIds.includes(`contact_${c.id}`)))
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

  const handleFilePick = () => {
    closeAllMenus()
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (file: File) => {
    const text = await file.text()
    const rows = parseCsvSimple(text)

    const errors: string[] = []
    const cleaned: ImportedRow[] = rows
      .map((r, i) => {
        const email = sanitizeEmail(r.email)
        if (email && !isValidEmail(email)) {
          errors.push(`Row ${i + 1}: invalid email "${r.email}"`)
        }
        return { name: r.name?.trim() ?? "", email }
      })
      .filter(r => r.name || r.email)

    setImportErrors(errors.slice(0, 10))
    setImportPreview(cleaned.slice(0, 200))
    setShowUploadPreview(true)
  }

  const handleImportConfirm = () => {
    const toAdd = importPreview.filter(r => r.email && isValidEmail(r.email))
    if (toAdd.length === 0) {
      alert("No valid rows to import.")
      return
    }

    setContacts(prev => [
      ...prev,
      ...toAdd.map(r => ({
        id: generateId(),
        name: r.name || r.email,
        email: r.email,
        categoryId: null,
        sentMails: []
      }))
    ])

    setShowUploadPreview(false)
    setImportPreview([])
    setImportErrors([])
  }

  const handleManualDraftPlaced = (draftId: string) => {
    setJustPlacedDraftId(draftId)
    setStackPulse(true)
    window.setTimeout(() => setStackPulse(false), 250)
    window.setTimeout(() => setJustPlacedDraftId(null), 650)
  }

  const handleDraftCreated = () => {
    setIsDraggingDraft(true)
    window.setTimeout(() => setIsDraggingDraft(false), 900)
  }

  const handleSettings = () => {
    setShowSettingsModal(true)
    setShowUserMenu(false)
  }

  const handleChangeAccount = () => {
    alert("Change account would open here")
    setShowUserMenu(false)
  }

  const handleLogout = () => {
    alert("Logout would happen here")
    setShowUserMenu(false)
  }

  useEffect(() => {
    try {
      setTimeout(() => {
        setContacts(MOCK_CONTACTS)
        setLoading(false)
      }, 500)
    } catch (error) {
      console.error("Error loading data:", error)
      setContacts(MOCK_CONTACTS)
      setLoading(false)
    }
  }, [])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-zinc-400 bg-white dark:bg-zinc-950">
        Loading dashboard…
      </div>
    )
  }

  const hasUncategorizedContacts = contacts.filter(c => !c.categoryId).length > 0

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
        .marquee-inner { will-change: transform; }
        .marquee-container:hover .marquee-inner.marquee-active {
          animation: marquee 7s linear infinite;
        }
      `}</style>

      {/* HEADER */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="font-semibold text-lg">Audio Send Log</div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <ExpandingSearchBar search={search} setSearch={setSearch} onFocus={handleSearchFocus} />

          {/* DATA MENU */}
          <div className="relative" ref={dataMenuRef}>
            <button
              onClick={() => {
                if (isDeletingMode) return
                setShowDataMenu(v => !v)
                setShowAddMenu(false)
                setShowUserMenu(false)
              }}
              className={`h-10 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors text-sm ${
                isDeletingMode ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title="Import / Export"
              disabled={isDeletingMode}
            >
              Data
            </button>

            {showDataMenu && !isDeletingMode && (
              <div className="absolute right-0 top-full mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 min-w-56 overflow-hidden">
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
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 border-t border-zinc-200 dark:border-zinc-800 transition-colors"
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
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                void handleFileSelected(file)
                e.currentTarget.value = ""
              }}
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
              title={isDeletingMode ? "Cannot add in delete mode" : "Add"}
              disabled={isDeletingMode}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>

            {showAddMenu && !isDeletingMode && (
              <div className="absolute right-0 top-full mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 min-w-52 overflow-hidden">
                <button
                  onClick={() => {
                    setShowAddContact(true)
                    setShowAddMenu(false)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 transition-colors"
                >
                  <AddContactIcon className="w-5 h-5 text-zinc-700 dark:text-zinc-200" />
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
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 border-t border-zinc-200 dark:border-zinc-800 transition-colors"
                >
                  <AddCategoryIcon className="w-5 h-5 text-zinc-700 dark:text-zinc-200" />
                  <div>
                    <div className="font-medium">Add Category</div>
                    <div className="text-xs text-zinc-500">New group for contacts</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* TRASH BUTTON + SELECT/DELETE ALL CONTROLS */}
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
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
              className={`w-10 h-10 rounded-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors ${
                isDeletingMode ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title={isDeletingMode ? "Cannot open menu in delete mode" : "User menu"}
              disabled={isDeletingMode}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>

            {showUserMenu && !isDeletingMode && (
              <div className="absolute right-0 top-full mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 min-w-56 overflow-hidden">
                <button
                  onClick={handleSettings}
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <div className="font-medium">Change Account</div>
                    <div className="text-xs text-zinc-500">Switch to different account</div>
                  </div>
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 border-t border-zinc-200 dark:border-zinc-800 text-red-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <div>
                    <div className="font-medium">Log Out</div>
                    <div className="text-xs text-zinc-500">Sign out of your account</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* SCAN BUTTON */}
          <button
            onClick={handleScanMails}
            disabled={scanning}
            className="rounded-md border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {scanning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Scanning…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 19a8 8 0 100-16 8 8 0 000 16zm10 2l-4.35-4.35" />
                </svg>
                Scan
              </>
            )}
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-auto">
  <div className="min-w-[900px] px-4 py-4 space-y-8">

    {/* TABLE TOOLBAR */}
    <div className="flex items-center justify-between mb-4 px-2">
      {isDeletingMode ? (
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAll}
            className="px-2 py-1 text-xs border rounded"
          >
            Select all
          </button>
          <button
            onClick={handleClearSelection}
            className="px-2 py-1 text-xs border rounded"
          >
            Clear
          </button>
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(v => !v)}
            className="px-2 py-1 text-xs border rounded"
          >
            Sort
          </button>

          {showSortMenu && (
            <div className="absolute mt-1 bg-white dark:bg-zinc-950 border rounded shadow z-20">
              <button
                onClick={() => {
                  setSortMode("custom")
                  setShowSortMenu(false)
                }}
                className="block px-3 py-2 text-xs w-full text-left"
              >
                Custom
              </button>
              <button
                onClick={() => {
                  setSortMode("az")
                  setShowSortMenu(false)
                }}
                className="block px-3 py-2 text-xs w-full text-left"
              >
                A–Z
              </button>
              <button
                onClick={() => {
                  setSortMode("priority")
                  setShowSortMenu(false)
                }}
                className="block px-3 py-2 text-xs w-full text-left"
              >
                Priority
              </button>
            </div>
          )}
        </div>
      )}
    </div>

    {categories.map(category => (
      <CategorySection
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
      />
    ))}
    
          {hasUncategorizedContacts && (
            <div
              className="border border-zinc-200 dark:border-zinc-800 rounded overflow-hidden"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                if (isDeletingMode) return
                const contactId = e.dataTransfer.getData("contact")
                if (!contactId) return
                handleDragContactToUncategorized(contactId)
              }}
            >
              <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
                Uncategorized
              </div>

              {filterContacts(contacts.filter(c => !c.categoryId), search).map(contact => (
                <div key={contact.id} className="relative">
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
                    onUpdateMailNote={updateMailNote}
                    onUpdateContactName={updateContactName}
                    onUpdateContactEmail={updateContactEmail}
                    onDeleteContact={isDeletingMode ? handleDeleteContact : undefined}
                    onDeleteMail={isDeletingMode ? deleteMail : undefined}
                    isDeleting={isDeletingMode}
                    onManualDraftPlaced={handleManualDraftPlaced}
                    justPlacedDraftId={justPlacedDraftId}
                    onReorderMail={handleReorderMail}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ADD CONTACT MODAL – ENTER bestätigt, ESC schließt */}
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

          {/* ADD CATEGORY MODAL – ENTER bestätigt, ESC schließt */}
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
        </div>
      </main>

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onMouseDown={() => setShowSettingsModal(false)}
        >
          <div
            className="bg-white dark:bg-zinc-950 rounded-lg p-6 w-[420px] border border-zinc-200 dark:border-zinc-800"
            onMouseDown={e => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-4">Settings</h3>

            <div className="mb-4">
              <div className="font-medium mb-1">Theme</div>
              <div className="text-xs text-zinc-500 mb-2">Choose between light and dark mode</div>
              <div className="flex gap-2">
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

            <div className="py-2">
              <div className="font-medium mb-1">Priority threshold (days)</div>
              <div className="text-xs text-zinc-500 mb-2">Controls the relevance color tint</div>
              <input
                type="range"
                min={7}
                max={120}
                value={priorityAfterDays}
                onChange={e => setPriorityAfterDays(parseInt(e.target.value, 10))}
                className="w-full"
              />
              <div className="text-xs text-zinc-500 mt-1">{priorityAfterDays} days</div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD PREVIEW MODAL */}
      {showUploadPreview && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onMouseDown={() => setShowUploadPreview(false)}
        >
          <div
            className="bg-white dark:bg-zinc-950 rounded-lg p-6 w-[640px] border border-zinc-200 dark:border-zinc-800"
            onMouseDown={e => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-2">File Upload Preview</h3>
            <div className="text-xs text-zinc-500 mb-4">
              Expected: column A = Name, column B = Email (Google Sheets export works).
            </div>

            {importErrors.length > 0 && (
              <div className="mb-3 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3">
                <div className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">
                  Some rows have issues:
                </div>
                <ul className="text-xs text-red-700 dark:text-red-300 list-disc ml-5">
                  {importErrors.map((e, idx) => (
                    <li key={idx}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="max-h-[320px] overflow-auto border border-zinc-200 dark:border-zinc-800 rounded">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900/40 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((r, idx) => (
                    <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-900">
                      <td className="p-2">{r.name}</td>
                      <td className="p-2">{r.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowUploadPreview(false)}
                className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
              >
                Cancel
              </button>
              <button
                onClick={handleImportConfirm}
                className="px-4 py-2 bg-black text-white rounded dark:bg-white dark:text-black"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING MANUAL DRAFT SOURCE */}
      <ManualDraftSource
        isDeletingMode={isDeletingMode}
        setManualDrafts={setManualDrafts}
        onDraftCreated={handleDraftCreated}
        isPulsing={stackPulse}
        isDragging={isDraggingDraft}
      />
    </div>
  )
}
