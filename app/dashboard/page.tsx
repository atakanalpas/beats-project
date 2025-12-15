// app/dashboard/page.tsx

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

/* ---------------- MOCK DATA ---------------- */

const contacts: Contact[] = [
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
          { id: "a2", filename: "beat_140bpm_alt.wav" }
        ]
      },
      {
        id: "m2",
        sentAt: "2024-08-05",
        attachments: [{ id: "a3", filename: "demo.wav" }]
      }
    ]
  },
  {
    id: "c2",
    name: "Lisa Sound",
    email: "lisa@studio.com",
    sentMails: [
      {
        id: "m3",
        sentAt: "2024-10-01",
        attachments: [
          { id: "a4", filename: "loop_120bpm.wav" },
          { id: "a5", filename: "loop_v2.wav" }
        ]
      }
    ]
  },
  {
    id: "c3",
    name: "Tom Engineer",
    email: "tom@audio.net",
    sentMails: []
  }
]

/* ---------------- PAGE ---------------- */

export default function DashboardPage() {
  return (
    <div className="h-screen flex flex-col">
      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <div className="font-semibold text-lg">Audio Send Log</div>

        <div className="flex items-center gap-4">
          <button className="rounded bg-black text-white px-4 py-2 text-sm">
            Scan Sent Mails
          </button>
          <span className="text-xs text-gray-500">
            Last scan: 5 min ago
          </span>
        </div>
      </header>

      {/* TABLE */}
      <main className="flex-1 overflow-auto">
        <div className="min-w-[900px]">
          {contacts.map(contact => (
            <ContactRow key={contact.id} contact={contact} />
          ))}
        </div>
      </main>
    </div>
  )
}

/* ---------------- ROW ---------------- */

function ContactRow({ contact }: { contact: Contact }) {
  return (
    <div className="grid grid-cols-[260px_1fr] border-b">
      {/* LEFT */}
      <div className="sticky left-0 z-10 bg-white border-r px-4 py-3">
        <div className="font-medium text-sm">{contact.name}</div>
        <div className="text-xs text-gray-500 truncate">
          {contact.email}
        </div>
      </div>

      {/* RIGHT */}
      <div className="overflow-x-auto">
        <div className="flex gap-2 px-3 py-2">
          {contact.sentMails.length === 0 ? null : (
            contact.sentMails.map(mail => (
              <SentMailCard key={mail.id} mail={mail} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------- CARD ---------------- */

function SentMailCard({ mail }: { mail: SentMail }) {
  return (
    <div className="min-w-[170px] rounded border bg-gray-50 p-2 text-xs">
      <div className="text-gray-500 mb-1">
        {new Date(mail.sentAt).toLocaleDateString()}
      </div>

      <ul className="space-y-0.5">
        {mail.attachments.map(att => (
          <li key={att.id} className="truncate">
            {att.filename}
          </li>
        ))}
      </ul>
    </div>
  )
}