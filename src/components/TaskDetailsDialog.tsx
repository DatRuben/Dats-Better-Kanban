import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import type { Attachment, BoardColumn, DemoUser, Task } from '../types/board'
import { getStoredGoogleAccessToken } from '../auth/googleAuth'
import { downloadAttachmentFromDrive } from '../storage/googleDriveApi'
import {
  getAttachmentTypeLabel,
  isGlbFileName,
  isPreviewableMedia,
} from '../utility/attachmentTypes'
import './taskDetailsMedia.css'

const GlbPreview = lazy(async () => {
  const module = await import('./GlbPreview')
  return { default: module.GlbPreview }
})

type LoadAttachment = (fileId: string) => Promise<Blob | null>

interface TaskDetailsDialogProps {
  task: Task | null
  members: DemoUser[]
  columns: BoardColumn[]
  onClose: () => void
}

interface AttachmentResult {
  key: string
  url: string | null
  error: string | null
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDeadline(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

async function loadAttachment(fileId: string): Promise<Blob> {
  const token = getStoredGoogleAccessToken()
  if (!token) {
    throw new Error('Google Drive session expired. Reconnect to view this file.')
  }
  return downloadAttachmentFromDrive(token, fileId)
}

function AttachmentMedia({ attachment }: { attachment: Attachment }) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<AttachmentResult | null>(null)
  const key = `${attachment.id}:${attachment.driveFileId ?? ''}:${attempt}`

  useEffect(() => {
    if (attachment.previewUrl || !attachment.driveFileId) return

    let cancelled = false
    let objectUrl: string | null = null

    void loadAttachment(attachment.driveFileId)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setResult({ key, url: objectUrl, error: null })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setResult({
          key,
          url: null,
          error: error instanceof Error ? error.message : 'Could not load media.',
        })
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment.driveFileId, attachment.previewUrl, key])

  const url = attachment.previewUrl ?? (result?.key === key ? result.url : null)
  const error = !attachment.previewUrl && !attachment.driveFileId
    ? 'This attachment has no Drive file reference.'
    : result?.key === key ? result.error : null

  if (url) {
    return attachment.mimeType === 'video/mp4' ? (
      <video className="task-details-media__content" controls playsInline preload="metadata" src={url} />
    ) : (
      <img className="task-details-media__content" src={url} alt={attachment.fileName} />
    )
  }

  return (
    <div className="task-details-media__status">
      <span>{error ?? 'Loading media…'}</span>
      {error && attachment.driveFileId && (
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Retry
        </button>
      )}
    </div>
  )
}

export function TaskDetailsDialog({ task, members, columns, onClose }: TaskDetailsDialogProps) {
  const [openModelId, setOpenModelId] = useState<string | null>(null)
  const loadModel = useCallback<LoadAttachment>(loadAttachment, [])

  useEffect(() => {
    if (!task) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [task, onClose])

  if (!task) return null

  const assignee = members.find((member) => member.id === task.assigneeId) ?? null
  const column = columns.find((item) => item.id === task.columnId) ?? null

  return (
    <div className="task-details-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="task-details-dialog" role="dialog" aria-modal="true" aria-labelledby="task-details-title">
        <header className="task-details-dialog__header">
          <div>
            <p className="task-details-dialog__section">{column?.title ?? 'Unknown section'}</p>
            <h2 id="task-details-title">{task.title}</h2>
          </div>
          <button type="button" className="task-details-dialog__close" onClick={onClose} aria-label="Close task details">×</button>
        </header>

        <div className="task-details-dialog__metadata">
          <div><span>Priority</span><strong className={`timeline-item__priority timeline-item__priority--${task.priority}`}>{task.priority}</strong></div>
          <div><span>Deadline</span><strong>{task.deadline ? formatDeadline(task.deadline) : 'No deadline'}</strong></div>
          <div><span>Assignee</span><strong>{assignee?.displayName ?? 'Unassigned'}</strong></div>
          <div><span>Status</span><strong>{column?.countsAsCompleted ? 'Completed' : column?.title ?? 'Unknown'}</strong></div>
        </div>

        <div className="task-details-dialog__section-block">
          <h3>Description</h3>
          <p>{task.description.trim() ? task.description : 'No description.'}</p>
        </div>

        <div className="task-details-dialog__section-block">
          <h3>Tags</h3>
          {(task.tags?.length ?? 0) > 0 ? (
            <div className="task-details-dialog__tags">
              {task.tags?.map((tag) => <span key={tag} className="task-card__tag">{tag}</span>)}
            </div>
          ) : <p>No tags.</p>}
        </div>

        <div className="task-details-dialog__section-block">
          <h3>Attachments ({task.attachments.length})</h3>
          {task.attachments.length === 0 ? <p>No attachments.</p> : (
            <div className="task-details-dialog__attachments">
              {task.attachments.map((attachment) => {
                const isGlb = isGlbFileName(attachment.fileName)
                const isModelOpen = openModelId === attachment.id
                return (
                  <div key={attachment.id} className="task-details-dialog__attachment task-details-media">
                    <div className="task-details-media__heading">
                      <div className="task-details-media__filename">
                        <strong>{attachment.fileName}</strong>
                        <span>{getAttachmentTypeLabel(attachment.fileName, attachment.mimeType)}</span>
                      </div>
                      {isGlb && (
                        <button type="button" className="task-details-media__button" onClick={() => setOpenModelId(isModelOpen ? null : attachment.id)}>
                          {isModelOpen ? 'Close 3D' : 'Preview 3D'}
                        </button>
                      )}
                    </div>
                    {isPreviewableMedia(attachment.mimeType) && (
                      <AttachmentMedia key={attachment.id} attachment={attachment} />
                    )}
                    {isGlb && isModelOpen && (
                      <Suspense fallback={<div className="task-details-media__status">Loading 3D viewer…</div>}>
                        <GlbPreview
                          key={attachment.id}
                          attachment={attachment}
                          onLoadAttachment={loadModel}
                          onClose={() => setOpenModelId(null)}
                        />
                      </Suspense>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <footer className="task-details-dialog__footer">
          <span>Created {formatDateTime(task.createdAt)}</span>
          <span>Updated {formatDateTime(task.updatedAt)}</span>
          {task.completedAt && <span>Completed {formatDateTime(task.completedAt)}</span>}
        </footer>
      </section>
    </div>
  )
}
