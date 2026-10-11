
import { useId, useRef, useState } from 'react'

interface TagEditorProps {
  tags: string[]
  availableTags: string[]
  onChange: (tags: string[]) => void
  maxTags?: number
}

function normalizeTag(value: string): string {
  return value.trim().replace(/^#+/, '').trim()
}

export function TagEditor({
  tags,
  availableTags,
  onChange,
  maxTags = 3,
}: TagEditorProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const existingTags = new Map<string, string>()

  for (const rawTag of availableTags) {
    const tag = normalizeTag(rawTag)
    const key = tag.toLowerCase()

    if (tag && !existingTags.has(key)) {
      existingTags.set(key, tag)
    }
  }

  const normalizedQuery = normalizeTag(query)
  const queryLower = normalizedQuery.toLowerCase()

  const suggestions = [...existingTags.values()]
    .filter(
      (tag) =>
        tag.toLowerCase().includes(queryLower) &&
        !tags.some(
          (selected) =>
            selected.toLowerCase() ===
            tag.toLowerCase(),
        ),
    )
    .sort((a, b) => a.localeCompare(b))

  const canAddMore = tags.length < maxTags

  const showSuggestions =
    isOpen &&
    canAddMore &&
    suggestions.length > 0

  function addTag(value: string) {
    const normalized = normalizeTag(value)

    if (!normalized || !canAddMore) {
      return
    }

    const existing =
      existingTags.get(normalized.toLowerCase())

    const tag = existing ?? normalized

    const alreadySelected = tags.some(
      (selected) =>
        selected.toLowerCase() ===
        tag.toLowerCase(),
    )

    if (!alreadySelected) {
      onChange([...tags, tag])
    }

    setQuery('')
    setActiveIndex(0)
    setIsOpen(true)
    inputRef.current?.focus()
  }

  function removeTag(tag: string) {
    onChange(
      tags.filter((selected) => selected !== tag),
    )
  }

  return (
    <div
      className="task-creator__tag-picker"
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(
            event.relatedTarget,
          )
        ) {
          setIsOpen(false)
        }
      }}
    >
      <div className="task-creator__tag-input">
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Add or search tags"
          aria-label="Add or search tags"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={listId}
          disabled={!canAddMore}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
            setIsOpen(true)
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'ArrowDown' &&
              suggestions.length > 0
            ) {
              event.preventDefault()
              setIsOpen(true)
              setActiveIndex((index) =>
                Math.min(index + 1, suggestions.length - 1),
              )
            }

            if (
              event.key === 'ArrowUp' &&
              suggestions.length > 0
            ) {
              event.preventDefault()
              setActiveIndex((index) =>
                Math.max(index - 1, 0),
              )
            }

            if (event.key === 'Escape') {
              setIsOpen(false)
            }

            if (event.key === 'Enter') {
              event.preventDefault()

              const suggestedTag =
                showSuggestions
                  ? suggestions[activeIndex]
                  : undefined

              addTag(suggestedTag ?? query)
            }
          }}
        />

        <button
          type="button"
          className="task-creator__tag-add"
          disabled={
            !canAddMore ||
            !normalizedQuery
          }
          onClick={() => addTag(query)}
        >
          Add
        </button>
      </div>

      {showSuggestions && (
        <div
          id={listId}
          className="task-creator__tag-suggestions"
          role="listbox"
          aria-label="Existing project tags"
        >
          {suggestions.map((tag, index) => (
            <button
              key={tag.toLowerCase()}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={
                index === activeIndex
                  ? 'task-creator__tag-option task-creator__tag-option--active'
                  : 'task-creator__tag-option'
              }
              onMouseDown={(event) =>
                event.preventDefault()
              }
              onClick={() => addTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {tags.length > 0 && (
        <div className="task-creator__tags">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="task-creator__tag"
              title={`Remove ${tag}`}
              onClick={() => removeTag(tag)}
            >
              {tag} ×
            </button>
          ))}
        </div>
      )}

      <small>
        {tags.length}/{maxTags} tags
      </small>
    </div>
  )
}
