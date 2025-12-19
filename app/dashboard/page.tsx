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
        ]
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

/* ================= COMPONENTS ================= */

function SentMailCard({
  mail,
  onChangeNote
}: {
  mail: SentMail
  onChangeNote: (note: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-w-[160px] rounded border bg-white px-2 py-2 text-[11px]">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] text-gray-500">
          {new Date(mail.sentAt).toLocaleDateString()}
        </div>

        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="text-[10px] text-gray-500 hover:text-gray-800"
          title="Add note"
        >
          📝
        </button>
      </div>

      <ul className="mt-1">
        {mail.attachments.map(att => (
          <li key={att.id} className="truncate text-gray-800">
            {att.filename}
          </li>
        ))}
      </ul>

      {/* NOTE AREA */}
      {open && (
        <div className="mt-2 border-t pt-2">
          <textarea
            placeholder="Add note…"
            value={mail.note ?? ""}
            onChange={e => onChangeNote(e.target.value)}
            className="w-full resize-none border rounded px-2 py-1 text-[11px] text-gray-800 focus:outline-none"
            rows={3}
          />
        </div>
      )}

      {/* show note preview even when closed */}
      {!open && mail.note && (
        <div className="mt-2 text-[10px] text-gray-600 italic truncate">
          {mail.note}
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
  onDeleteContact, // NEU: Lösch-Funktion
  isDeleting, // NEU: Lösch-Modus
  isSelected, // NEU: Auswahl-Status
  onToggleSelect // NEU: Auswahl umschalten
}: {
  contact: Contact
  priorityAfterDays: number
  manualDrafts: ManualDraft[]
  setManualDrafts: React.Dispatch<React.SetStateAction<ManualDraft[]>>
  onUpdateMailNote: (
    contactId: string,
    mailId: string,
    note: string
  ) => void
  onDeleteContact?: (contactId: string) => void // NEU
  isDeleting?: boolean // NEU
  isSelected?: boolean // NEU
  onToggleSelect?: (contactId: string) => void // NEU
}) {
  const lastSent =
    contact.sentMails.length > 0
      ? contact.sentMails[0].sentAt
      : undefined

  return (
    <div
      className={`grid grid-cols-[260px_1fr] border-b hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        const draftId = e.dataTransfer.getData("manualDraft")
        if (!draftId) return

        setManualDrafts(prev =>
          prev.map(d =>
            d.id === draftId
              ? { ...d, contactId: contact.id }
              : d
          )
        )
      }}
    >
      {/* LEFT */}
      <div className="sticky left-0 z-10 bg-inherit border-r flex">
        {/* SELECTION CHECKBOX (nur im Lösch-Modus) */}
        {isDeleting && onToggleSelect && (
          <div className="px-3 flex items-center">
            <input
              type="checkbox"
              checked={isSelected || false}
              onChange={() => onToggleSelect(contact.id)}
              className="h-4 w-4"
            />
          </div>
        )}

        {/* DRAG HANDLE */}
        <div
          draggable={!isDeleting} // Nicht draggable im Lösch-Modus
          onDragStart={e =>
            e.dataTransfer.setData("contact", contact.id)
          }
          className="px-2 flex items-center cursor-grab text-gray-400 hover:text-gray-600"
          title="Drag contact"
        >
          ⠿
        </div>

        {/* STATUS BAR */}
        <div
          className={`w-1 ${getStatusColor(
            lastSent,
            priorityAfterDays
          )}`}
        />

        {/* CONTACT INFO */}
        <div className="px-4 py-2 flex-1">
          <div className="font-medium text-sm text-gray-900">
            {contact.name}
            {isDeleting && onDeleteContact && (
              <button
                onClick={() => onDeleteContact(contact.id)}
                className="ml-2 text-xs text-red-500 hover:text-red-700"
                title="Delete this contact"
              >
                ✕
              </button>
            )}
          </div>
          <div className="text-[11px] text-gray-600 truncate">
            {contact.email}
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="overflow-x-auto">
        <div className="flex gap-2 px-3 py-2 items-center">
          {contact.sentMails.map(mail => (
            <SentMailCard
              key={mail.id}
              mail={mail}
              onChangeNote={(note) =>
                onUpdateMailNote(contact.id, mail.id, note)
              }
            />
          ))}

          {manualDrafts
            .filter(d => d.contactId === contact.id)
            .map(draft => (
              <div
                key={draft.id}
                className="min-w-[140px] rounded border border-dashed bg-white px-2 py-1 text-[11px]"
              >
                <div className="flex justify-between items-center mb-1">
                  <div className="text-[10px] text-gray-500">
                    {new Date(draft.sentAt).toLocaleDateString()}
                  </div>

                  <button
                    onClick={() =>
                      setManualDrafts(prev =>
                        prev.filter(d => d.id !== draft.id)
                      )
                    }
                    className="text-[10px] text-gray-400 hover:text-red-500"
                    title="Delete manual card"
                  >
                    ✕
                  </button>
                </div>

                <textarea
                  placeholder="Add note…"
                  value={draft.note ?? ""}
                  onChange={e =>
                    setManualDrafts(prev =>
                      prev.map(d =>
                        d.id === draft.id
                          ? { ...d, note: e.target.value }
                          : d
                      )
                    )
                  }
                  className="w-full resize-none border-none p-0 focus:outline-none text-gray-700"
                  rows={2}
                />
              </div>
            ))}
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

  const [manualDrafts, setManualDrafts] = useState<ManualDraft[]>([])
  
  // NEUE STATES FÜR LÖSCH-FUNKTIONALITÄT
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [isDeletingMode, setIsDeletingMode] = useState(false)
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  // ADD CONTACT
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContactName, setNewContactName] = useState("")
  const [newContactEmail, setNewContactEmail] = useState("")

  // ADD CATEGORY
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")

  // Funktion zum Aktualisieren von Mail-Notizen
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

  // Funktion zum Hinzufügen eines Kontakts
  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactEmail.trim()) return
    
    const newContact: Contact = {
      id: crypto.randomUUID(),
      name: newContactName,
      email: newContactEmail,
      categoryId: null,
      sentMails: []
    }
    
    setContacts(prev => [...prev, newContact])
    setNewContactName("")
    setNewContactEmail("")
    setShowAddContact(false)
  }

  // Funktion zum Hinzufügen einer Kategorie
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return
    
    const newCategory: Category = {
      id: crypto.randomUUID(),
      name: newCategoryName
    }
    
    setCategories(prev => [...prev, newCategory])
    setNewCategoryName("")
    setShowAddCategory(false)
  }

  // NEU: Kontakt löschen
  const handleDeleteContact = (contactId: string) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      setContacts(prev => prev.filter(c => c.id !== contactId))
    }
  }

  // NEU: Kategorie löschen
  const handleDeleteCategory = (categoryId: string) => {
    if (confirm("Delete this category? Contacts will be moved to Uncategorized.")) {
      // Kategorie löschen
      setCategories(prev => prev.filter(c => c.id !== categoryId))
      
      // Kontakte auf Uncategorized setzen
      setContacts(prev =>
        prev.map(c =>
          c.categoryId === categoryId
            ? { ...c, categoryId: null }
            : c
        )
      )
    }
  }

  // NEU: Mehrere Kontakte löschen
  const handleDeleteSelectedContacts = () => {
    if (selectedContacts.length === 0) return
    if (confirm(`Delete ${selectedContacts.length} selected contacts?`)) {
      setContacts(prev => prev.filter(c => !selectedContacts.includes(c.id)))
      setSelectedContacts([])
      setIsDeletingMode(false)
    }
  }

  // NEU: Kontakt-Auswahl umschalten
  const toggleContactSelection = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    )
  }

  // NEU: Kategorie-Auswahl umschalten
  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  // NEU: Kategorien mit Kontakten löschen
  const handleDeleteSelectedCategories = () => {
    if (selectedCategories.length === 0) return
    if (confirm(`Delete ${selectedCategories.length} selected categories? Contacts will be moved to Uncategorized.`)) {
      // Kategorien löschen
      setCategories(prev => prev.filter(c => !selectedCategories.includes(c.id)))
      
      // Kontakte auf Uncategorized setzen
      setContacts(prev =>
        prev.map(c =>
          selectedCategories.includes(c.categoryId || "")
            ? { ...c, categoryId: null }
            : c
        )
      )
      
      setSelectedCategories([])
      setIsDeletingMode(false)
    }
  }

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

        {/* ADD BUTTON MIT MENÜ */}
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(v => !v)}
            className="w-9 h-9 rounded-full border flex items-center justify-center text-lg text-gray-600 hover:bg-gray-50"
            title="Add"
          >
            +
          </button>
          
          {/* ADD MENÜ (wird angezeigt wenn showAddMenu true ist) */}
          {showAddMenu && (
            <div className="absolute right-0 top-full mt-2 bg-white border rounded-lg shadow-lg z-50 min-w-48">
              <button
                onClick={() => {
                  setShowAddContact(true)
                  setShowAddMenu(false)
                }}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-2"
              >
                <span className="text-lg">👤</span>
                <div>
                  <div className="font-medium">Add Contact</div>
                  <div className="text-xs text-gray-500">New person to track</div>
                </div>
              </button>
              
              <button
                onClick={() => {
                  setShowAddCategory(true)
                  setShowAddMenu(false)
                }}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-2 border-t"
              >
                <span className="text-lg">📁</span>
                <div>
                  <div className="font-medium">Add Category</div>
                  <div className="text-xs text-gray-500">New group for contacts</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* LÖSCH-BUTTON */}
        <button
          onClick={() => {
            if (isDeletingMode) {
              // Lösch-Modus beenden
              setIsDeletingMode(false)
              setSelectedContacts([])
              setSelectedCategories([])
            } else {
              // Lösch-Modus aktivieren
              setIsDeletingMode(true)
            }
          }}
          className={`w-9 h-9 rounded-full border flex items-center justify-center ${
            isDeletingMode 
              ? 'bg-red-100 border-red-300 text-red-600' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
          title={isDeletingMode ? "Cancel delete mode" : "Delete items"}
        >
          🗑️
        </button>

        {/* AUSGEWÄHLTE LÖSCHEN BUTTON (nur im Lösch-Modus) */}
        {isDeletingMode && (
          <>
            <button
              onClick={handleDeleteSelectedContacts}
              disabled={selectedContacts.length === 0}
              className={`px-4 py-2 rounded text-sm ${
                selectedContacts.length > 0
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Delete Contacts ({selectedContacts.length})
            </button>
            
            <button
              onClick={handleDeleteSelectedCategories}
              disabled={selectedCategories.length === 0}
              className={`px-4 py-2 rounded text-sm ${
                selectedCategories.length > 0
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Delete Categories ({selectedCategories.length})
            </button>
          </>
        )}

        <button className="rounded bg-black text-white px-4 py-2 text-sm">
          Scan Sent Mails
        </button>
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-auto">
        <div className="min-w-[900px] px-4 py-4 space-y-8">
          {/* CATEGORIES */}
          {categories.map(category => (
            <div
              key={category.id}
              className="border rounded"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                if (isDeletingMode) return // Kein Drop im Lösch-Modus
                const contactId = e.dataTransfer.getData("contact")
                if (!contactId) return

                setContacts(prev =>
                  prev.map(c =>
                    c.id === contactId
                      ? { ...c, categoryId: category.id }
                      : c
                  )
                )
              }}
            >
              {/* CATEGORY HEADER (EDIT + DELETE + SELECTION) */}
              <div className="px-4 py-2 flex items-center justify-between border-b bg-gray-50">
                <div className="flex items-center gap-2 flex-1">
                  {/* SELECTION CHECKBOX (nur im Lösch-Modus) */}
                  {isDeletingMode && (
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category.id)}
                      onChange={() => toggleCategorySelection(category.id)}
                      className="h-4 w-4"
                    />
                  )}
                  
                  <input
                    value={category.name}
                    onChange={e =>
                      setCategories(prev =>
                        prev.map(c =>
                          c.id === category.id
                            ? { ...c, name: e.target.value }
                            : c
                        )
                      )
                    }
                    className="text-xs font-semibold uppercase bg-transparent focus:outline-none text-gray-700 flex-1"
                  />
                </div>

                <button
                  onClick={() => handleDeleteCategory(category.id)}
                  className="text-xs text-gray-400 hover:text-red-500 ml-2"
                  title="Delete category"
                >
                  ✕
                </button>
              </div>

              {/* CONTACTS IN CATEGORY */}
              {filterContacts(
                contacts.filter(c => c.categoryId === category.id),
                search
              ).map(contact => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  priorityAfterDays={priorityAfterDays}
                  manualDrafts={manualDrafts}
                  setManualDrafts={setManualDrafts}
                  onUpdateMailNote={updateMailNote}
                  onDeleteContact={isDeletingMode ? handleDeleteContact : undefined}
                  isDeleting={isDeletingMode}
                  isSelected={selectedContacts.includes(contact.id)}
                  onToggleSelect={toggleContactSelection}
                />
              ))}
            </div>
          ))}

          {/* UNCATEGORIZED */}
          <div
            className="border rounded"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              if (isDeletingMode) return // Kein Drop im Lösch-Modus
              const contactId = e.dataTransfer.getData("contact")
              if (!contactId) return

              setContacts(prev =>
                prev.map(c =>
                  c.id === contactId
                    ? { ...c, categoryId: null }
                    : c
                )
              )
            }}
          >
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase border-b bg-gray-50">
              Uncategorized
            </div>

            {filterContacts(
              contacts.filter(c => !c.categoryId),
              search
            ).map(contact => (
              <ContactRow
                key={contact.id}
                contact={contact}
                priorityAfterDays={priorityAfterDays}
                manualDrafts={manualDrafts}
                setManualDrafts={setManualDrafts}
                onUpdateMailNote={updateMailNote}
                onDeleteContact={isDeletingMode ? handleDeleteContact : undefined}
                isDeleting={isDeletingMode}
                isSelected={selectedContacts.includes(contact.id)}
                onToggleSelect={toggleContactSelection}
              />
            ))}
          </div>

          {/* ADD CONTACT MODAL */}
          {showAddContact && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-96">
                <h3 className="font-semibold mb-4">Add New Contact</h3>
                <input
                  type="text"
                  placeholder="Name"
                  value={newContactName}
                  onChange={e => setNewContactName(e.target.value)}
                  className="w-full border rounded px-3 py-2 mb-3"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newContactEmail}
                  onChange={e => setNewContactEmail(e.target.value)}
                  className="w-full border rounded px-3 py-2 mb-4"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddContact(false)}
                    className="px-4 py-2 border rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddContact}
                    className="px-4 py-2 bg-black text-white rounded"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ADD CATEGORY MODAL */}
          {showAddCategory && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-96">
                <h3 className="font-semibold mb-4">Add New Category</h3>
                <input
                  type="text"
                  placeholder="Category name"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  className="w-full border rounded px-3 py-2 mb-4"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddCategory(false)}
                    className="px-4 py-2 border rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCategory}
                    className="px-4 py-2 bg-black text-white rounded"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MANUAL DRAFT SOURCE */}
      <div
        draggable
        onDragStart={e => {
          const draft: ManualDraft = {
            id: crypto.randomUUID(),
            sentAt: new Date().toISOString()
          }
          setManualDrafts(prev => [...prev, draft])
          e.dataTransfer.setData("manualDraft", draft.id)
        }}
        className="fixed bottom-6 right-6 z-50 cursor-grab"
      >
        <div className="relative w-36 h-24">
          <div className="absolute inset-0 rounded border bg-gray-300 translate-x-2 translate-y-2" />
          <div className="absolute inset-0 rounded border bg-gray-200 translate-x-1 translate-y-1" />
          <div className="absolute inset-0 rounded border bg-white flex items-center justify-center text-xs font-semibold text-gray-600">
            DRAG ME
          </div>
        </div>
      </div>
    </div>
  )
}