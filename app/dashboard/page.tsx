"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"

/* ================= TYPES ================= */

type Attachment = {
  id: string
  filename: string
}

type SentMail = {
  id: string
  sentAt: string
  attachments: Attachment[]
  note?: string
  status?: "unread" | "read" | "single-check" | "double-check"
  source?: "gmail" | "manual"
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
        status: "double-check",
        attachments: [
          { id: "a1", filename: "beat_140bpm.wav" },
          { id: "a2", filename: "beat_alt.wav" }
        ]
      }
    ]
  },
  {
    id: "c2",
    name: "Lisa Songwriter",
    email: "lisa@studio.com",
    categoryId: "cat-2",
    sentMails: [
      {
        id: "m2",
        sentAt: "2024-08-05",
        status: "unread",
        attachments: [{ id: "a3", filename: "reference_song_demo_long_filename_v2.wav" }]
      }
    ]
  }
]

/* ================= HELPERS ================= */

// SICHERE UUID GENERATOR
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

function daysSince(dateIso?: string) {
  if (!dateIso) return undefined
  const days =
    (Date.now() - new Date(dateIso).getTime()) / (1000 * 60 * 60 * 24)
  return days
}

function getStatusColor(lastSentAt?: string, priorityAfterDays = 30) {
  if (!lastSentAt) return "bg-gray-300 dark:bg-zinc-700"

  const days = daysSince(lastSentAt) ?? 0

  if (days >= priorityAfterDays) return "bg-red-400"
  if (days >= priorityAfterDays * 0.6) return "bg-orange-300"
  if (days >= priorityAfterDays * 0.3) return "bg-yellow-200"
  return "bg-green-300"
}

function getStatusTint(lastSentAt?: string, priorityAfterDays = 30) {
  if (!lastSentAt) return "bg-zinc-50 dark:bg-zinc-900/40"
  const days = daysSince(lastSentAt) ?? 0

  if (days >= priorityAfterDays) return "bg-red-50 dark:bg-red-950/30"
  if (days >= priorityAfterDays * 0.6) return "bg-orange-50 dark:bg-orange-950/25"
  if (days >= priorityAfterDays * 0.3) return "bg-yellow-50 dark:bg-yellow-950/20"
  return "bg-green-50 dark:bg-green-950/20"
}

function getMailStatusStyles(status?: SentMail["status"]) {
  switch (status) {
    case "unread":
      return "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30"
    case "read":
      return "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30"
    case "single-check":
      return "border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/30"
    case "double-check":
      return "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30"
    default:
      return "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
  }
}

function getMailStatusDot(status?: SentMail["status"]) {
  switch (status) {
    case "unread":
      return "bg-amber-500"
    case "read":
      return "bg-emerald-500"
    case "single-check":
      return "bg-sky-500"
    case "double-check":
      return "bg-indigo-500"
    default:
      return "bg-zinc-300 dark:bg-zinc-600"
  }
}

function formatDate(dateIso: string) {
  return new Date(dateIso).toLocaleDateString()
}

function sanitizeEmail(email: string) {
  return email.trim()
}

function isValidEmail(email: string) {
  // bewusst simpel (Frontend only)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function parseCsvSimple(text: string): ImportedRow[] {
  // Unterstützt CSV/TSV/; getrennt – erwartet Spalte A = Name, Spalte B = Mail
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)

  if (lines.length === 0) return []

  // delimiter guess
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

  // header detection (wenn erste Zeile "name,email" oder ähnlich)
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

/* ================= ICONS ================= */

function AddContactIcon({ className }: { className?: string }) {
  // vom User geliefert – fill auf currentColor umgestellt
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
  // SVG Repo file – fill auf currentColor umgestellt
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
    if (!enabled) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedInside = refs.some(
        (r) => r.current?.contains(target)
      );
      if (!clickedInside) handler();
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [refs, handler, enabled]);
}

/* ================= COMPONENTS ================= */

function SentMailCard({
  mail,
  onChangeNote,
  isDeleting,
  onDeleteMail,
  scanAnimationActive,
  scanAnimationDelay
}: {
  mail: SentMail
  onChangeNote: (note: string) => void
  isDeleting?: boolean
  onDeleteMail?: () => void
  scanAnimationActive?: boolean
  scanAnimationDelay?: number
}) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={[
        "min-w-[160px] rounded border px-2 py-2 text-[11px] relative group transition-transform",
        getMailStatusStyles(mail.status),
        scanAnimationActive ? "animate-scanPop" : ""
      ].join(" ")}
      style={scanAnimationActive ? { animationDelay: `${scanAnimationDelay ?? 0}ms` } : undefined}
    >
      {/* LÖSCH-KREUZ (nur im Lösch-Modus) */}
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
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span className={`h-2 w-2 rounded-full ${getMailStatusDot(mail.status)}`} />
          {formatDate(mail.sentAt)}
        </div>

        {/* NOTIZ BUTTON oben rechts */}
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

      {/* NOTE AREA */}
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

      {/* show note preview even when closed */}
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
      {/* LÖSCH-KREUZ für Manual Drafts (NUR im Delete Mode) */}
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

        {/* NOTIZ BUTTON oben rechts */}
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
  scanAnimationActive,
  scanAnimationDelay,
  isJustMoved
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
  scanAnimationActive?: boolean
  scanAnimationDelay?: number
  isJustMoved?: boolean
}) {
  const sortedMails = useMemo(() => {
    return [...contact.sentMails].sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
    )
  }, [contact.sentMails])

  const lastSent = useMemo(() => {
    if (sortedMails.length === 0) return undefined
    return sortedMails[sortedMails.length - 1].sentAt
  }, [sortedMails])

  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [tempName, setTempName] = useState(contact.name)
  const [tempEmail, setTempEmail] = useState(contact.email)

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

  // Reset temp values when contact changes
  useEffect(() => {
    setTempName(contact.name)
    setTempEmail(contact.email)
  }, [contact.name, contact.email])

  // immer rechts starten (neueste sichtbar)
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    // next tick, damit DOM fertig ist
    const t = window.setTimeout(() => {
      el.scrollLeft = el.scrollWidth
    }, 0)
    return () => window.clearTimeout(t)
  }, [contact.id, sortedMails.length, manualDrafts.length])

  return (
    <div
      className={[
        "grid grid-cols-[260px_1fr] border-b border-zinc-200 dark:border-zinc-800 transition-transform",
        getStatusTint(lastSent, priorityAfterDays),
        "hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40",
        scanAnimationActive ? "animate-scanPop" : "",
        isJustMoved ? "animate-dropIn" : ""
      ].join(" ")}
      style={scanAnimationActive ? { animationDelay: `${scanAnimationDelay ?? 0}ms` } : undefined}
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
        {/* LÖSCH-KREUZ (nur im Lösch-Modus) */}
        {isDeleting && onDeleteContact && (
          <button
            onClick={() => onDeleteContact(contact.id)}
            className="px-3 flex items-center text-red-500 hover:text-red-700"
            title="Delete this contact"
          >
            ✕
          </button>
        )}

        {/* DRAG HANDLE */}
        <div
          draggable={!isDeleting}
          onDragStart={e => e.dataTransfer.setData("contact", contact.id)}
          className="px-2 flex items-center cursor-grab text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          title="Drag contact"
        >
          ⠿
        </div>

        {/* STATUS BAR */}
        <div className={`w-1 ${getStatusColor(lastSent, priorityAfterDays)}`} />

        {/* CONTACT INFO */}
        <div className="px-4 py-2 flex-1">
          {/* NAME - bearbeitbar */}
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
                className="hover:bg-zinc-100 dark:hover:bg-zinc-900 px-2 py-1 rounded cursor-text"
                onClick={() => setIsEditingName(true)}
                title="Click to edit name"
              >
                {contact.name}
              </div>
            )}
          </div>

          {/* EMAIL - bearbeitbar */}
          <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
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
                  className="px-2 py-1 text-sm w-full border border-zinc-200 dark:border-zinc-800 rounded bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button onClick={handleEmailSave} className="text-xs text-blue-500 hover:text-blue-700 px-2">
                  ✓
                </button>
              </div>
            ) : (
              <div
                className="hover:bg-zinc-100 dark:hover:bg-zinc-900 px-2 py-1 rounded cursor-text"
                onClick={() => setIsEditingEmail(true)}
                title="Click to edit email"
              >
                {contact.email}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-2 px-4 py-2 min-h-[70px]" ref={scrollerRef}>
          {sortedMails.map((mail, idx) => (
            <SentMailCard
              key={mail.id}
              mail={mail}
              isDeleting={isDeleting}
              onDeleteMail={() => onDeleteMail?.(contact.id, mail.id)}
              onChangeNote={note => onUpdateMailNote(contact.id, mail.id, note)}
              scanAnimationActive={scanAnimationActive}
              scanAnimationDelay={scanAnimationDelay ? scanAnimationDelay + idx * 60 : undefined}
            />
          ))}

          {/* MANUAL DRAFTS for this contact */}
          {manualDrafts
            .filter(d => d.contactId === contact.id)
            .map(draft => (
              <ManualDraftCard
                key={draft.id}
                draft={draft}
                setManualDrafts={setManualDrafts}
                isDeleting={isDeleting}
                isJustPlaced={justPlacedDraftId === draft.id}
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
  onReorderContact,
  scanAnimationActive,
  scanAnimationBaseDelay,
  justMovedContactId
}: {
  category: Category
  isDeletingMode: boolean
  selectedItems: string[]
  onToggleSelection: (id: string) => void
  onUpdateCategoryName: (id: string, name: string) => void
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
  justPlacedDraftId: string | null
  onReorderContact: (draggedId: string, targetId: string, position: "before" | "after", categoryId: string | null) => void
  scanAnimationActive: boolean
  scanAnimationBaseDelay: number
  justMovedContactId: string | null
}) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [tempName, setTempName] = useState(category.name)
  const [dropTarget, setDropTarget] = useState<{ id: string; position: "before" | "after" } | null>(null)

  const categoryContacts = useMemo(
    () => filterContacts(contacts.filter(c => c.categoryId === category.id), search),
    [contacts, category.id, search]
  )

  const handleSave = () => {
    if (tempName.trim() && tempName !== category.name) {
      onUpdateCategoryName(category.id, tempName.trim())
    }
    setIsEditingName(false)
  }

  return (
    <div
      className="border border-zinc-200 dark:border-zinc-800 rounded overflow-hidden"
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        if (isDeletingMode) return
        const contactId = e.dataTransfer.getData("contact")
        if (contactId) {
          onDragContactToCategory(contactId, category.id)
          setDropTarget(null)
        }
      }}
      onDragLeave={() => setDropTarget(null)}
    >
      {/* HEADER */}
      <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex items-center justify-between">
        {isEditingName ? (
          <input
            value={tempName}
            onChange={e => setTempName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => {
              if (e.key === "Enter") handleSave()
              if (e.key === "Escape") {
                setTempName(category.name)
                setIsEditingName(false)
              }
            }}
            className="px-2 py-1 text-xs border border-zinc-200 dark:border-zinc-800 rounded bg-transparent"
            autoFocus
          />
        ) : (
          <span onClick={() => setIsEditingName(true)} className="cursor-pointer">
            {category.name}
          </span>
        )}
        <span>{categoryContacts.length}</span>
      </div>

      {/* LIST */}
      {categoryContacts.map((contact, index) => (
        <div
          key={contact.id}
          className="relative"
          onDragOver={e => {
            if (isDeletingMode) return
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
            const isBefore = e.clientY < rect.top + rect.height / 2
            setDropTarget({ id: contact.id, position: isBefore ? "before" : "after" })
          }}
          onDrop={e => {
            if (isDeletingMode) return
            const contactId = e.dataTransfer.getData("contact")
            if (!contactId) return
            if (contactId === contact.id) return
            if (!dropTarget) return
            onReorderContact(contactId, contact.id, dropTarget.position, category.id)
            setDropTarget(null)
          }}
        >
          {dropTarget?.id === contact.id && dropTarget.position === "before" && (
            <div className="absolute -top-[2px] left-0 right-0 h-1 bg-blue-500/70 rounded-full z-20" />
          )}
          {dropTarget?.id === contact.id && dropTarget.position === "after" && (
            <div className="absolute -bottom-[2px] left-0 right-0 h-1 bg-blue-500/70 rounded-full z-20" />
          )}
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
            scanAnimationActive={scanAnimationActive}
            scanAnimationDelay={scanAnimationBaseDelay + index * 80}
            isJustMoved={justMovedContactId === contact.id}
          />
        </div>
      ))}
    </div>
  )
}

/* ================= MAIN ================= */

export default function DashboardPage() {
  const [contacts, setContacts] = useState<Contact[]>(MOCK_CONTACTS)
  const [categories, setCategories] = useState<Category[]>([
    { id: "cat-1", name: "A-List" },
    { id: "cat-2", name: "B-List" }
  ])

  const [manualDrafts, setManualDrafts] = useState<ManualDraft[]>([])
  const [priorityAfterDays, setPriorityAfterDays] = useState(30)

  const [search, setSearch] = useState("")
  const [isDeletingMode, setIsDeletingMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showDataMenu, setShowDataMenu] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showUploadPreview, setShowUploadPreview] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportedRow[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])

  const [newContactName, setNewContactName] = useState("")
  const [newContactEmail, setNewContactEmail] = useState("")
  const [newCategoryName, setNewCategoryName] = useState("")

  const [theme, setTheme] = useState<ThemeMode>("light")

  const [justPlacedDraftId, setJustPlacedDraftId] = useState<string | null>(null)
  const [stackPulse, setStackPulse] = useState(false)
  const [isDraggingDraft, setIsDraggingDraft] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanAnimationActive, setScanAnimationActive] = useState(false)

  const [justMovedContactId, setJustMovedContactId] = useState<string | null>(null)
  const [uncategorizedDropTarget, setUncategorizedDropTarget] = useState<{
    id: string
    position: "before" | "after"
  } | null>(null)

  const addMenuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const dataMenuRef = useRef<HTMLDivElement>(null)

  useOnClickOutside([addMenuRef, userMenuRef, dataMenuRef], () => {
    setShowAddMenu(false)
    setShowUserMenu(false)
    setShowDataMenu(false)
  }, showAddMenu || showUserMenu || showDataMenu)

  const closeAllMenus = () => {
    setShowAddMenu(false)
    setShowUserMenu(false)
    setShowDataMenu(false)
  }

  const handleAddContact = () => {
    const email = sanitizeEmail(newContactEmail)
    if (!newContactName.trim() || !email || !isValidEmail(email)) return

    setContacts(prev => [
      ...prev,
      {
        id: generateId(),
        name: newContactName.trim(),
        email,
        categoryId: null,
        sentMails: []
      }
    ])

    setNewContactName("")
    setNewContactEmail("")
    setShowAddContact(false)
  }

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return
    setCategories(prev => [
      ...prev,
      { id: generateId(), name: newCategoryName.trim() }
    ])
    setNewCategoryName("")
    setShowAddCategory(false)
  }

  const updateCategoryName = (id: string, name: string) => {
    setCategories(prev => prev.map(c => (c.id === id ? { ...c, name } : c)))
  }

  const updateContactName = (id: string, name: string) => {
    setContacts(prev => prev.map(c => (c.id === id ? { ...c, name } : c)))
  }

  const updateContactEmail = (id: string, email: string) => {
    setContacts(prev => prev.map(c => (c.id === id ? { ...c, email } : c)))
  }

  const updateMailNote = (contactId: string, mailId: string, note: string) => {
    setContacts(prev =>
      prev.map(c =>
        c.id === contactId
          ? {
              ...c,
              sentMails: c.sentMails.map(m =>
                m.id === mailId ? { ...m, note } : m
              )
            }
          : c
      )
    )
  }

  const deleteMail = (contactId: string, mailId: string) => {
    setContacts(prev =>
      prev.map(c =>
        c.id === contactId
          ? { ...c, sentMails: c.sentMails.filter(m => m.id !== mailId) }
          : c
      )
    )
  }

  const handleDeleteContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleSelectAllDelete = () => {
    const allIds: string[] = []

    contacts.forEach(contact => {
      allIds.push(`contact_${contact.id}`)
      contact.sentMails.forEach(mail => {
        allIds.push(`mail_${contact.id}_${mail.id}`)
      })
    })

    setSelectedItems(allIds)
  }

  const handleDeleteSelected = () => {
    if (selectedItems.length === 0) return

    setContacts(prev =>
      prev
        .filter(c => !selectedItems.includes(`contact_${c.id}`))
        .map(c => ({
          ...c,
          sentMails: c.sentMails.filter(
            m => !selectedItems.includes(`mail_${c.id}_${m.id}`)
          )
        }))
    )

    setSelectedItems([])
    setIsDeletingMode(false)
  }

  const handleDeleteAll = () => {
    setContacts([])
    setSelectedItems([])
    setIsDeletingMode(false)
  }

  const handleDragContactToCategory = (contactId: string, categoryId: string) => {
    setContacts(prev =>
      prev.map(c => (c.id === contactId ? { ...c, categoryId } : c))
    )
  }

  const handleDragContactToUncategorized = (contactId: string) => {
    setContacts(prev =>
      prev.map(c => (c.id === contactId ? { ...c, categoryId: null } : c))
    )
  }

  const handleReorderContact = (
    draggedId: string,
    targetId: string,
    position: "before" | "after",
    categoryId: string | null
  ) => {
    setContacts(prev => {
      const list = [...prev]
      const draggedIndex = list.findIndex(c => c.id === draggedId)
      const targetIndex = list.findIndex(c => c.id === targetId)
      if (draggedIndex === -1 || targetIndex === -1) return prev

      const dragged = list[draggedIndex]
      list.splice(draggedIndex, 1)

      const insertIndex =
        draggedIndex < targetIndex
          ? position === "before"
            ? targetIndex - 1
            : targetIndex
          : position === "before"
          ? targetIndex
          : targetIndex + 1

      list.splice(insertIndex, 0, { ...dragged, categoryId })

      return list
    })

    setJustMovedContactId(draggedId)
    window.setTimeout(() => setJustMovedContactId(null), 350)
  }

  const handleManualDraftPlaced = (draftId: string) => {
    setJustPlacedDraftId(draftId)
    window.setTimeout(() => setJustPlacedDraftId(null), 350)
  }

  const handleDraftCreated = (draft: ManualDraft) => {
    setManualDrafts(prev => [...prev, draft])
  }

  const handleScanMails = () => {
    setScanning(true)

    window.setTimeout(() => {
      setContacts(prev =>
        prev.map(c => ({
          ...c,
          sentMails: [
            ...c.sentMails,
            {
              id: generateId(),
              sentAt: new Date().toISOString(),
              status: ["unread", "read", "single-check", "double-check"][
                Math.floor(Math.random() * 4)
              ] as SentMail["status"],
              attachments: [
                { id: generateId(), filename: "new_mail_audio_take.wav" }
              ],
              source: "gmail"
            }
          ]
        }))
      )

      setScanning(false)
      setScanAnimationActive(true)
      window.setTimeout(() => setScanAnimationActive(false), 800)
    }, 1400)
  }

  const handleImportFile = async (file: File) => {
    const text = await file.text()
    const rows = parseCsvSimple(text)

    const errors: string[] = []
    const preview: ImportedRow[] = []

    rows.forEach((r, idx) => {
      if (!r.name || !r.email || !isValidEmail(r.email)) {
        errors.push(`Row ${idx + 1}: Missing or invalid email`)
      } else {
        preview.push(r)
      }
    })

    setImportPreview(preview)
    setImportErrors(errors)
    setShowUploadPreview(true)
  }

  const handleImportConfirm = () => {
    setContacts(prev => [
      ...prev,
      ...importPreview.map(r => ({
        id: generateId(),
        name: r.name,
        email: r.email,
        categoryId: null,
        sentMails: []
      }))
    ])

    setImportPreview([])
    setImportErrors([])
    setShowUploadPreview(false)
  }

  const handleExportContacts = () => {
    const content = contacts.map(c => `${c.name},${c.email}`).join("\n")
    downloadTextFile("contacts.csv", content)
  }

  const handleSettings = () => {
    closeAllMenus()
    setShowSettingsModal(true)
  }

  const handleChangeAccount = () => {
    closeAllMenus()
    alert("Change account clicked")
  }

  const handleLogout = () => {
    closeAllMenus()
    alert("Logout clicked")
  }

  const hasUncategorizedContacts = useMemo(
    () => contacts.some(c => !c.categoryId),
    [contacts]
  )

  return (
    <div className={`min-h-screen flex flex-col ${theme === "dark" ? "dark" : ""}`}>
      <style jsx>{`
        @keyframes dropIn {
          0% { transform: scale(0.95) translateY(-4px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-dropIn {
          animation: dropIn 0.35s ease-out both;
        }

        @keyframes scanPop {
          0% { transform: scale(0.94) translateY(-6px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-scanPop { animation: scanPop 0.45s ease-out both; }

        .marquee {
          position: relative;
          overflow: hidden;
          white-space: nowrap;
        }
        .marquee span {
          display: inline-block;
          padding-right: 24px;
          transform: translateX(0);
        }
        .marquee:hover span {
          animation: marquee-scroll 6s linear infinite;
        }
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
      `}</style>

      {/* HEADER */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-semibold text-lg">Beats CRM</div>
            <input
              type="text"
              placeholder="Search contacts…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="ml-4 px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded text-sm bg-white dark:bg-zinc-950"
            />
          </div>

          <div className="flex items-center gap-3">
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
                title={isDeletingMode ? "Cannot open menu in delete mode" : "Add"}
                disabled={isDeletingMode}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                </svg>
              </button>

              {showAddMenu && !isDeletingMode && (
                <div className="absolute right-0 top-full mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 min-w-52 overflow-hidden text-zinc-900 dark:text-zinc-100">
                  <button
                    onClick={() => {
                      setShowAddContact(true)
                      closeAllMenus()
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 transition-colors"
                  >
                    <AddContactIcon className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                    <div>
                      <div className="font-medium">Add Contact</div>
                      <div className="text-xs text-zinc-500">Add a new person</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setShowAddCategory(true)
                      closeAllMenus()
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 border-t border-zinc-200 dark:border-zinc-800 transition-colors"
                  >
                    <AddCategoryIcon className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                    <div>
                      <div className="font-medium">Add Category</div>
                      <div className="text-xs text-zinc-500">Create a new group</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* DATA MENU */}
            <div className="relative" ref={dataMenuRef}>
              <button
                onClick={() => {
                  if (isDeletingMode) return
                  setShowDataMenu(v => !v)
                  setShowAddMenu(false)
                  setShowUserMenu(false)
                }}
                className={`w-10 h-10 rounded-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors ${
                  isDeletingMode ? "opacity-50 cursor-not-allowed" : ""
                }`}
                title={isDeletingMode ? "Cannot open menu in delete mode" : "Data"}
                disabled={isDeletingMode}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {showDataMenu && !isDeletingMode && (
                <div className="absolute right-0 top-full mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 min-w-52 overflow-hidden text-zinc-900 dark:text-zinc-100">
                  <button
                    onClick={handleExportContacts}
                    className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-5 h-5 text-zinc-900 dark:text-zinc-100" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-8m0 0l-4 4m4-4l4 4M4 20h16" />
                    </svg>
                    <div>
                      <div className="font-medium">Export</div>
                      <div className="text-xs text-zinc-500">Download contacts</div>
                    </div>
                  </button>

                  <label className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 border-t border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer">
                    <svg className="w-5 h-5 text-zinc-900 dark:text-zinc-100" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v-6a4 4 0 014-4h8a4 4 0 014 4v6M12 12v8m-4-4l4 4 4-4" />
                    </svg>
                    <div>
                      <div className="font-medium">Import</div>
                      <div className="text-xs text-zinc-500">Upload CSV</div>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".csv,.txt"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handleImportFile(file)
                        e.currentTarget.value = ""
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* DELETE MODE */}
            <button
              onClick={() => {
                if (isDeletingMode) {
                  setIsDeletingMode(false)
                  setSelectedItems([])
                } else {
                  closeAllMenus()
                  setIsDeletingMode(true)
                }
              }}
              className="px-3 py-2 text-sm border border-red-200 text-red-600 rounded hover:bg-red-50"
            >
              {isDeletingMode ? "Cancel Delete" : "Delete"}
            </button>

            {/* USER MENU BUTTON */}
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

              {/* USER MENÜ */}
              {showUserMenu && !isDeletingMode && (
                <div className="absolute right-0 top-full mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 min-w-56 overflow-hidden text-zinc-900 dark:text-zinc-100">
                  <button
                    onClick={handleSettings}
                    className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 transition-colors text-zinc-900 dark:text-zinc-100"
                  >
                    <svg className="w-5 h-5 text-zinc-900 dark:text-zinc-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 border-t border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                  >
                    <svg className="w-5 h-5 text-zinc-900 dark:text-zinc-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            {/* SCAN BUTTON (monochrome, no emoji) */}
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
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-auto">
        <div className="min-w-[900px] px-4 py-4 space-y-8">
          {/* CATEGORIES */}
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
                onReorderContact={handleReorderContact}
                scanAnimationActive={scanAnimationActive}
                scanAnimationBaseDelay={40}
                justMovedContactId={justMovedContactId}
              />
            ))}

          {/* UNCATEGORIZED */}
          {hasUncategorizedContacts && (
            <div
              className="border border-zinc-200 dark:border-zinc-800 rounded overflow-hidden"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                if (isDeletingMode) return
                const contactId = e.dataTransfer.getData("contact")
                if (!contactId) return
                handleDragContactToUncategorized(contactId)
                setUncategorizedDropTarget(null)
              }}
              onDragLeave={() => setUncategorizedDropTarget(null)}
            >
              <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
                Uncategorized
              </div>

              {filterContacts(contacts.filter(c => !c.categoryId), search).map((contact, index) => (
                <div
                  key={contact.id}
                  className="relative"
                  onDragOver={e => {
                    if (isDeletingMode) return
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                    const isBefore = e.clientY < rect.top + rect.height / 2
                    setUncategorizedDropTarget({ id: contact.id, position: isBefore ? "before" : "after" })
                  }}
                  onDrop={e => {
                    if (isDeletingMode) return
                    const contactId = e.dataTransfer.getData("contact")
                    if (!contactId) return
                    if (contactId === contact.id) return
                    if (!uncategorizedDropTarget) return
                    handleReorderContact(contactId, contact.id, uncategorizedDropTarget.position, null)
                    setUncategorizedDropTarget(null)
                  }}
                >
                  {uncategorizedDropTarget?.id === contact.id && uncategorizedDropTarget.position === "before" && (
                    <div className="absolute -top-[2px] left-0 right-0 h-1 bg-blue-500/70 rounded-full z-20" />
                  )}
                  {uncategorizedDropTarget?.id === contact.id && uncategorizedDropTarget.position === "after" && (
                    <div className="absolute -bottom-[2px] left-0 right-0 h-1 bg-blue-500/70 rounded-full z-20" />
                  )}
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
                    scanAnimationActive={scanAnimationActive}
                    scanAnimationDelay={40 + index * 80}
                    isJustMoved={justMovedContactId === contact.id}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ADD CONTACT MODAL */}
          {showAddContact && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onMouseDown={() => closeAllMenus()}>
              <form
                onSubmit={e => {
                  e.preventDefault()
                  handleAddContact()
                }}
                className="bg-white text-black rounded-lg p-6 w-96 border border-zinc-300"
                onMouseDown={e => e.stopPropagation()}
              >
                <h3 className="font-semibold mb-4">Add New Contact</h3>
                <input
                  type="text"
                  placeholder="Name"
                  value={newContactName}
                  onChange={e => setNewContactName(e.target.value)}
                  className="w-full border border-zinc-300 rounded px-3 py-2 mb-3 bg-white text-black placeholder:text-zinc-500"
                  onFocus={closeAllMenus}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newContactEmail}
                  onChange={e => setNewContactEmail(e.target.value)}
                  className="w-full border border-zinc-300 rounded px-3 py-2 mb-4 bg-white text-black placeholder:text-zinc-500"
                  onFocus={closeAllMenus}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddContact(false)}
                    className="px-4 py-2 border border-zinc-300 rounded hover:bg-zinc-100 text-black"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 bg-black text-white rounded">
                    Add
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ADD CATEGORY MODAL */}
          {showAddCategory && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onMouseDown={() => closeAllMenus()}>
              <form
                onSubmit={e => {
                  e.preventDefault()
                  handleAddCategory()
                }}
                className="bg-white text-black rounded-lg p-6 w-96 border border-zinc-300"
                onMouseDown={e => e.stopPropagation()}
              >
                <h3 className="font-semibold mb-4">Add New Category</h3>
                <input
                  type="text"
                  placeholder="Category name"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  className="w-full border border-zinc-300 rounded px-3 py-2 mb-4 bg-white text-black placeholder:text-zinc-500"
                  onFocus={closeAllMenus}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCategory(false)}
                    className="px-4 py-2 border border-zinc-300 rounded hover:bg-zinc-100 text-black"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 bg-black text-white rounded">
                    Add
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onMouseDown={() => setShowSettingsModal(false)}>
          <div className="bg-white dark:bg-zinc-950 rounded-lg p-6 w-[420px] border border-zinc-200 dark:border-zinc-800" onMouseDown={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Settings</h3>

            <div className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium">Dark Mode</div>
                <div className="text-xs text-zinc-500">Toggle light/dark UI</div>
              </div>
              <button
                onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
                className="px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
              >
                {theme === "dark" ? "On" : "Off"}
              </button>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onMouseDown={() => setShowUploadPreview(false)}>
          <div className="bg-white dark:bg-zinc-950 rounded-lg p-6 w-[640px] border border-zinc-200 dark:border-zinc-800" onMouseDown={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">File Upload Preview</h3>
            <div className="text-xs text-zinc-500 mb-4">
              Expected: column A = Name, column B = Email (Google Sheets export works).
            </div>

            {importErrors.length > 0 && (
              <div className="mb-3 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3">
                <div className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Some rows have issues:</div>
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
              <button onClick={handleImportConfirm} className="px-4 py-2 bg-black text-white rounded dark:bg-white dark:text-black">
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL DRAFT SOURCE */}
      <ManualDraftSource
  isDeletingMode={isDeletingMode}
  setManualDrafts={setManualDrafts}
  onDraftCreated={handleDraftCreated}
  isPulsing={stackPulse}
  isDragging={isDraggingDraft}
  setIsDragging={setIsDraggingDraft}
      />
    </div>
  )
}

/* ================= MANUAL DRAFT SOURCE ================= */

function ManualDraftSource({
  isDeletingMode,
  setManualDrafts,
  onDraftCreated,
  isPulsing,
  isDragging,
  setIsDragging
}: {
  isDeletingMode: boolean
  setManualDrafts: React.Dispatch<React.SetStateAction<ManualDraft[]>>
  onDraftCreated: (draft: ManualDraft) => void
  isPulsing: boolean
  isDragging: boolean
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const [note, setNote] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-30">
      <div
        className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg w-[220px] p-3 transition-transform ${isPulsing ? "animate-pulse" : ""}`}
        draggable={!isDeletingMode}
        onDragStart={e => {
          if (isDeletingMode) return
          setIsDragging(true)
          e.dataTransfer.setData("manualDraft", generateId())
        }}
        onDragEnd={() => setIsDragging(false)}
      >
        <div className="text-xs text-zinc-500 mb-2">Manual Draft</div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          className="w-full border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-[11px] bg-transparent text-zinc-900 dark:text-zinc-100"
          rows={2}
          placeholder="Note…"
        />
        <button
          onClick={() => {
            if (!note.trim()) return
            const draft = { id: generateId(), sentAt: new Date().toISOString(), note: note.trim() }
            setManualDrafts(prev => [...prev, draft])
            onDraftCreated(draft)
            setNote("")
          }}
          className="mt-2 w-full bg-black text-white text-xs rounded py-1"
        >
          Add Draft
        </button>
      </div>

      <button
        onClick={() => setIsOpen(v => !v)}
        className="mt-2 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        {isOpen ? "Hide" : "Show"} Drafts
      </button>
    </div>
  )
}
