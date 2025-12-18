"use client"

import { useEffect, useState } from "react"

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
  source?: "gmail" | "manual"
}

type Contact = {
  id: string
  name: string
  email: string
  category?: string | null
  position?: number
  sentMails: SentMail[]
}

type ManualDraft = {
  id: string
  sentAt: string
  note?: string
  contactId?: string
}

/* ================= MOCK FALLBACK ================= */

const MOCK_CONTACTS: Contact[] = [
  {
    id: "c1",
    name: "Max Producer",
    email: "max@beats.com",
    sentMails: [
      {
        id: "m1",
        sentAt: "2024-09-12",
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
    sentMails: []
  }
]

/* ================= HELPERS ================= */

function filterContacts(list: Contact[], search: string) {
  if (!search) return list
  return list.filter(
    c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  )
}

function getStatusColor(lastSentAt?: string, priorityAfterDays = 30) {
  if (!lastSentAt) return "bg-gray-300"

  const days =
    (Date.now() - new Date(lastSentAt).getTime()) /
    (1000 * 60 * 60 * 24)

  if (days >= priorityAfterDays) return "bg-red-400"
  if (days >= priorityAfterDays * 0.6) return "bg-orange-300"
  if (days >= priorityAfterDays * 0.3) return "bg-yellow-200"
  return "bg-green-300"
}

function getCardOpacity(sentAt: string) {
  const days =
    (Date.now() - new Date(sentAt).getTime()) /
    (1000 * 60 * 60 * 24)

  if (days <= 14) return "opacity-100"
  if (days <= 60) return "opacity-70"
  return "opacity-40"
}

/* ================= COMPONENTS ================= */

function SentMailCard({ mail }: { mail: SentMail }) {
  return (
    <div
      className={`min-w-[140px] rounded border bg-white px-2 py-1 text-[11px] ${getCardOpacity(
        mail.sentAt
      )}`}
    >
      <div className="text-[10px] text-gray-400 mb-1">
        {new Date(mail.sentAt).toLocaleDateString()}
      </div>

      {mail.note && (
        <div className="italic text-gray-600">{mail.note}</div>
      )}

      <ul>
        {mail.attachments.map(att => (
          <li key={att.id} className="truncate text-gray-700">
            {att.filename}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ContactRow({
  contact,
  priorityAfterDays,
  manualDraft,
  setManualDraft
}: {
  contact: Contact
  priorityAfterDays: number
  manualDraft: ManualDraft | null
  setManualDraft: React.Dispatch<React.SetStateAction<ManualDraft | null>>
}) {
  const lastSent =
    contact.sentMails.length > 0
      ? contact.sentMails[0].sentAt
      : undefined

  return (
    <div
      className="grid grid-cols-[260px_1fr] border-b hover:bg-gray-50"
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        const id = e.dataTransfer.getData("manualDraft")
        if (!id) return

        setManualDraft(d =>
          d ? { ...d, contactId: contact.id } : d
        )
      }}
    >
      {/* LEFT */}
      <div className="sticky left-0 z-10 bg-white border-r flex">
        <div
          className={`w-1 ${getStatusColor(
            lastSent,
            priorityAfterDays
          )}`}
        />
        <div className="px-4 py-2">
          <div className="font-medium text-sm">{contact.name}</div>
          <div className="text-[11px] text-gray-400 truncate">
            {contact.email}
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="overflow-x-auto">
        <div className="flex gap-2 px-3 py-2 items-center">
          {contact.sentMails.map(mail => (
            <SentMailCard key={mail.id} mail={mail} />
          ))}

          {manualDraft?.contactId === contact.id && (
            <div className="min-w-[140px] rounded border border-dashed bg-white px-2 py-1 text-[11px]">
              <textarea
                placeholder="Add note…"
                value={manualDraft.note ?? ""}
                onChange={e =>
                  setManualDraft(d =>
                    d ? { ...d, note: e.target.value } : d
                  )
                }
                className="w-full resize-none border-none p-0 focus:outline-none"
                rows={2}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ================= MAIN ================= */

export default function DashboardPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [priorityAfterDays, setPriorityAfterDays] = useState(30)
  const [manualDraft, setManualDraft] = useState<ManualDraft | null>(null)

  // Add Contact modal
  const [showAddContact, setShowAddContact] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")

  useEffect(() => {
    fetch("/api/dashboard")
      .then(res => res.json())
      .then(data => {
        setContacts(data?.length ? data : MOCK_CONTACTS)
        setLoading(false)
      })
      .catch(() => {
        setContacts(MOCK_CONTACTS)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-gray-400">
        Loading dashboard…
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* HEADER */}
      <header className="flex items-center gap-4 px-6 py-4 border-b">
        <div className="font-semibold text-lg">Audio Send Log</div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="border px-3 py-2 rounded text-sm flex-1"
        />

        <select
          value={priorityAfterDays}
          onChange={e => setPriorityAfterDays(Number(e.target.value))}
          className="border rounded px-2 py-2 text-sm"
        >
          <option value={14}>14 days</option>
          <option value={30}>30 days</option>
          <option value={60}>60 days</option>
        </select>

        <button className="rounded bg-black text-white px-4 py-2 text-sm">
          Scan Sent Mails
        </button>

        <button
          onClick={() => setShowAddContact(true)}
          className="border border-dashed px-4 py-2 rounded text-sm"
        >
          + Add contact
        </button>

        <button
          onClick={() =>
            setManualDraft({
              id: crypto.randomUUID(),
              sentAt: new Date().toISOString()
            })
          }
          className="border border-dashed px-4 py-2 rounded text-sm"
        >
          + Manual send
        </button>
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-auto">
        <div className="min-w-[900px] px-4 py-4 space-y-6">
          {filterContacts(contacts, search).map(contact => (
            <ContactRow
              key={contact.id}
              contact={contact}
              priorityAfterDays={priorityAfterDays}
              manualDraft={manualDraft}
              setManualDraft={setManualDraft}
            />
          ))}
        </div>
      </main>

      {/* FLOATING DRAFT */}
      {manualDraft && !manualDraft.contactId && (
        <div
          draggable
          onDragStart={e =>
            e.dataTransfer.setData("manualDraft", manualDraft.id)
          }
          className="fixed bottom-6 right-6 z-50 w-48 cursor-grab rounded border border-dashed bg-white p-3 text-xs text-gray-500 shadow"
        >
          <div className="font-medium mb-1">Manual send</div>
          <div className="italic">Drag onto the board</div>
        </div>
      )}

      {/* ADD CONTACT MODAL */}
      {showAddContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg p-6 w-80">
            <h2 className="text-sm font-semibold mb-4">
              Add new contact
            </h2>

            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Name"
              className="w-full border px-3 py-2 rounded text-sm mb-2"
              autoFocus
            />

            <input
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="Email"
              className="w-full border px-3 py-2 rounded text-sm mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddContact(false)
                  setNewName("")
                  setNewEmail("")
                }}
                className="text-sm text-gray-500"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  if (!newName || !newEmail) return
                  setContacts(prev => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      name: newName,
                      email: newEmail.toLowerCase().trim(),
                      sentMails: []
                    }
                  ])
                  setShowAddContact(false)
                  setNewName("")
                  setNewEmail("")
                }}
                className="bg-black text-white px-4 py-2 rounded text-sm"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}