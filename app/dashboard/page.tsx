"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"

/* ================= TYPES ================= */

type Attachment = { id: string; filename: string }

type SentMail = {
  id: string
  // Einige Imports liefern manchmal kein gültiges Datum – deshalb optional & safe handling überall
  sentAt?: string
  attachments: Attachment[]
  note?: string
  source?: "gmail" | "manual"
  // Gmail Labels / "Tags" (z.B. UNREAD, SINGLE_CHECK, DOUBLE_CHECK ...)
  gmailLabels?: string[]
  // optional convenience flag (falls du UNREAD/READ direkt mappst)
  isUnread?: boolean
}

type Contact = {
  id: string
  name: string
  email: string
  categoryId: string
  sentMails: SentMail[]
}

type Category = {
  id: string
  name: string
}

type ImportRow = { name: string; email: string }

type ManualDraft = {
  id: string
  sentAt: string
  attachments: Attachment[]
  note?: string
  contactId?: string
}

/* ================= MOCK DATA ================= */

const MOCK_CATEGORIES: Category[] = [
  { id: "cat_1", name: "Clients" },
  { id: "cat_2", name: "Collaborators" },
  { id: "cat_3", name: "Leads" }
]

const MOCK_CONTACTS: Contact[] = [
  {
    id: "c_1",
    name: "DJ Hyper",
    email: "hyper@beats.com",
    categoryId: "cat_1",
    sentMails: [
      {
        id: "m_1",
        sentAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        attachments: [
          { id: "a1", filename: "beat_140bpm.wav" },
          { id: "a2", filename: "beat_alt.wav" }
        ],
        source: "gmail",
        gmailLabels: ["DOUBLE_CHECK"]
      }
    ]
  },
  {
    id: "c_2",
    name: "Label A&R",
    email: "aandr@label.com",
    categoryId: "cat_2",
    sentMails: []
  },
  {
    id: "c_3",
    name: "Producer Friend",
    email: "producer.friend.with.a.very.very.long.email.address@example-super-long-domainname.com",
    categoryId: "cat_1",
    sentMails: []
  }
]

const MOCK_DRAFTS: ManualDraft[] = [
  {
    id: "d_1",
    sentAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    attachments: [{ id: "da1", filename: "new_beat_preview.wav" }],
    note: "",
    contactId: undefined
  }
]

/* ================= HELPERS ================= */

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function safeDateMs(dateIso?: string) {
  if (!dateIso) return undefined
  const ms = new Date(dateIso).getTime()
  return Number.isFinite(ms) ? ms : undefined
}

function daysSince(dateIso?: string) {
  const ms = safeDateMs(dateIso)
  if (ms === undefined) return undefined
  const days = (Date.now() - ms) / (1000 * 60 * 60 * 24)
  return Number.isFinite(days) ? days : undefined
}

function getStatusColor(lastSentAt?: string, priorityAfterDays: number = 30) {
  const days = lastSentAt ? daysSince(lastSentAt) : undefined
  if (days === undefined) return "bg-zinc-300 dark:bg-zinc-700"
  if (days >= priorityAfterDays) return "bg-red-500"
  if (days >= priorityAfterDays / 2) return "bg-amber-400"
  return "bg-green-500"
}

function getStatusTint(lastSentAt?: string, priorityAfterDays: number = 30) {
  const days = lastSentAt ? daysSince(lastSentAt) : undefined
  if (days === undefined) return "bg-zinc-50 dark:bg-zinc-900/40"
  if (days >= priorityAfterDays) return "bg-red-50 dark:bg-red-950/20"
  if (days >= priorityAfterDays / 2) return "bg-amber-50 dark:bg-amber-950/20"
  return "bg-green-50 dark:bg-green-950/20"
}

function normalizeLabels(labels?: string[]) {
  return (labels ?? [])
    .map(l => String(l).trim().toLowerCase())
    .filter(Boolean)
}

function getMailCardTheme(mail: SentMail) {
  const labels = normalizeLabels(mail.gmailLabels)

  const unread = mail.isUnread ?? labels.includes("unread")

  // Unterstützt ein paar unterschiedliche Namensvarianten, damit du nur die Label-Mapping-Tabelle anpassen musst
  const doubleCheck = labels.some(l =>
    l === "double_check" ||
    l === "double-check" ||
    l === "doublecheck" ||
    l === "doppel" ||
    l.includes("double")
  )
  const singleCheck = labels.some(l =>
    l === "single_check" ||
    l === "single-check" ||
    l === "singlecheck" ||
    l === "einzel" ||
    l.includes("single")
  )

  // Precedence: UNREAD > DOUBLE > SINGLE > default
  if (unread) {
    return {
      card: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900",
      dot: "bg-blue-600",
      label: "Unread"
    }
  }
  if (doubleCheck) {
    return {
      card: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/25 dark:border-emerald-900",
      dot: "bg-emerald-600",
      label: "✓✓"
    }
  }
  if (singleCheck) {
    return {
      card: "bg-amber-50 border-amber-200 dark:bg-amber-950/25 dark:border-amber-900",
      dot: "bg-amber-600",
      label: "✓"
    }
  }

  return {
    card: "bg-white border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800",
    dot: "bg-zinc-300 dark:bg-zinc-700",
    label: ""
  }
}

function formatDate(dateIso?: string) {
  const ms = safeDateMs(dateIso)
  if (ms === undefined) return "—"
  return new Date(ms).toLocaleDateString()
}

/* ================= ICONS ================= */

function NoteIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16h8M8 12h8m-2 8H6a2 2 0 01-2-2V6a2 2 0 012-2h8l6 6v8a2 2 0 01-2 2z"
      />
    </svg>
  )
}

function AddIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

function UploadIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12"
      />
    </svg>
  )
}

function DownloadIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
      />
    </svg>
  )
}

function ScanIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7V5a2 2 0 012-2h2M3 17v2a2 2 0 002 2h2M19 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 12h10"
      />
    </svg>
  )
}

/* ================= COMPONENTS ================= */

function HoverMarquee({
  text,
  className
}: {
  text: string
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [overflow, setOverflow] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    const textEl = textRef.current
    if (!container || !textEl) return

    const measure = () => {
      const cW = container.clientWidth
      const tW = textEl.scrollWidth
      setOverflow(tW > cW + 2)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    ro.observe(textEl)
    return () => ro.disconnect()
  }, [text])

  return (
    <div
      ref={containerRef}
      className={["marquee-wrap overflow-hidden whitespace-nowrap", className ?? ""].join(" ")}
    >
      <div className={overflow ? "marquee-inner inline-flex items-center gap-8" : "inline-flex items-center gap-8"}>
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

function SentMailCard({
  mail,
  contactId,
  mailKey,
  isJustPlaced,
  scanDelayMs,
  onScanAppearDone,
  onChangeNote,
  isDeleting,
  onDeleteMail
}: {
  mail: SentMail
  contactId: string
  mailKey: string
  isJustPlaced?: boolean
  scanDelayMs?: number
  onScanAppearDone?: (mailKey: string) => void
  onChangeNote: (note: string) => void
  isDeleting?: boolean
  onDeleteMail?: () => void
}) {
  const [open, setOpen] = useState(false)
  const theme = getMailCardTheme(mail)

  return (
    <div
      draggable={!isDeleting}
      onDragStart={e => {
        if (isDeleting) return
        e.dataTransfer.setData(
          "sentMail",
          JSON.stringify({ fromContactId: contactId, mailId: mail.id })
        )
        e.dataTransfer.effectAllowed = "move"
      }}
      className={[
        "min-w-[160px] rounded border px-2 py-2 text-[11px] relative group shadow-sm",
        theme.card,
        !isDeleting ? "cursor-grab active:cursor-grabbing" : "",
        scanDelayMs !== undefined ? "animate-scanPop" : "",
        isJustPlaced ? "animate-dropIn" : ""
      ].join(" ")}
      style={scanDelayMs !== undefined ? { animationDelay: `${scanDelayMs}ms` } : undefined}
      onAnimationEnd={() => {
        if (scanDelayMs !== undefined) onScanAppearDone?.(mailKey)
      }}
    >
      {/* LÖSCH-KREUZ (nur im Lösch-Modus) */}
      {isDeleting && onDeleteMail && (
        <button
          onClick={onDeleteMail}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] z-10 hover:bg-red-600 text-white"
          title="Delete this mail"
        >
          ✕
        </button>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={["h-2 w-2 rounded-full flex-shrink-0", theme.dot].join(" ")} />
          <div className="text-[10px] text-zinc-600 dark:text-zinc-300">{formatDate(mail.sentAt)}</div>
        </div>

        <div className="flex items-center gap-2">
          {theme.label && (
            <div className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-200">{theme.label}</div>
          )}

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
      </div>

      <ul className="mt-1">
        {mail.attachments.map(att => (
          <li key={att.id} className="truncate text-zinc-900 dark:text-zinc-100">
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
      className={`min-w-[160px] rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2 text-[11px] relative shadow-sm transition-transform ${
        isJustPlaced ? "animate-dropIn" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] text-zinc-500">{formatDate(draft.sentAt)}</div>

        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          title="Add note"
          disabled={isDeleting}
        >
          <NoteIcon className="w-4 h-4" />
        </button>
      </div>

      <ul className="mt-1">
        {draft.attachments.map(att => (
          <li key={att.id} className="truncate">
            {att.filename}
          </li>
        ))}
      </ul>

      {open && (
        <div className="mt-2 border-t border-zinc-200 dark:border-zinc-800 pt-2">
          <textarea
            placeholder="Add note…"
            value={draft.note ?? ""}
            onChange={e =>
              setManualDrafts(prev =>
                prev.map(d => (d.id === draft.id ? { ...d, note: e.target.value } : d))
              )
            }
            className="w-full resize-none border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-[11px] bg-transparent focus:outline-none"
            rows={3}
            disabled={isDeleting}
          />
        </div>
      )}

      {!open && draft.note && <div className="mt-2 text-[10px] text-zinc-500 italic truncate">{draft.note}</div>}
    </div>
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
  onMoveMail,
  justPlacedMailKey,
  scanAppearDelays,
  onScanAppearDone
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
  onMoveMail?: (fromContactId: string, mailId: string, toContactId: string, insertIndex: number) => void
  justPlacedMailKey?: string | null
  scanAppearDelays: Record<string, number>
  onScanAppearDone: (mailKey: string) => void
}) {
  // Reihenfolge bleibt jetzt so wie im State gespeichert (damit Drag-Reorder funktioniert)
  const mails = contact.sentMails ?? []

  const lastSentIso = useMemo(() => {
    const ms = mails.map(m => safeDateMs(m.sentAt)).filter((v): v is number => typeof v === "number")
    if (ms.length === 0) return undefined
    const max = Math.max(...ms)
    return new Date(max).toISOString()
  }, [mails])

  const draftsForContact = useMemo(() => manualDrafts.filter(d => d.contactId === contact.id), [manualDrafts, contact.id])

  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [tempName, setTempName] = useState(contact.name)
  const [tempEmail, setTempEmail] = useState(contact.email)

  const scrollerRef = useRef<HTMLDivElement>(null)

  const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null)

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
  }, [contact.id, mails.length, draftsForContact.length])

  const handleDropMailAt = (insertIndex: number, e: React.DragEvent) => {
    if (isDeleting) return
    const payload = e.dataTransfer.getData("sentMail")
    if (!payload) return
    try {
      const parsed = JSON.parse(payload) as { fromContactId: string; mailId: string }
      onMoveMail?.(parsed.fromContactId, parsed.mailId, contact.id, insertIndex)
    } catch {}
  }

  return (
    <div
      className={[
        "grid grid-cols-[260px_1fr] border-b border-zinc-200 dark:border-zinc-800",
        getStatusTint(lastSentIso, priorityAfterDays),
        "hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40"
      ].join(" ")}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        if (isDeleting) return

        // 1) Mail reorder / move fallback (wenn man nicht exakt auf einen Drop-Zwischenraum droppt)
        const payload = e.dataTransfer.getData("sentMail")
        if (payload) {
          handleDropMailAt(mails.length, e)
          setActiveInsertIndex(null)
          return
        }

        // 2) Manual Draft drop
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
          className={`px-3 flex items-center cursor-move text-zinc-400 hover:text-zinc-600 ${isDeleting ? "opacity-50 cursor-not-allowed" : ""}`}
          title="Drag to move contact"
        >
          ⋮⋮
        </div>

        {/* NAME + EMAIL */}
        <div className="flex-1 py-2 pr-2 min-w-0">
          {/* NAME */}
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
                className="text-sm font-semibold bg-transparent focus:outline-none flex-1 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 min-w-0"
                autoFocus
              />
              <button onClick={handleNameSave} className="text-xs text-blue-500 hover:text-blue-700 px-2">
                ✓
              </button>
            </div>
          ) : (
            <div
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-900 px-2 py-1 rounded cursor-text truncate"
              onClick={() => !isDeleting && setIsEditingName(true)}
              title="Click to edit contact name"
            >
              {contact.name}
            </div>
          )}

          {/* EMAIL */}
          {isEditingEmail ? (
            <div className="flex items-center gap-2 mt-1">
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
                className="text-[11px] bg-transparent focus:outline-none flex-1 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 min-w-0"
                autoFocus
              />
              <button onClick={handleEmailSave} className="text-xs text-blue-500 hover:text-blue-700 px-2">
                ✓
              </button>
            </div>
          ) : (
            <div
              className="mt-1 px-2 py-1 rounded cursor-text hover:bg-zinc-100 dark:hover:bg-zinc-900 marquee-wrap group"
              onClick={() => !isDeleting && setIsEditingEmail(true)}
              title="Click to edit email"
            >
              <HoverMarquee text={contact.email} className="text-[11px] text-zinc-600 dark:text-zinc-400" />
            </div>
          )}
        </div>

        {/* PRIORITY COLOR BAR */}
        <div className={`w-1 ${getStatusColor(lastSentIso, priorityAfterDays)}`} />
      </div>

      {/* RIGHT */}
      <div className="py-2 px-3 overflow-hidden">
        <div ref={scrollerRef} className="flex items-start gap-2 overflow-x-auto pb-1">
          {/* DROPZONE vor erstem Mail */}
          <div
            onDragOver={e => {
              if (isDeleting) return
              if (!e.dataTransfer.getData("sentMail")) return
              e.preventDefault()
              setActiveInsertIndex(0)
            }}
            onDrop={e => {
              e.preventDefault()
              e.stopPropagation()
              handleDropMailAt(0, e)
              setActiveInsertIndex(null)
            }}
            className="flex items-stretch"
          >
            <div
              className={[
                "w-1 h-14 rounded transition-all duration-150",
                activeInsertIndex === 0 ? "bg-blue-500" : "bg-transparent"
              ].join(" ")}
            />
          </div>

          {mails.map((mail, idx) => {
            const key = `${contact.id}::${mail.id}`
            return (
              <React.Fragment key={mail.id}>
                <SentMailCard
                  mail={mail}
                  contactId={contact.id}
                  mailKey={key}
                  scanDelayMs={scanAppearDelays[key]}
                  onScanAppearDone={onScanAppearDone}
                  onChangeNote={note => onUpdateMailNote(contact.id, mail.id, note)}
                  isDeleting={isDeleting}
                  onDeleteMail={onDeleteMail ? () => onDeleteMail(contact.id, mail.id) : undefined}
                  isJustPlaced={justPlacedMailKey === key}
                />

                {/* DROPZONE nach diesem Mail */}
                <div
                  onDragOver={e => {
                    if (isDeleting) return
                    if (!e.dataTransfer.getData("sentMail")) return
                    e.preventDefault()
                    setActiveInsertIndex(idx + 1)
                  }}
                  onDrop={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDropMailAt(idx + 1, e)
                    setActiveInsertIndex(null)
                  }}
                  className="flex items-stretch"
                >
                  <div
                    className={[
                      "w-1 h-14 rounded transition-all duration-150",
                      activeInsertIndex === idx + 1 ? "bg-blue-500" : "bg-transparent"
                    ].join(" ")}
                  />
                </div>
              </React.Fragment>
            )
          })}

          {/* Manual drafts for this contact (unchanged) */}
          {draftsForContact.map(draft => (
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

/* ================= KATEGORIE KOMPONENT ================= */

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
  onMoveMail,
  justPlacedMailKey,
  scanAppearDelays,
  onScanAppearDone
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
  onUpdateContactName?: (contactId: string, name: string) => void
  onUpdateContactEmail?: (contactId: string, email: string) => void
  onDeleteContact?: (contactId: string) => void
  onDeleteMail?: (contactId: string, mailId: string) => void
  onDragContactToCategory: (contactId: string, categoryId: string) => void
  onManualDraftPlaced?: (draftId: string) => void
  justPlacedDraftId?: string | null
  onMoveMail: (fromContactId: string, mailId: string, toContactId: string, insertIndex: number) => void
  justPlacedMailKey?: string | null
  scanAppearDelays: Record<string, number>
  onScanAppearDone: (mailKey: string) => void
}) {
  const [isEditingCategory, setIsEditingCategory] = useState(false)
  const [tempCategoryName, setTempCategoryName] = useState(category.name)

  useEffect(() => {
    setTempCategoryName(category.name)
  }, [category.name])

  const handleCategorySave = () => {
    const trimmed = tempCategoryName.trim()
    if (trimmed && trimmed !== category.name) {
      onUpdateCategoryName(category.id, trimmed)
    }
    setIsEditingCategory(false)
  }

  const filteredContacts = useMemo(() => {
    const list = contacts.filter(c => c.categoryId === category.id)
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
  }, [contacts, category.id, search])

  const categoryItemId = `category_${category.id}`

  return (
    <div
      className="border border-zinc-200 dark:border-zinc-800 rounded overflow-hidden"
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        const contactId = e.dataTransfer.getData("contact")
        if (contactId) onDragContactToCategory(contactId, category.id)
      }}
    >
      {/* CATEGORY HEADER */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          {isDeletingMode && (
            <input
              type="checkbox"
              checked={selectedItems.includes(categoryItemId)}
              onChange={() => onToggleSelection(categoryItemId)}
              className="w-4 h-4"
            />
          )}

          {isEditingCategory ? (
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
              className="font-semibold bg-transparent border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          ) : (
            <div
              className="font-semibold text-zinc-900 dark:text-zinc-50 cursor-text"
              onClick={() => !isDeletingMode && setIsEditingCategory(true)}
              title="Click to edit category name"
            >
              {category.name}
            </div>
          )}
        </div>

        <div className="text-xs text-zinc-500">{filteredContacts.length} contacts</div>
      </div>

      {/* TABLE HEADER */}
      <div className="grid grid-cols-[260px_1fr] text-xs font-medium text-zinc-500 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div>Contact</div>
        <div>Sent / Drafts</div>
      </div>

      {/* CONTACT ROWS */}
      {filteredContacts.map(contact => {
        const contactItemId = `contact_${contact.id}`
        return (
          <div key={contact.id} className="relative">
            {isDeletingMode && (
              <div className="absolute left-4 top-3 z-20">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(contactItemId)}
                  onChange={() => onToggleSelection(contactItemId)}
                  className="w-4 h-4"
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
              onMoveMail={onMoveMail}
              justPlacedMailKey={justPlacedMailKey}
              scanAppearDelays={scanAppearDelays}
              onScanAppearDone={onScanAppearDone}
            />
          </div>
        )
      })}
    </div>
  )
}

/* ================= SEARCH BAR ================= */

function ExpandingSearchBar({
  value,
  setValue
}: {
  value: string
  setValue: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(v => !v)}
          className="w-10 h-10 rounded-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
          title="Search"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 103.5 10.5a7.5 7.5 0 0013.15 6.15z"
            />
          </svg>
        </button>

        {open && (
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Search contacts…"
            className="w-64 px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        )}
      </div>
    </div>
  )
}

/* ================= MANUAL DRAFT SOURCE ================= */

function ManualDraftSource({
  manualDrafts,
  isDraggingDraft,
  setIsDraggingDraft,
  isDeleting
}: {
  manualDrafts: ManualDraft[]
  isDraggingDraft: boolean
  setIsDraggingDraft: (v: boolean) => void
  isDeleting?: boolean
}) {
  const unassigned = manualDrafts.filter(d => !d.contactId)

  return (
    <div className="sticky bottom-0 z-30 border-t border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-50">Manual Drafts</div>
        <div className="text-xs text-zinc-500">{unassigned.length} available</div>
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {unassigned.map(d => (
          <div
            key={d.id}
            draggable={!isDeleting}
            onDragStart={e => {
              if (isDeleting) return
              e.dataTransfer.setData("manualDraft", d.id)
              setIsDraggingDraft(true)
            }}
            onDragEnd={() => setIsDraggingDraft(false)}
            className={`min-w-[180px] rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs shadow-sm ${
              isDeleting ? "opacity-60 cursor-not-allowed" : "cursor-grab active:cursor-grabbing"
            } ${isDraggingDraft ? "animate-wobble" : ""}`}
            title="Drag me onto a contact row"
          >
            <div className="text-[10px] text-zinc-500">{formatDate(d.sentAt)}</div>
            <div className="mt-1 font-medium truncate">{d.attachments[0]?.filename ?? "Draft"}</div>
            <div className="mt-1 text-zinc-500 truncate">{d.note || "No note"}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ================= MAIN PAGE ================= */

export default function DashboardPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [manualDrafts, setManualDrafts] = useState<ManualDraft[]>([])
  const [search, setSearch] = useState("")
  const [priorityAfterDays, setPriorityAfterDays] = useState(30)

  // Load mock data once
  useEffect(() => {
    setCategories(MOCK_CATEGORIES)
    setContacts(MOCK_CONTACTS)
    setManualDrafts(MOCK_DRAFTS)
  }, [])

  // MENU STATES
  const [showDataMenu, setShowDataMenu] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  // MODAL STATES
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  // DELETE MODE
  const [isDeletingMode, setIsDeletingMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  // IMPORT/EXPORT
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importCategoryId, setImportCategoryId] = useState<string>("cat_1")

  // SCAN
  const [scanning, setScanning] = useState(false)

  // Drag animation states
  const [justPlacedDraftId, setJustPlacedDraftId] = useState<string | null>(null)
  const [stackPulse, setStackPulse] = useState(false)
  const [isDraggingDraft, setIsDraggingDraft] = useState(false)

  // Mail animation / drag states
  const [justPlacedMailKey, setJustPlacedMailKey] = useState<string | null>(null)
  const [scanAppearDelays, setScanAppearDelays] = useState<Record<string, number>>({})
  const [scanToast, setScanToast] = useState<string | null>(null)

  // ADD CONTACT
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContactName, setNewContactName] = useState("")
  const [newContactEmail, setNewContactEmail] = useState("")

  // ADD CATEGORY
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")

  // REFS FOR MENU CLOSE
  const dataMenuRef = useRef<HTMLDivElement>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (dataMenuRef.current && !dataMenuRef.current.contains(t)) setShowDataMenu(false)
      if (addMenuRef.current && !addMenuRef.current.contains(t)) setShowAddMenu(false)
      if (userMenuRef.current && !userMenuRef.current.contains(t)) setShowUserMenu(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const closeAllMenus = () => {
    setShowDataMenu(false)
    setShowAddMenu(false)
    setShowUserMenu(false)
  }

  /* ================= HANDLERS ================= */

  // EXPORT ALL to CSV
  const handleExport = () => {
    const headers = ["category", "name", "email"]
    const rows = contacts.map(c => {
      const cat = categories.find(x => x.id === c.categoryId)?.name ?? "Uncategorized"
      return [cat, c.name, c.email]
    })
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "contacts_export.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  // TRIGGER FILE PICKER
  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  // PARSE CSV
  const parseCSV = async (file: File) => {
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(Boolean)
    const out: ImportRow[] = []
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(",").map(s => s.trim())
      if (parts.length >= 2) out.push({ name: parts[0], email: parts[1] })
    }
    return out
  }

  // FILE SELECTED
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const rows = await parseCSV(file)
      setImportRows(rows)
      setShowImportModal(true)
      closeAllMenus()
    } catch (err) {
      alert("Import failed: " + err)
    } finally {
      e.target.value = ""
    }
  }

  // CONFIRM IMPORT
  const handleConfirmImport = () => {
    const newContacts: Contact[] = importRows.map(r => ({
      id: generateId(),
      name: r.name,
      email: r.email,
      categoryId: importCategoryId,
      sentMails: []
    }))
    setContacts(prev => [...prev, ...newContacts])
    setShowImportModal(false)
    setImportRows([])
  }

  // SCAN FUNCTION
  const handleScanMails = async () => {
    setScanning(true)
    closeAllMenus()

    try {
      // kleine Fake-Latenz – hier würdest du später deine echte Gmail-API Call einhängen
      await new Promise(resolve => setTimeout(resolve, 900))

      // Demo: wir hängen 3 neue "gescannte" Mails an zufällige Kontakte
      const nextContacts: Contact[] = contacts.map(c => ({
        ...c,
        sentMails: [...c.sentMails]
      }))

      if (nextContacts.length === 0) {
        setScanToast("No contacts available.")
        window.setTimeout(() => setScanToast(null), 2200)
        return
      }

      const newKeys: Array<{ key: string; delay: number }> = []
      const now = Date.now()

      for (let i = 0; i < 3; i++) {
        const target = nextContacts[(i + Math.floor(Math.random() * nextContacts.length)) % nextContacts.length]
        const mailId = generateId()

        const isUnread = i === 0 // erste Mail als UNREAD – nur Demo
        const labels = isUnread ? ["UNREAD"] : i === 1 ? ["DOUBLE_CHECK"] : ["SINGLE_CHECK"]

        const newMail: SentMail = {
          id: mailId,
          sentAt: new Date(now - i * 1000 * 60 * 5).toISOString(),
          attachments: [
            { id: generateId(), filename: `scan_${i + 1}_attachment.wav` }
          ],
          source: "gmail",
          gmailLabels: labels,
          isUnread
        }

        target.sentMails.push(newMail)

        const key = `${target.id}::${mailId}`
        newKeys.push({ key, delay: i * 120 })
      }

      setContacts(nextContacts)
      setScanAppearDelays(prev => {
        const next = { ...prev }
        newKeys.forEach(k => {
          next[k.key] = k.delay
        })
        return next
      })

      setScanToast(`Scan complete! Found ${newKeys.length} new emails.`)
      window.setTimeout(() => setScanToast(null), 2600)
    } catch (error) {
      setScanToast("Scanning failed.")
      window.setTimeout(() => setScanToast(null), 2600)
    } finally {
      setScanning(false)
    }
  }

  // Funktion zum Aktualisieren von Mail-Notizen
  const updateMailNote = (contactId: string, mailId: string, note: string) => {
    setContacts(prev =>
      prev.map(c =>
        c.id === contactId
          ? { ...c, sentMails: c.sentMails.map(m => (m.id === mailId ? { ...m, note } : m)) }
          : c
      )
    )
  }

  // Kategorie Name ändern
  const updateCategoryName = (categoryId: string, name: string) => {
    setCategories(prev => prev.map(c => (c.id === categoryId ? { ...c, name } : c)))
  }

  // Kontakt Name ändern
  const updateContactName = (contactId: string, name: string) => {
    setContacts(prev => prev.map(c => (c.id === contactId ? { ...c, name } : c)))
  }

  // Kontakt Email ändern
  const updateContactEmail = (contactId: string, email: string) => {
    setContacts(prev => prev.map(c => (c.id === contactId ? { ...c, email } : c)))
  }

  // Kontakt in Kategorie verschieben via drag
  const handleDragContactToCategory = (contactId: string, categoryId: string) => {
    setContacts(prev => prev.map(c => (c.id === contactId ? { ...c, categoryId } : c)))
  }

  // Kontakt in Uncategorized
  const handleDragContactToUncategorized = (contactId: string) => {
    setContacts(prev => prev.map(c => (c.id === contactId ? { ...c, categoryId: "uncategorized" } : c)))
  }

  // Funktion zum Löschen eines Kontakts
  const handleDeleteContact = (contactId: string) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      setContacts(prev => prev.filter(c => c.id !== contactId))
    }
  }

  // Funktion zum Löschen einer Mail
  const deleteMail = (contactId: string, mailId: string) => {
    if (confirm("Are you sure you want to delete this mail?")) {
      setContacts(prev =>
        prev.map(contact => {
          if (contact.id === contactId) {
            return { ...contact, sentMails: contact.sentMails.filter(m => m.id !== mailId) }
          }
          return contact
        })
      )
    }
  }

  // Mails per Drag & Drop innerhalb/zwischen Kontakten verschieben
  const moveMail = (fromContactId: string, mailId: string, toContactId: string, insertIndex: number) => {
    setContacts(prev => {
      let moving: SentMail | null = null

      const removed = prev.map(c => {
        if (c.id !== fromContactId) return c
        const idx = c.sentMails.findIndex(m => m.id === mailId)
        if (idx === -1) return c
        moving = c.sentMails[idx]
        return { ...c, sentMails: c.sentMails.filter(m => m.id !== mailId) }
      })

      if (!moving) return prev

      return removed.map(c => {
        if (c.id !== toContactId) return c
        const nextMails = [...c.sentMails]
        const safeIndex = Math.max(0, Math.min(insertIndex, nextMails.length))
        nextMails.splice(safeIndex, 0, moving as SentMail)
        return { ...c, sentMails: nextMails }
      })
    })

    const key = `${toContactId}::${mailId}`
    setJustPlacedMailKey(key)
    window.setTimeout(() => setJustPlacedMailKey(null), 650)
  }

  const handleScanAppearDone = (mailKey: string) => {
    setScanAppearDelays(prev => {
      if (!(mailKey in prev)) return prev
      const next = { ...prev }
      delete next[mailKey]
      return next
    })
  }

  // Funktion zum Hinzufügen eines Kontakts
  const handleAddContact = () => {
    const name = newContactName.trim()
    const email = newContactEmail.trim()
    if (!name || !email) return

    const newContact: Contact = {
      id: generateId(),
      name,
      email,
      categoryId: categories[0]?.id ?? "uncategorized",
      sentMails: []
    }

    setContacts(prev => [...prev, newContact])
    setNewContactName("")
    setNewContactEmail("")
    setShowAddContact(false)
    closeAllMenus()
  }

  // Funktion zum Hinzufügen einer Kategorie
  const handleAddCategory = () => {
    const name = newCategoryName.trim()
    if (!name) return

    const newCat: Category = {
      id: generateId(),
      name
    }
    setCategories(prev => [...prev, newCat])
    setNewCategoryName("")
    setShowAddCategory(false)
    closeAllMenus()
  }

  // Manual draft dropped: animate
  const handleManualDraftPlaced = (draftId: string) => {
    setJustPlacedDraftId(draftId)
    window.setTimeout(() => setJustPlacedDraftId(null), 650)
    setStackPulse(true)
    window.setTimeout(() => setStackPulse(false), 300)
  }

  // SETTINGS: change priorityAfterDays
  const handleSaveSettings = (value: number) => {
    setPriorityAfterDays(value)
    setShowSettingsModal(false)
  }

  // Dummy: change account
  const handleChangeAccount = () => {
    alert("Change Account clicked (placeholder)")
  }

  const handleLogout = () => {
    alert("Logout clicked (placeholder)")
  }

  const handleSettings = () => {
    setShowSettingsModal(true)
    closeAllMenus()
  }

  // Delete mode toggle (trash button)
  const handleDeleteModeToggle = () => {
    setIsDeletingMode(v => !v)
    setSelectedItems([])
    closeAllMenus()
  }

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => (prev.includes(itemId) ? prev.filter(x => x !== itemId) : [...prev, itemId]))
  }

  // Alle auswählbaren Items (für Select all / Delete all)
  const allSelectableIds = useMemo(() => {
    const ids: string[] = []
    categories.forEach(c => ids.push(`category_${c.id}`))
    contacts.forEach(c => ids.push(`contact_${c.id}`))
    return ids
  }, [categories, contacts])

  // Alle ausgewählten Items löschen (nur EINE Bestätigung)
  const deleteItems = (itemsToDelete: string[]) => {
    if (itemsToDelete.length === 0) return

    const contactIds = itemsToDelete.filter(id => id.startsWith("contact_"))
    const categoryIds = itemsToDelete.filter(id => id.startsWith("category_"))

    const catCount = categoryIds.length
    const conCount = contactIds.length

    const confirmMessage =
      `Are you sure you want to delete ${catCount} categor${catCount === 1 ? "y" : "ies"} and ${conCount} contact${conCount === 1 ? "" : "s"}?`

    if (!confirm(confirmMessage)) return

    const actualContactIds = contactIds.map(id => id.replace("contact_", ""))
    const actualCategoryIds = categoryIds.map(id => id.replace("category_", ""))

    // Kontakte löschen
    setContacts(prev => prev.filter(c => !actualContactIds.includes(c.id)))

    // Kategorien löschen + Kontakte in "Uncategorized" verschieben
    setCategories(prev => prev.filter(c => !actualCategoryIds.includes(c.id)))
    setContacts(prev =>
      prev.map(c =>
        actualCategoryIds.includes(c.categoryId) ? { ...c, categoryId: "uncategorized" } : c
      )
    )

    setSelectedItems([])
    setIsDeletingMode(false)
    closeAllMenus()
  }

  const handleDeleteSelected = () => deleteItems(selectedItems)
  const handleSelectAll = () => setSelectedItems(allSelectableIds)
  const handleClearSelection = () => setSelectedItems([])
  const handleDeleteAll = () => deleteItems(allSelectableIds)

  const hasUncategorizedContacts = useMemo(
    () => contacts.some(c => c.categoryId === "uncategorized"),
    [contacts]
  )

  /* ================= RENDER ================= */

  return (
    <div className="h-screen w-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <style jsx global>{`
        @keyframes wobble {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
          75% { transform: rotate(-2deg); }
          100% { transform: rotate(0deg); }
        }
        .animate-wobble {
          animation: wobble 0.4s ease-in-out infinite;
        }

        @keyframes dropIn {
          0% { transform: translateY(-10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .animate-dropIn {
          animation: dropIn 0.25s ease-out;
        }

        @keyframes scanPop {
          0% { opacity: 0; transform: translateY(10px) scale(0.96); filter: blur(2px); }
          60% { opacity: 1; transform: translateY(-2px) scale(1.02); filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-scanPop { animation: scanPop 0.42s cubic-bezier(0.16, 1, 0.3, 1) both; }

        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-wrap:hover .marquee-inner { animation: marquee 7s linear infinite; }
      `}</style>

      {/* HEADER */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-semibold text-lg">Dashboard</div>
          <ExpandingSearchBar value={search} setValue={setSearch} />
        </div>

        <div className="flex items-center gap-2">
          {/* DATA MENU */}
          <div ref={dataMenuRef} className="relative">
            <button
              onClick={() => {
                setShowDataMenu(v => !v)
                setShowAddMenu(false)
                setShowUserMenu(false)
              }}
              className="w-10 h-10 rounded-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
              title="Data"
              disabled={isDeletingMode}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {showDataMenu && !isDeletingMode && (
              <div className="absolute right-0 mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 min-w-56 overflow-hidden">
                <button
                  onClick={() => {
                    handleExport()
                    closeAllMenus()
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3"
                >
                  <DownloadIcon className="w-5 h-5" />
                  <div>
                    <div className="font-medium">Export CSV</div>
                    <div className="text-xs text-zinc-500">Download all contacts</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    handleImportClick()
                    closeAllMenus()
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3"
                >
                  <UploadIcon className="w-5 h-5" />
                  <div>
                    <div className="font-medium">Import CSV</div>
                    <div className="text-xs text-zinc-500">Upload contacts</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* ADD MENU */}
          <div ref={addMenuRef} className="relative">
            <button
              onClick={() => {
                setShowAddMenu(v => !v)
                setShowDataMenu(false)
                setShowUserMenu(false)
              }}
              className="w-10 h-10 rounded-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
              title="Add"
              disabled={isDeletingMode}
            >
              <AddIcon className="w-5 h-5" />
            </button>

            {showAddMenu && !isDeletingMode && (
              <div className="absolute right-0 mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 min-w-56 overflow-hidden">
                <button
                  onClick={() => {
                    setShowAddContact(true)
                    setShowAddMenu(false)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                >
                  <div className="font-medium">Add Contact</div>
                  <div className="text-xs text-zinc-500">Create a new contact</div>
                </button>

                <button
                  onClick={() => {
                    setShowAddCategory(true)
                    setShowAddMenu(false)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                >
                  <div className="font-medium">Add Category</div>
                  <div className="text-xs text-zinc-500">Create a new category</div>
                </button>
              </div>
            )}
          </div>

          {/* SCAN BUTTON */}
          <button
            onClick={handleScanMails}
            disabled={scanning || isDeletingMode}
            className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors ${
              scanning ? "bg-blue-500 text-white" : "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
            }`}
            title="Scan Gmail"
          >
            <ScanIcon className={`w-5 h-5 ${scanning ? "animate-wobble" : ""}`} />
          </button>

          {/* TRASH BUTTON */}
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
              isDeletingMode ? "bg-red-500 text-white shadow-sm" : "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m-4 0h14"
              />
            </svg>
          </button>

          {isDeletingMode && (
            <div className="flex items-center gap-2 ml-1">
              <button
                onClick={handleSelectAll}
                className="px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                title="Select all categories + contacts"
              >
                Select all
              </button>
              <button
                onClick={handleClearSelection}
                className="px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                title="Clear selection"
              >
                Clear
              </button>
              <button
                onClick={handleDeleteAll}
                className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                title="Delete all categories + contacts"
              >
                Delete all
              </button>
            </div>
          )}

          {/* USER MENU BUTTON */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => {
                setShowUserMenu(v => !v)
                setShowDataMenu(false)
                setShowAddMenu(false)
              }}
              className="w-10 h-10 rounded-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
              title="User"
              disabled={isDeletingMode}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A12 12 0 0112 15c2.5 0 4.847.76 6.879 2.053M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {showUserMenu && !isDeletingMode && (
              <div className="absolute right-0 mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 min-w-56 overflow-hidden">
                <button
                  onClick={handleSettings}
                  className="w-full px-4 py-3 text-left text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 transition-colors"
                >
                  <svg className="w-5 h-5 text-zinc-900 dark:text-zinc-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-1.42 3.42h-.1a1.65 1.65 0 00-1.51 1.14 2 2 0 01-3.9 0 1.65 1.65 0 00-1.51-1.14h-.1a2 2 0 01-1.42-3.42l.06-.06A1.65 1.65 0 004.6 15a2 2 0 010-6 1.65 1.65 0 00-.33-1.82l-.06-.06A2 2 0 015.63 3.7h.1A1.65 1.65 0 007.24 2.56a2 2 0 013.9 0A1.65 1.65 0 0012.65 3.7h.1a2 2 0 011.42 3.42l-.06.06A1.65 1.65 0 0019.4 9a2 2 0 010 6z"
                    />
                  </svg>
                  <div>
                    <div className="font-medium">Settings</div>
                    <div className="text-xs text-zinc-500">Priority rules</div>
                  </div>
                </button>

                <button
                  onClick={handleChangeAccount}
                  className="w-full px-4 py-3 text-left text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 transition-colors"
                >
                  <svg className="w-5 h-5 text-zinc-900 dark:text-zinc-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 17l-4 4m0 0l-4-4m4 4V3" />
                  </svg>
                  <div>
                    <div className="font-medium">Change Account</div>
                    <div className="text-xs text-zinc-500">Switch Gmail</div>
                  </div>
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 flex items-center gap-3 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                  </svg>
                  <div>
                    <div className="font-medium">Logout</div>
                    <div className="text-xs text-zinc-500">Sign out</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,text/csv"
          className="hidden"
          onChange={handleFileSelected}
        />
      </header>

      {scanToast && (
        <div className="px-4 pt-3">
          <div className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/80 shadow-sm">
            <span className={scanning ? "animate-wobble" : ""}>✦</span>
            <span>{scanToast}</span>
          </div>
        </div>
      )}

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
              onMoveMail={moveMail}
              justPlacedMailKey={justPlacedMailKey}
              scanAppearDelays={scanAppearDelays}
              onScanAppearDone={handleScanAppearDone}
            />
          ))}

          {/* UNCATEGORIZED */}
          {hasUncategorizedContacts && (
            <div
              className="border border-zinc-200 dark:border-zinc-800 rounded overflow-hidden"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                const contactId = e.dataTransfer.getData("contact")
                if (contactId) handleDragContactToUncategorized(contactId)
              }}
            >
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                <div className="font-semibold text-zinc-900 dark:text-zinc-50">Uncategorized</div>
                <div className="text-xs text-zinc-500">
                  {contacts.filter(c => c.categoryId === "uncategorized").length} contacts
                </div>
              </div>

              <div className="grid grid-cols-[260px_1fr] text-xs font-medium text-zinc-500 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                <div>Contact</div>
                <div>Sent / Drafts</div>
              </div>

              {contacts
                .filter(c => c.categoryId === "uncategorized")
                .map(contact => (
                  <div key={contact.id} className="relative">
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
                      onMoveMail={moveMail}
                      justPlacedMailKey={justPlacedMailKey}
                      scanAppearDelays={scanAppearDelays}
                      onScanAppearDone={handleScanAppearDone}
                    />
                  </div>
                ))}
            </div>
          )}

          {/* ADD CONTACT MODAL */}
      {showAddContact && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onMouseDown={() => closeAllMenus()}
        >
          <div
            className="bg-white text-black rounded-lg p-6 w-96 border border-zinc-900"
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
              className="w-full border border-zinc-900 rounded px-3 py-2 mb-3 bg-white text-black placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
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
              className="w-full border border-zinc-900 rounded px-3 py-2 mb-4 bg-white text-black placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              onFocus={closeAllMenus}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddContact(false)}
                className="px-4 py-2 border border-zinc-900 rounded hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button onClick={handleAddContact} className="px-4 py-2 bg-black text-white rounded hover:bg-zinc-800">
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
            className="bg-white text-black rounded-lg p-6 w-96 border border-zinc-900"
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
              className="w-full border border-zinc-900 rounded px-3 py-2 mb-4 bg-white text-black placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              onFocus={closeAllMenus}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddCategory(false)}
                className="px-4 py-2 border border-zinc-900 rounded hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button onClick={handleAddCategory} className="px-4 py-2 bg-black text-white rounded hover:bg-zinc-800">
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
          {showSettingsModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onMouseDown={closeAllMenus}>
              <div
                className="bg-white dark:bg-zinc-950 rounded-lg p-6 w-[420px] border border-zinc-200 dark:border-zinc-800"
                onMouseDown={e => e.stopPropagation()}
              >
                <h3 className="font-semibold mb-4">Settings</h3>
                <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                  Priority threshold (days since last sent email)
                </div>

                <input
                  type="number"
                  value={priorityAfterDays}
                  onChange={e => setPriorityAfterDays(parseInt(e.target.value || "0", 10))}
                  className="w-full border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 mb-4 bg-transparent"
                />

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveSettings(priorityAfterDays)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* IMPORT PREVIEW MODAL */}
          {showImportModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onMouseDown={() => setShowImportModal(false)}>
              <div
                className="bg-white dark:bg-zinc-950 rounded-lg p-6 w-[640px] border border-zinc-200 dark:border-zinc-800"
                onMouseDown={e => e.stopPropagation()}
              >
                <h3 className="font-semibold mb-4">Import Preview</h3>

                <div className="flex items-center gap-2 mb-4">
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">Import into:</div>
                  <select
                    value={importCategoryId}
                    onChange={e => setImportCategoryId(e.target.value)}
                    className="border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 bg-transparent text-sm"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    <option value="uncategorized">Uncategorized</option>
                  </select>
                </div>

                <div className="max-h-[280px] overflow-auto border border-zinc-200 dark:border-zinc-800 rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-300">
                      <tr>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map((r, idx) => (
                        <tr key={idx} className="border-t border-zinc-200 dark:border-zinc-800">
                          <td className="p-2">{r.name}</td>
                          <td className="p-2">{r.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => {
                      setShowImportModal(false)
                      setImportRows([])
                    }}
                    className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  >
                    Cancel
                  </button>
                  <button onClick={handleConfirmImport} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Import {importRows.length}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MANUAL DRAFT SOURCE */}
        <div className={stackPulse ? "animate-wobble" : ""}>
          <ManualDraftSource
            manualDrafts={manualDrafts}
            isDraggingDraft={isDraggingDraft}
            setIsDraggingDraft={setIsDraggingDraft}
            isDeleting={isDeletingMode}
          />
        </div>
      </main>
    </div>
  )
}
