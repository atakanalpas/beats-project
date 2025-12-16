"use client"

import { useState } from "react"

/* ================= TYPES ================= */

type Attachment = {
  id: string
  filename: string
}

type SentMail = {
  id: string
  sentAt: string
  attachments: Attachment[]
}

type Contact = {
  id: string
  name: string
  email: string
  sentMails: SentMail[]
}

type Category = {
  id: string
  name: string
}

type ContactWithCategory = Contact & {
  categoryId?: string
  position: number
}

/* ================= MOCK DATA ================= */

const categories: Category[] = [
  { id: "cat-rapper", name: "Rapper" },
  { id: "cat-songwriter", name: "Songwriter" }
]

const contacts: ContactWithCategory[] = [
  {
    id: "c1",
    name: "Max Producer",
    email: "max@beats.com",
    categoryId: "cat-rapper",
    position: 1,
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
    name: "Lisa Sound",
    email: "lisa@studio.com",
    categoryId: "cat-songwriter",
    position: 1,
    sentMails: []
  },
  {
    id: "c3",
    name: "Tom Engineer",
    email: "tom@audio.net",
    position: 1,
    sentMails: []
  }
]

/* ================= HELPERS ================= */

function filterContacts(list: ContactWithCategory[], search: string) {
  if (!search) return list
  return list.filter(
    c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  )
}

function getStatusColor(
  lastSentAt?: string,
  priorityAfterDays: number = 30
) {
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

/* ================= PAGE ================= */

export default function DashboardPage() {
  const [search, setSearch] = useState("")
  const [priorityAfterDays, setPriorityAfterDays] = useState(30)

  return (
    <div className="h-screen flex flex-col">
      {/* HEADER */}
      <header className="flex items-center gap-4 px-6 py-4 border-b">
        <div className="font-semibold text-lg whitespace-nowrap">
          Audio Send Log
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="border px-3 py-2 rounded text-sm flex-1"
        />

        {/* DEV SETTING (später User Settings) */}
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
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-auto">
        <div className="min-w-[900px] px-4 py-4 space-y-6">
          {categories.map(category => (
            <CategoryBlock
              key={category.id}
              title={category.name}
              contacts={filterContacts(
                contacts.filter(c => c.categoryId === category.id),
                search
              )}
              priorityAfterDays={priorityAfterDays}
            />
          ))}

          <CategoryBlock
            title="Uncategorized"
            contacts={filterContacts(
              contacts.filter(c => !c.categoryId),
              search
            )}
            priorityAfterDays={priorityAfterDays}
          />
        </div>
      </main>
    </div>
  )
}

/* ================= CATEGORY ================= */

function CategoryBlock({
  title,
  contacts,
  priorityAfterDays
}: {
  title: string
  contacts: ContactWithCategory[]
  priorityAfterDays: number
}) {
  if (contacts.length === 0) return null

  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-gray-500 uppercase">
        {title}
      </div>

      <div className="border rounded overflow-hidden">
        {contacts
          .sort((a, b) => a.position - b.position)
          .map(contact => (
            <ContactRow
              key={contact.id}
              contact={contact}
              priorityAfterDays={priorityAfterDays}
            />
          ))}
      </div>
    </div>
  )
}

/* ================= ROW ================= */

function ContactRow({
  contact,
  priorityAfterDays
}: {
  contact: ContactWithCategory
  priorityAfterDays: number
}) {
  const lastSent =
    contact.sentMails.length > 0
      ? contact.sentMails[0].sentAt
      : undefined

  const MAX_VISIBLE = 4
  const visibleMails = contact.sentMails.slice(0, MAX_VISIBLE)
  const hiddenCount = contact.sentMails.length - MAX_VISIBLE

  return (
    <div className="grid grid-cols-[260px_1fr] border-b hover:bg-gray-50">
      {/* LEFT */}
      <div className="sticky left-0 z-10 bg-white border-r flex">
        <div
          className={`w-1 ${getStatusColor(
            lastSent,
            priorityAfterDays
          )}`}
        />

        <div className="px-4 py-2">
          <div className="font-medium text-sm">
            {contact.name}
          </div>
          <div className="text-[11px] text-gray-400 truncate">
            {contact.email}
          </div>
          {lastSent && (
            <div className="text-[10px] text-gray-400 mt-0.5">
              last sent{" "}
              {new Date(lastSent).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT */}
      <div className="overflow-x-auto">
        <div className="flex gap-2 px-3 py-2 items-center">
          {visibleMails.map(mail => (
            <SentMailCard key={mail.id} mail={mail} />
          ))}

          {hiddenCount > 0 && (
            <div className="min-w-[80px] flex items-center justify-center text-xs text-gray-400 border rounded">
              +{hiddenCount} more
            </div>
          )}

          {contact.sentMails.length === 0 && (
            <span className="text-[11px] text-gray-300 italic">
              nothing sent yet
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ================= CARD ================= */

function SentMailCard({ mail }: { mail: SentMail }) {
  return (
    <div
      className={`min-w-[140px] rounded border bg-white px-2 py-1 text-[11px] hover:bg-gray-50 transition-colors ${getCardOpacity(
        mail.sentAt
      )}`}
    >
      <div className="text-[10px] text-gray-400 mb-1">
        {new Date(mail.sentAt).toLocaleDateString()}
      </div>

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
