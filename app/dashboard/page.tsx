"use client"

import { useEffect, useState, useRef } from "react"

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

// SICHERE UUID GENERATOR
const generateId = () => {
  return 'id-' + Math.random().toString(36).substr(2, 9)
}

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
  onChangeNote,
  isDeleting,
  onDeleteMail
}: {
  mail: SentMail
  onChangeNote: (note: string) => void
  isDeleting?: boolean
  onDeleteMail?: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-w-[160px] rounded border bg-white px-2 py-2 text-[11px] relative group">
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
        <div className="text-[10px] text-gray-500">
          {new Date(mail.sentAt).toLocaleDateString()}
        </div>

        {/* 📝 BUTTON oben rechts */}
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
  onDeleteContact,
  onDeleteMail,
  onUpdateContactName,
  onUpdateContactEmail,
  isDeleting
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
  onDeleteContact?: (contactId: string) => void
  onDeleteMail?: (contactId: string, mailId: string) => void
  onUpdateContactName?: (contactId: string, name: string) => void
  onUpdateContactEmail?: (contactId: string, email: string) => void
  isDeleting?: boolean
}) {
  const lastSent =
    contact.sentMails.length > 0
      ? contact.sentMails[0].sentAt
      : undefined

  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [tempName, setTempName] = useState(contact.name)
  const [tempEmail, setTempEmail] = useState(contact.email)

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

  return (
    <div
      className="grid grid-cols-[260px_1fr] border-b hover:bg-gray-50"
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        if (isDeleting) return
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
      <div className="sticky left-0 z-10 bg-white border-r flex">
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
          {/* NAME - bearbeitbar */}
          <div className="font-medium text-sm text-gray-900">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={handleNameSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNameSave()
                    if (e.key === 'Escape') {
                      setTempName(contact.name)
                      setIsEditingName(false)
                    }
                  }}
                  className="px-2 py-1 text-sm w-full border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleNameSave}
                  className="text-xs text-blue-500 hover:text-blue-700 px-2"
                >
                  ✓
                </button>
              </div>
            ) : (
              <div 
                className="hover:bg-gray-100 px-2 py-1 rounded cursor-text"
                onClick={() => setIsEditingName(true)}
                title="Click to edit name"
              >
                {contact.name}
              </div>
            )}
          </div>
          
          {/* EMAIL - bearbeitbar */}
          <div className="text-[11px] text-gray-600">
            {isEditingEmail ? (
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={tempEmail}
                  onChange={(e) => setTempEmail(e.target.value)}
                  onBlur={handleEmailSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEmailSave()
                    if (e.key === 'Escape') {
                      setTempEmail(contact.email)
                      setIsEditingEmail(false)
                    }
                  }}
                  className="px-2 py-1 text-xs w-full border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleEmailSave}
                  className="text-xs text-blue-500 hover:text-blue-700 px-2"
                >
                  ✓
                </button>
              </div>
            ) : (
              <div 
                className="hover:bg-gray-100 px-2 py-1 rounded cursor-text truncate"
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
        <div className="flex gap-2 px-3 py-2 items-center">
          {contact.sentMails.map(mail => (
            <SentMailCard
              key={mail.id}
              mail={mail}
              onChangeNote={(note) =>
                onUpdateMailNote(contact.id, mail.id, note)
              }
              isDeleting={isDeleting}
              onDeleteMail={() => onDeleteMail?.(contact.id, mail.id)}
            />
          ))}

          {manualDrafts
            .filter(d => d.contactId === contact.id)
            .map(draft => (
              <div
                key={draft.id}
                className="min-w-[140px] rounded border border-dashed bg-white px-2 py-1 text-[11px] relative group"
              >
                {/* LÖSCH-KREUZ für Manual Drafts (NUR im Delete Mode) */}
                {isDeleting && (
                  <button
                    onClick={() =>
                      setManualDrafts(prev =>
                        prev.filter(d => d.id !== draft.id)
                      )
                    }
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] z-10 hover:bg-red-600"
                    title="Delete manual card"
                  >
                    ✕
                  </button>
                )}

                <div className="text-[10px] text-gray-500 mb-1">
                  {new Date(draft.sentAt).toLocaleDateString()}
                </div>

                {/* ÄNDERUNG: "Add note..." zu "Add..." */}
                <textarea
                  placeholder="Add..."
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

/* ================= KATEGORIE KOMPONENT ================= */

function CategorySection({
  category,
  isDeletingMode,
  selectedItems,
  onToggleSelection,
  onUpdateCategoryName,
  onDeleteCategory,
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
  onDragContactToCategory
}: {
  category: Category
  isDeletingMode: boolean
  selectedItems: string[]
  onToggleSelection: (itemId: string) => void
  onUpdateCategoryName: (categoryId: string, name: string) => void
  onDeleteCategory: (categoryId: string) => void
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
}) {
  const [isEditingCategory, setIsEditingCategory] = useState(false)
  const [tempCategoryName, setTempCategoryName] = useState(category.name)

  const handleCategorySave = () => {
    if (tempCategoryName.trim() && tempCategoryName !== category.name) {
      onUpdateCategoryName(category.id, tempCategoryName.trim())
    }
    setIsEditingCategory(false)
  }

  // Reset temp value when category changes
  useEffect(() => {
    setTempCategoryName(category.name)
  }, [category.name])

  return (
    <div
      className="border rounded"
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        if (isDeletingMode) return
        const contactId = e.dataTransfer.getData("contact")
        if (!contactId) return

        onDragContactToCategory(contactId, category.id)
      }}
    >
      {/* CATEGORY HEADER */}
      <div className="px-4 py-2 flex items-center justify-between border-b bg-gray-50">
        <div className="flex items-center gap-2 flex-1">
          {/* AUSWAHL CHECKBOX (nur im Delete Mode) */}
          {isDeletingMode && (
            <input
              type="checkbox"
              checked={selectedItems.includes(`category_${category.id}`)}
              onChange={() => onToggleSelection(`category_${category.id}`)}
              className="h-4 w-4 rounded text-red-500 focus:ring-red-500"
            />
          )}
          
          {/* KATEGORIE NAME - bearbeitbar */}
          {isEditingCategory ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={tempCategoryName}
                onChange={(e) => setTempCategoryName(e.target.value)}
                onBlur={handleCategorySave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCategorySave()
                  if (e.key === 'Escape') {
                    setTempCategoryName(category.name)
                    setIsEditingCategory(false)
                  }
                }}
                className="text-xs font-semibold uppercase bg-transparent focus:outline-none text-gray-700 flex-1 border rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={handleCategorySave}
                className="text-xs text-blue-500 hover:text-blue-700 px-2"
              >
                ✓
              </button>
            </div>
          ) : (
            <div 
              className="text-xs font-semibold uppercase text-gray-700 flex-1 hover:bg-gray-100 px-2 py-1 rounded cursor-text"
              onClick={() => setIsEditingCategory(true)}
              title="Click to edit category name"
            >
              {category.name}
            </div>
          )}
        </div>
      </div>

      {/* CONTACTS IN CATEGORY */}
      {filterContacts(
        contacts.filter(c => c.categoryId === category.id),
        search
      ).map(contact => (
        <div key={contact.id} className="relative">
          {/* AUSWAHL CHECKBOX für Kontakte (nur im Delete Mode) */}
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
          />
        </div>
      ))}
    </div>
  )
}

/* ================= EXPANDING SEARCH BAR ================= */

function ExpandingSearchBar({
  search,
  setSearch
}: {
  search: string
  setSearch: (value: string) => void
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
    // Prüfe ob der Fokus auf den Clear Button geht
    const relatedTarget = e.relatedTarget as HTMLElement
    if (relatedTarget?.tagName === 'BUTTON' && relatedTarget.title === 'Clear search') {
      return // Nicht schließen wenn auf Clear Button geklickt wird
    }
    
    if (!search) {
      setIsExpanded(false)
    }
  }

  return (
    <div className="relative">
      <div
        className={`flex items-center transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? "w-64" : "w-10"
        }`}
      >
        {/* SUCH-ICON (immer sichtbar) */}
        <button
          onClick={handleSearchClick}
          className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors flex-shrink-0 ${
            isExpanded 
              ? "bg-gray-100 text-gray-600" 
              : "bg-gray-100 hover:bg-gray-200 text-gray-600"
          }`}
          title="Search"
        >
          {/* EMOJI DURCH DIESES SVG ERSETZEN */}
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
        </button>

        {/* INPUT FIELD (expandiert) */}
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onBlur={handleBlur}
          placeholder="Search name or email..."
          className={`px-3 py-2 bg-transparent focus:outline-none transition-all duration-300 ${
            isExpanded ? "opacity-100 w-full" : "opacity-0 w-0"
          }`}
        />
      </div>

      {/* CLEAR BUTTON (nur wenn Text vorhanden und expanded) */}
      {search && isExpanded && (
        <button
          onClick={() => {
            setSearch("")
            inputRef.current?.focus()
          }}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          title="Clear search"
          tabIndex={-1} // Verhindert Fokus vom Blur Event
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
  setManualDrafts 
}: { 
  isDeletingMode: boolean
  setManualDrafts: React.Dispatch<React.SetStateAction<ManualDraft[]>>
}) {
  if (isDeletingMode) return null // Versteckt im Delete Mode

  return (
    <div
      draggable
      onDragStart={e => {
        const draft: ManualDraft = {
          id: generateId(),
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
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showImportExportMenu, setShowImportExportMenu] = useState(false)
  const [isDeletingMode, setIsDeletingMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])

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

  // Funktion zum Aktualisieren von Kontakt-Namen
  const updateContactName = (contactId: string, name: string) => {
    setContacts(prev =>
      prev.map(contact =>
        contact.id === contactId
          ? { ...contact, name }
          : contact
      )
    )
  }

  // Funktion zum Aktualisieren von Kontakt-Email
  const updateContactEmail = (contactId: string, email: string) => {
    setContacts(prev =>
      prev.map(contact =>
        contact.id === contactId
          ? { ...contact, email }
          : contact
      )
    )
  }

  // Funktion zum Aktualisieren von Kategorie-Namen
  const updateCategoryName = (categoryId: string, name: string) => {
    setCategories(prev =>
      prev.map(category =>
        category.id === categoryId
          ? { ...category, name }
          : category
      )
    )
  }

  // Funktion zum Löschen einer Mail
  const deleteMail = (contactId: string, mailId: string) => {
    if (confirm("Are you sure you want to delete this mail?")) {
      setContacts(prev =>
        prev.map(contact => {
          if (contact.id === contactId) {
            return {
              ...contact,
              sentMails: contact.sentMails.filter(mail => mail.id !== mailId)
            }
          }
          return contact
        })
      )
    }
  }

  // Funktion zum Hinzufügen eines Kontakts
  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactEmail.trim()) return
    
    const newContact: Contact = {
      id: generateId(),
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
      id: generateId(),
      name: newCategoryName
    }
    
    setCategories(prev => [...prev, newCategory])
    setNewCategoryName("")
    setShowAddCategory(false)
  }

  // Funktion zum Löschen eines Kontakts
  const handleDeleteContact = (contactId: string) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      setContacts(prev => prev.filter(c => c.id !== contactId))
    }
  }

  // Drag & Drop Handler für Kategorien
  const handleDragContactToCategory = (contactId: string, categoryId: string) => {
    setContacts(prev =>
      prev.map(c =>
        c.id === contactId
          ? { ...c, categoryId }
          : c
      )
    )
  }

  // Drag & Drop Handler für Uncategorized
  const handleDragContactToUncategorized = (contactId: string) => {
    setContacts(prev =>
      prev.map(c =>
        c.id === contactId
          ? { ...c, categoryId: null }
          : c
      )
    )
  }

  // Auswahl-Logik für Delete Mode
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  // Alle ausgewählten Items löschen (nur EINE Bestätigung)
  const handleDeleteSelected = () => {
    if (selectedItems.length === 0) return
    
    // Zähle Kontakte und Kategorien
    const contactIds = selectedItems.filter(id => id.startsWith("contact_"))
    const categoryIds = selectedItems.filter(id => id.startsWith("category_"))
    
    // Erstelle eine Bestätigungsnachricht basierend auf was ausgewählt ist
    let message = ""
    if (contactIds.length > 0 && categoryIds.length > 0) {
      message = `Delete ${contactIds.length} contact(s) and ${categoryIds.length} category(ies)? Contacts in categories will be moved to Uncategorized.`
    } else if (contactIds.length > 0) {
      message = `Delete ${contactIds.length} selected contact(s)?`
    } else if (categoryIds.length > 0) {
      message = `Delete ${categoryIds.length} selected category(ies)? Contacts will be moved to Uncategorized.`
    }
    
    if (confirm(message)) {
      // Kontakte löschen
      if (contactIds.length > 0) {
        setContacts(prev => 
          prev.filter(c => !contactIds.includes(`contact_${c.id}`))
        )
      }
      
      // Kategorien löschen und deren Kontakte auf Uncategorized setzen
      if (categoryIds.length > 0) {
        const categoryIdsOnly = categoryIds.map(id => id.replace("category_", ""))
        
        // Kategorien löschen
        setCategories(prev => prev.filter(c => !categoryIdsOnly.includes(c.id)))
        
        // Kontakte auf Uncategorized setzen
        setContacts(prev =>
          prev.map(c =>
            c.categoryId && categoryIdsOnly.includes(c.categoryId)
              ? { ...c, categoryId: null }
              : c
          )
        )
      }
      
      setSelectedItems([])
    }
  }

  // IMPORT/EXPORT FUNKTIONEN
  const handleExportToExcel = () => {
    alert("Export to Excel would be implemented here")
    setShowImportExportMenu(false)
  }

  const handleExportToSheets = () => {
    alert("Export to Google Sheets would be implemented here")
    setShowImportExportMenu(false)
  }

  const handleExportToPages = () => {
    alert("Export to Apple Pages would be implemented here")
    setShowImportExportMenu(false)
  }

  const handleImportList = () => {
    alert("Import list would be implemented here")
    setShowImportExportMenu(false)
  }

  useEffect(() => {
    // Simulierte Datenladen mit Fehlerbehandlung
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
      <div className="h-screen flex items-center justify-center text-sm text-gray-400">
        Loading dashboard…
      </div>
    )
  }

  // Berechne ob Uncategorized angezeigt werden soll
  const hasUncategorizedContacts = contacts.filter(c => !c.categoryId).length > 0

  return (
    <div className="h-screen flex flex-col">
      {/* HEADER */}
      <header className="flex items-center gap-4 px-6 py-4 border-b">
        <div className="font-semibold text-lg">Audio Send Log</div>

        <div className="flex-1" /> {/* Flex Spacer */}

        {/* BUTTONS GRUPPE */}
        <div className="flex items-center gap-3">
          {/* SUCHLEISTE (neben + Button) */}
          <ExpandingSearchBar search={search} setSearch={setSearch} />

          {/* IMPORT/EXPORT BUTTON */}
          <div className="relative">
            <button
              onClick={() => {
                setShowImportExportMenu(v => !v)
                setShowAddMenu(false)
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg text-gray-600 hover:bg-gray-50 transition-colors"
              title="Import/Export"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
            </button>
            
            {/* IMPORT/EXPORT MENÜ */}
            {showImportExportMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white border rounded-lg shadow-lg z-50 min-w-48">
                <button
                  onClick={handleImportList}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-2 transition-colors"
                >
                  <span className="text-lg">📥</span>
                  <div>
                    <div className="font-medium">Import List</div>
                    <div className="text-xs text-gray-500">Import contacts from file</div>
                  </div>
                </button>
                
                <div className="border-t pt-1">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Export list as
                  </div>
                  <button
                    onClick={handleExportToExcel}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span className="text-lg">📊</span>
                    <div>
                      <div className="font-medium">Excel</div>
                      <div className="text-xs text-gray-500">Export to Excel spreadsheet</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={handleExportToSheets}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span className="text-lg">📈</span>
                    <div>
                      <div className="font-medium">Sheets</div>
                      <div className="text-xs text-gray-500">Export to Google Sheets</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={handleExportToPages}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span className="text-lg">📄</span>
                    <div>
                      <div className="font-medium">Pages</div>
                      <div className="text-xs text-gray-500">Export to Apple Pages</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ADD BUTTON */}
          <div className="relative">
            <button
              onClick={() => {
                setShowAddMenu(v => !v)
                setShowImportExportMenu(false)
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg text-gray-600 hover:bg-gray-50 transition-colors"
              title="Add"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
            </button>
            
            {/* ADD MENÜ */}
            {showAddMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white border rounded-lg shadow-lg z-50 min-w-48">
                <button
                  onClick={() => {
                    setShowAddContact(true)
                    setShowAddMenu(false)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-2 transition-colors"
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
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-2 border-t transition-colors"
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

          {/* MÜLLLEIMER BUTTON */}
          <button
            onClick={() => {
              if (isDeletingMode && selectedItems.length > 0) {
                handleDeleteSelected()
                // Lösch-Modus bleibt aktiv nach Löschung
              } else {
                setIsDeletingMode(!isDeletingMode)
                if (!isDeletingMode) {
                  setSelectedItems([])
                }
              }
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
              isDeletingMode 
                ? 'bg-red-500 text-white shadow-sm' 
                : 'text-gray-600 hover:bg-gray-50'
  }`}
            title={isDeletingMode ? 
              selectedItems.length > 0 ? 
                `Delete ${selectedItems.length} selected items` : 
                "Exit delete mode" 
              : "Enter delete mode"
            }
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
          </button>

          <button className="rounded bg-black text-white px-4 py-2 text-sm hover:bg-gray-800 transition-colors">
            Scan Sent Mails
          </button>
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
              onDeleteCategory={() => {}} // Wird jetzt in handleDeleteSelected gehandhabt
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
            />
          ))}

          {/* UNCATEGORIZED (nur anzeigen wenn Kontakte vorhanden) */}
          {hasUncategorizedContacts && (
            <div
              className="border rounded"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                if (isDeletingMode) return
                const contactId = e.dataTransfer.getData("contact")
                if (!contactId) return

                handleDragContactToUncategorized(contactId)
              }}
            >
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase border-b bg-gray-50">
                Uncategorized
              </div>

              {filterContacts(
                contacts.filter(c => !c.categoryId),
                search
              ).map(contact => (
                <div key={contact.id} className="relative">
                  {/* AUSWAHL CHECKBOX für Kontakte (nur im Delete Mode) */}
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
                  />
                </div>
              ))}
            </div>
          )}

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
      <ManualDraftSource 
        isDeletingMode={isDeletingMode}
        setManualDrafts={setManualDrafts}
      />
    </div>
  )
}