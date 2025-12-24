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

function getContactStatus(lastSentAt?: string, priorityAfterDays = 30) {
  if (!lastSentAt) return "bg-gray-100"
  
  const days = (Date.now() - new Date(lastSentAt).getTime()) / (1000 * 60 * 60 * 24)
  
  if (days >= priorityAfterDays) return "bg-red-50 border-l-4 border-red-500"
  if (days >= priorityAfterDays * 0.6) return "bg-orange-50 border-l-4 border-orange-400"
  if (days >= priorityAfterDays * 0.3) return "bg-yellow-50 border-l-4 border-yellow-400"
  return "bg-green-50 border-l-4 border-green-400"
}

/* ================= DRAGGABLE MANUAL CARD ================= */

function DraggableManualCard({ 
  isDragging, 
  setManualDrafts,
  onDragStart
}: { 
  isDragging: boolean
  setManualDrafts: React.Dispatch<React.SetStateAction<ManualDraft[]>>
  onDragStart: (draft: ManualDraft) => void
}) {
  if (isDragging) return null

  const handleDragStart = (e: React.DragEvent) => {
    const draft: ManualDraft = {
      id: generateId(),
      sentAt: new Date().toISOString()
    }
    onDragStart(draft)
    e.dataTransfer.setData("manualDraft", draft.id)
    
    // Füge visuelles Feedback hinzu
    const dragImage = e.currentTarget.cloneNode(true) as HTMLElement
    dragImage.style.opacity = "0.7"
    dragImage.style.transform = "rotate(5deg)"
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, 50, 12)
    
    setTimeout(() => document.body.removeChild(dragImage), 0)
  }

  return (
    <div className="fixed bottom-8 right-8 z-40">
      <div className="relative">
        {/* Untere Karten als Schatten */}
        <div className="absolute inset-0 rounded border bg-gray-300 translate-x-1 translate-y-1" />
        <div className="absolute inset-0 rounded border bg-gray-200 translate-x-0.5 translate-y-0.5" />
        
        {/* Obere draggable Karte */}
        <div
          draggable
          onDragStart={handleDragStart}
          className="relative w-28 h-20 rounded border bg-white flex items-center justify-center text-xs font-semibold text-gray-600 cursor-grab active:cursor-grabbing hover:shadow-lg transition-all duration-200 hover:-translate-y-1 active:scale-95"
          style={{ transform: 'translate(0, 0) rotate(0deg)' }}
        >
          DRAG ME
        </div>
      </div>
    </div>
  )
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
  const [isAnimating, setIsAnimating] = useState(false)

  const handleDelete = () => {
    setIsAnimating(true)
    setTimeout(() => {
      onDeleteMail?.()
      setIsAnimating(false)
    }, 300)
  }

  return (
    <div className={`min-w-[160px] rounded border bg-white px-2 py-2 text-[11px] relative group transition-all duration-300 ${
      isAnimating ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
    }`}>
      {/* LÖSCH-KREUZ */}
      {isDeleting && onDeleteMail && (
        <button
          onClick={handleDelete}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] z-10 hover:bg-red-600 transition-transform hover:scale-110"
          title="Delete this mail"
        >
          ✕
        </button>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] text-gray-500">
          {new Date(mail.sentAt).toLocaleDateString()}
        </div>

        {/* NOTIZ BUTTON */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="text-gray-500 hover:text-gray-800 transition-colors"
          title="Add note"
        >
          <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" 
            />
          </svg>
        </button>
      </div>

      <ul className="mt-1">
        {mail.attachments.map(att => (
          <li key={att.id} className="truncate text-gray-800">
            {att.filename}
          </li>
        ))}
      </ul>

      {/* NOTE AREA - jetzt als Modal/Popup */}
      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 w-96 max-w-[90vw] relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
            >
              ✕
            </button>
            <h3 className="font-medium mb-3">Add Note</h3>
            <textarea
              placeholder="Enter your note here..."
              value={mail.note ?? ""}
              onChange={e => onChangeNote(e.target.value)}
              className="w-full h-40 resize-none border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note preview */}
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
  isDeleting,
  onDropAnimation
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
  onDropAnimation?: () => void
}) {
  const lastSent = contact.sentMails.length > 0 ? contact.sentMails[0].sentAt : undefined
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [tempName, setTempName] = useState(contact.name)
  const [tempEmail, setTempEmail] = useState(contact.email)
  const [isDropTarget, setIsDropTarget] = useState(false)

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDropTarget(false)
    
    const draftId = e.dataTransfer.getData("manualDraft")
    if (!draftId) return

    setManualDrafts(prev =>
      prev.map(d =>
        d.id === draftId
          ? { ...d, contactId: contact.id }
          : d
      )
    )
    
    // Trigger animation
    onDropAnimation?.()
  }

  return (
    <div
      className={`grid grid-cols-[260px_1fr] hover:bg-gray-50 transition-all duration-200 ${
        getContactStatus(lastSent, priorityAfterDays)
      } ${isDropTarget ? 'bg-blue-50 border-blue-200' : ''}`}
      onDragOver={e => {
        e.preventDefault()
        if (!isDeleting) setIsDropTarget(true)
      }}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={handleDrop}
    >
      {/* LEFT */}
      <div className="sticky left-0 z-10 border-r flex">
        {isDeleting && onDeleteContact && (
          <button
            onClick={() => onDeleteContact(contact.id)}
            className="px-3 flex items-center text-red-500 hover:text-red-700 transition-colors"
            title="Delete this contact"
          >
            ✕
          </button>
        )}

        <div
          draggable={!isDeleting}
          onDragStart={e =>
            e.dataTransfer.setData("contact", contact.id)
          }
          className="px-2 flex items-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          title="Drag contact"
        >
          ⠿
        </div>

        <div
          className={`w-1 ${getStatusColor(lastSent, priorityAfterDays)}`}
        />

        <div className="px-4 py-2 flex-1">
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
        <div className="flex gap-2 px-3 py-2 items-center min-h-[60px]">
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
                className="min-w-[140px] rounded border border-dashed bg-white px-2 py-1 text-[11px] relative group transition-all duration-300"
              >
                {isDeleting && (
                  <button
                    onClick={() =>
                      setManualDrafts(prev =>
                        prev.filter(d => d.id !== draft.id)
                      )
                    }
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] z-10 hover:bg-red-600 transition-transform hover:scale-110"
                    title="Delete manual card"
                  >
                    ✕
                  </button>
                )}

                <div className="text-[10px] text-gray-500 mb-1">
                  {new Date(draft.sentAt).toLocaleDateString()}
                </div>

                <textarea
                  placeholder="Add note..."
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
                  className="w-full resize-none border-none p-0 focus:outline-none text-gray-700 text-[11px]"
                  rows={2}
                />
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

/* ================= CSV/IMPORT DROPDOWN ================= */

function CSVImportDropdown({ isDeletingMode }: { isDeletingMode: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCSVExport = () => {
    alert("CSV Export would be implemented here")
    setIsOpen(false)
  }

  const handleFileUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,.xlsx,.xls,.txt'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        alert(`File "${file.name}" selected for import. Implementation would parse the file and add contacts.`)
      }
    }
    input.click()
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !isDeletingMode && setIsOpen(!isOpen)}
        className={`w-10 h-10 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors ${
          isDeletingMode ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        title={isDeletingMode ? "Cannot export in delete mode" : "Import/Export"}
        disabled={isDeletingMode}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
          />
        </svg>
      </button>
      
      {isOpen && !isDeletingMode && (
        <div className="absolute right-0 top-full mt-2 bg-white border rounded-lg shadow-lg z-50 min-w-48">
          <button
            onClick={handleCSVExport}
            className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <div className="font-medium">CSV Export</div>
              <div className="text-xs text-gray-500">Download data as CSV</div>
            </div>
          </button>
          
          <button
            onClick={handleFileUpload}
            className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-2 border-t"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div>
              <div className="font-medium">File Upload</div>
              <div className="text-xs text-gray-500">Import contacts from file</div>
            </div>
          </button>
        </div>
      )}
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
    if (relatedTarget?.tagName === 'BUTTON' && relatedTarget.title === 'Clear search') {
      return
    }
    
    if (!search) {
      setIsExpanded(false)
    }
  }

  const handleClear = () => {
    setSearch("")
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      <div
        className={`flex items-center transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? "w-64" : "w-10"
        }`}
      >
        <button
          onClick={handleSearchClick}
          className={`w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors flex-shrink-0`}
          title="Search"
        >
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
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
          onChange={(e) => {
            const value = e.target.value
            setSearch(value)
            
            // Automatisch kürzen wenn zu lang
            if (value.length > 25) {
              setTimeout(() => {
                setSearch(value.substring(0, 25))
                inputRef.current?.setSelectionRange(25, 25)
              }, 0)
            }
          }}
          onBlur={handleBlur}
          onFocus={onFocus}
          placeholder="Search..."
          maxLength={25}
          className={`px-3 py-2 bg-transparent focus:outline-none transition-all duration-300 ${
            isExpanded ? "opacity-100 w-full" : "opacity-0 w-0"
          }`}
        />
      </div>

      {search && isExpanded && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          title="Clear search"
          tabIndex={-1}
        >
          ✕
        </button>
      )}
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

  const [manualDrafts, setManualDrafts] = useState<ManualDraft[]>([])
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isDeletingMode, setIsDeletingMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [darkMode, setDarkMode] = useState(false)
  const [isDraggingCard, setIsDraggingCard] = useState(false)
  const [dropAnimation, setDropAnimation] = useState(false)

  // ADD CONTACT
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContactName, setNewContactName] = useState("")
  const [newContactEmail, setNewContactEmail] = useState("")

  // ADD CATEGORY
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")

  // Refs for click outside
  const addMenuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const closeAllMenus = () => {
    setShowAddMenu(false)
    setShowUserMenu(false)
  }

  const handleSearchFocus = () => {
    closeAllMenus()
  }

  // Drag animation handlers
  const handleDragStart = (draft: ManualDraft) => {
    setIsDraggingCard(true)
    setManualDrafts(prev => [...prev, draft])
  }

  const handleDropAnimation = () => {
    setDropAnimation(true)
    setTimeout(() => setDropAnimation(false), 300)
  }

  // SCAN FUNCTION
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

  // Update functions
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
    setContacts(prev =>
      prev.map(contact =>
        contact.id === contactId
          ? { ...contact, name }
          : contact
      )
    )
  }

  const updateContactEmail = (contactId: string, email: string) => {
    setContacts(prev =>
      prev.map(contact =>
        contact.id === contactId
          ? { ...contact, email }
          : contact
      )
    )
  }

  const updateCategoryName = (categoryId: string, name: string) => {
    setCategories(prev =>
      prev.map(category =>
        category.id === categoryId
          ? { ...category, name }
          : category
      )
    )
  }

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

  const handleDeleteContact = (contactId: string) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      setContacts(prev => prev.filter(c => c.id !== contactId))
    }
  }

  const handleDragContactToCategory = (contactId: string, categoryId: string) => {
    setContacts(prev =>
      prev.map(c =>
        c.id === contactId
          ? { ...c, categoryId }
          : c
      )
    )
  }

  const handleDragContactToUncategorized = (contactId: string) => {
    setContacts(prev =>
      prev.map(c =>
        c.id === contactId
          ? { ...c, categoryId: null }
          : c
      )
    )
  }

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  const handleDeleteSelected = () => {
    if (selectedItems.length === 0) return
    
    const contactIds = selectedItems.filter(id => id.startsWith("contact_"))
    const categoryIds = selectedItems.filter(id => id.startsWith("category_"))
    
    let message = ""
    if (contactIds.length > 0 && categoryIds.length > 0) {
      message = `Delete ${contactIds.length} contact(s) and ${categoryIds.length} category(ies)? Contacts in categories will be moved to Uncategorized.`
    } else if (contactIds.length > 0) {
      message = `Delete ${contactIds.length} selected contact(s)?`
    } else if (categoryIds.length > 0) {
      message = `Delete ${categoryIds.length} selected category(ies)? Contacts will be moved to Uncategorized.`
    }
    
    if (confirm(message)) {
      if (contactIds.length > 0) {
        setContacts(prev => 
          prev.filter(c => !contactIds.includes(`contact_${c.id}`))
        )
      }
      
      if (categoryIds.length > 0) {
        const categoryIdsOnly = categoryIds.map(id => id.replace("category_", ""))
        setCategories(prev => prev.filter(c => !categoryIdsOnly.includes(c.id)))
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

  // USER MENU FUNKTIONEN
  const handleSettings = () => {
    alert("Settings would open here")
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

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
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
      <div className={`h-screen flex items-center justify-center text-sm ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
        Loading dashboard…
      </div>
    )
  }

  const hasUncategorizedContacts = contacts.filter(c => !c.categoryId).length > 0

  return (
    <div className={`h-screen flex flex-col ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}>
      {/* HEADER */}
      <header className={`flex items-center gap-4 px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="font-semibold text-lg">Audio Send Log</div>

        <div className="flex-1" />

        {/* BUTTONS GRUPPE */}
        <div className="flex items-center gap-3">
          {/* SUCHLEISTE */}
          <ExpandingSearchBar 
            search={search} 
            setSearch={setSearch}
            onFocus={handleSearchFocus}
          />

          {/* CSV/IMPORT DROPDOWN */}
          <CSVImportDropdown isDeletingMode={isDeletingMode} />

          {/* ADD BUTTON */}
          <div className="relative" ref={addMenuRef}>
            <button
              onClick={() => {
                if (isDeletingMode) return
                setShowAddMenu(v => !v)
                setShowUserMenu(false)
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-50'} transition-colors ${
                isDeletingMode ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title={isDeletingMode ? "Cannot add in delete mode" : "Add"}
              disabled={isDeletingMode}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            
            {/* ADD MENÜ */}
            {showAddMenu && !isDeletingMode && (
              <div className={`absolute right-0 top-full mt-2 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg shadow-lg z-50 min-w-48`}>
                <button
                  onClick={() => {
                    setShowAddContact(true)
                    setShowAddMenu(false)
                  }}
                  className={`w-full px-4 py-3 text-left ${darkMode ? 'hover:bg-gray-700 text-gray-100' : 'hover:bg-gray-50 text-gray-900'} flex items-center gap-2 transition-colors`}
                >
                  <svg viewBox="-1.6 -1.6 19.20 19.20" xmlns="http://www.w3.org/2000/svg" fill="currentColor" stroke="currentColor" strokeWidth="0.368" width="20" height="20">
                    <path d="m 8 1 c -1.65625 0 -3 1.34375 -3 3 s 1.34375 3 3 3 s 3 -1.34375 3 -3 s -1.34375 -3 -3 -3 z m -1.5 7 c -2.492188 0 -4.5 2.007812 -4.5 4.5 v 0.5 c 0 1.109375 0.890625 2 2 2 h 6 v -1 h -3 v -4 h 3 v -1.972656 c -0.164062 -0.019532 -0.332031 -0.027344 -0.5 -0.027344 z m 4.5 0 v 3 h -3 v 2 h 3 v 3 h 2 v -3 h 3 v -2 h -3 v -3 z m 0 0"/>
                  </svg>
                  <div>
                    <div className="font-medium">Add Contact</div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>New person to track</div>
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    setShowAddCategory(true)
                    setShowAddMenu(false)
                  }}
                  className={`w-full px-4 py-3 text-left border-t ${darkMode ? 'hover:bg-gray-700 text-gray-100 border-gray-700' : 'hover:bg-gray-50 text-gray-900 border-gray-200'} flex items-center gap-2 transition-colors`}
                >
                  <span className="text-lg">📁</span>
                  <div>
                    <div className="font-medium">Add Category</div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>New group for contacts</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* DELETE BUTTON */}
          <button
            onClick={() => {
              if (isDeletingMode && selectedItems.length > 0) {
                handleDeleteSelected()
              } else {
                setIsDeletingMode(!isDeletingMode)
                if (!isDeletingMode) {
                  setSelectedItems([])
                }
              }
              closeAllMenus()
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
              isDeletingMode 
                ? 'bg-red-500 text-white shadow-sm' 
                : darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-50'
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

          {/* USER MENU BUTTON */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => {
                if (isDeletingMode) return
                setShowUserMenu(v => !v)
                setShowAddMenu(false)
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-50'} transition-colors ${
                isDeletingMode ? 'opacity-50 cursor-not-allowed' : ''
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
              <div className={`absolute right-0 top-full mt-2 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg shadow-lg z-50 min-w-48`}>
                <button
                  onClick={handleSettings}
                  className={`w-full px-4 py-3 text-left ${darkMode ? 'hover:bg-gray-700 text-gray-100' : 'hover:bg-gray-50 text-gray-900'} flex items-center gap-2 transition-colors`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <div className="font-medium">Settings</div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>App settings and preferences</div>
                  </div>
                </button>
                
                <button
                  onClick={toggleDarkMode}
                  className={`w-full px-4 py-3 text-left ${darkMode ? 'hover:bg-gray-700 text-gray-100' : 'hover:bg-gray-50 text-gray-900'} flex items-center gap-2 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  <div>
                    <div className="font-medium">{darkMode ? 'Light Mode' : 'Dark Mode'}</div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Toggle theme</div>
                  </div>
                </button>
                
                <button
                  onClick={handleChangeAccount}
                  className={`w-full px-4 py-3 text-left ${darkMode ? 'hover:bg-gray-700 text-gray-100' : 'hover:bg-gray-50 text-gray-900'} flex items-center gap-2 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <div className="font-medium">Change Account</div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Switch to different account</div>
                  </div>
                </button>
                
                <button
                  onClick={handleLogout}
                  className={`w-full px-4 py-3 text-left ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} flex items-center gap-2 border-t ${darkMode ? 'border-gray-700 text-red-400' : 'border-gray-200 text-red-600'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <div>
                    <div className="font-medium">Log Out</div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Sign out of your account</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* SCAN BUTTON - einfarbig */}
          <button
            onClick={handleScanMails}
            disabled={scanning}
            className={`relative rounded-lg ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white px-6 py-2.5 text-sm font-medium transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed`}
          >
            {scanning ? (
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Scanning...</span>
              </div>
            ) : (
              <span>Scan Sent Mails</span>
            )}
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <main className={`flex-1 overflow-auto ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="min-w-[900px] px-4 py-4 space-y-8">
          {/* CATEGORIES */}
          {categories.map(category => (
            <div
              key={category.id}
              className={`border rounded ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                if (isDeletingMode) return
                const contactId = e.dataTransfer.getData("contact")
                if (!contactId) return
                handleDragContactToCategory(contactId, category.id)
              }}
            >
              <div className={`px-4 py-2 border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <div className="text-xs font-semibold uppercase">
                  {category.name}
                </div>
              </div>

              {filterContacts(
                contacts.filter(c => c.categoryId === category.id),
                search
              ).map(contact => (
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
                    onDropAnimation={handleDropAnimation}
                  />
                </div>
              ))}
            </div>
          ))}

          {/* UNCATEGORIZED */}
          {hasUncategorizedContacts && (
            <div
              className={`border rounded ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                if (isDeletingMode) return
                const contactId = e.dataTransfer.getData("contact")
                if (!contactId) return
                handleDragContactToUncategorized(contactId)
              }}
            >
              <div className={`px-4 py-2 border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <div className={`text-xs font-semibold uppercase ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Uncategorized
                </div>
              </div>

              {filterContacts(
                contacts.filter(c => !c.categoryId),
                search
              ).map(contact => (
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
                    onDropAnimation={handleDropAnimation}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ADD CONTACT MODAL */}
          {showAddContact && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className={`rounded-lg p-6 w-96 ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white'}`}>
                <h3 className="font-semibold mb-4">Add New Contact</h3>
                <input
                  type="text"
                  placeholder="Name"
                  value={newContactName}
                  onChange={e => setNewContactName(e.target.value)}
                  className={`w-full border rounded px-3 py-2 mb-3 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newContactEmail}
                  onChange={e => setNewContactEmail(e.target.value)}
                  className={`w-full border rounded px-3 py-2 mb-4 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddContact(false)}
                    className={`px-4 py-2 border rounded ${darkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddContact}
                    className={`px-4 py-2 rounded ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
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
              <div className={`rounded-lg p-6 w-96 ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white'}`}>
                <h3 className="font-semibold mb-4">Add New Category</h3>
                <input
                  type="text"
                  placeholder="Category name"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  className={`w-full border rounded px-3 py-2 mb-4 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddCategory(false)}
                    className={`px-4 py-2 border rounded ${darkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCategory}
                    className={`px-4 py-2 rounded ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* DRAGGABLE MANUAL CARD */}
      <DraggableManualCard 
        isDragging={isDraggingCard}
        setManualDrafts={setManualDrafts}
        onDragStart={handleDragStart}
      />
    </div>
  )
}