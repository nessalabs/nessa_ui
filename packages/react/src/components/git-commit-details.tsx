"use client"

import * as React from "react"
import { FileText } from "lucide-react"
import { Badge } from "./badge"
import { Button } from "./button"
import { DiffStat, FileDiffPath, FileDiffCard, FileDiffList, FileDiffListItem } from "./file-diff-list"
import type { GitCommit } from "./git-history/git-history-layout"
import { cn } from "@/lib/utils"

export interface GitChangedFile {
  path: string
  /** Git status, including optional rename/copy similarity score (for example R100). */
  status: string
  previousPath?: string
  /** Null means binary/unavailable, not zero. */
  additions: number | null
  deletions: number | null
}

export interface GitCommitResource {
  id: string
  /** Host-defined kind, such as Agent session, Plan or Pull request. */
  kind: string
  title: string
  description?: string
}

export interface GitCommitDetailsData extends GitCommit {
  email?: string
  body?: string
  /** Undefined means not loaded; an empty array means no changed files. Merge diffs should state the comparison base. */
  files?: readonly GitChangedFile[]
  comparisonLabel?: string
  /** Application-owned associations; these are not inferred from Git history. */
  resources?: readonly GitCommitResource[]
}

export interface GitCommitDetailsProps extends Omit<React.ComponentProps<"aside">, "onSelect"> {
  /** Null renders nothing, releasing the sidebar space. */
  commit: GitCommitDetailsData | null
  onFileSelect?: (file: GitChangedFile, commit: GitCommitDetailsData) => void
  onResourceSelect?: (resource: GitCommitResource, commit: GitCommitDetailsData) => void
  onOpenCommit?: (commit: GitCommitDetailsData) => void
  onClose?: () => void
  /** Window the changed-file rows by default. */
  virtualize?: boolean
  /** Changed-file viewport height in CSS pixels. Defaults to 280. */
  filesHeight?: number
}

/** A standalone commit inspector with metadata, changed files and host-linked sessions/plans. Hosts load details on selection and own navigation; no Git or network I/O occurs here. */
export function GitCommitDetails({ commit, onFileSelect, onResourceSelect, onOpenCommit, onClose, virtualize = true, filesHeight = 280, className, ...props }: GitCommitDetailsProps) {
  const titleId = React.useId()
  const files = commit?.files
  const totals = files?.reduce((sum, file) => ({ additions: sum.additions + (file.additions ?? 0), deletions: sum.deletions + (file.deletions ?? 0) }), { additions: 0, deletions: 0 })
  if (!commit) return null
  return (
    <aside {...props} aria-labelledby={titleId} data-slot="git-commit-details" className={cn("min-w-0 overflow-auto rounded-lg border border-border bg-background font-sans nessa-text-3 text-foreground", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-border p-4">
        <h2 id={titleId} className="font-medium">Commit details</h2>
        {onClose && <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>}
      </header>
      <>
        <section aria-label="Commit metadata" className="space-y-3 border-b border-border p-4">
          <div className="font-medium break-words">{commit.author}</div>
          {commit.email && <div className="break-all nessa-text-2 text-muted-foreground">{commit.email}</div>}
          <div className="break-words nessa-text-2 text-muted-foreground">{Number.isNaN(Date.parse(commit.date)) ? commit.date : new Date(commit.date).toISOString().slice(0, 16).replace("T", " ") + " UTC"}</div>
          <code className="block truncate nessa-text-2 text-muted-foreground" title={commit.hash}>{commit.hash}</code>
          {!!commit.refs?.length && <div className="flex flex-wrap gap-1">{commit.refs.map((ref) => <Badge key={ref} variant="outline" className="max-w-full justify-start truncate nessa-text-2" title={ref}>{ref}</Badge>)}</div>}
          <h3 className="font-medium break-words">{commit.subject}</h3>
          {commit.body && <p className="whitespace-pre-wrap break-words text-muted-foreground">{commit.body}</p>}
          <div className="break-all nessa-text-2 text-muted-foreground" title={commit.parents.join(", ")}>Parents: {commit.parents.length ? commit.parents.map((parent) => parent.slice(0, 7)).join(", ") : "None (root commit)"}</div>
        </section>
        <section aria-label="Changed files">
          <div className="space-y-1 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{files ? `${files.length} changed files` : "Changed files"}</h3>{totals && <DiffStat {...totals} />}</div>
            {commit.comparisonLabel && <p className="nessa-text-2 text-muted-foreground">{commit.comparisonLabel}</p>}
            {files?.some((file) => file.additions === null || file.deletions === null) && <p className="nessa-text-2 text-muted-foreground">Line totals exclude binary or unavailable counts.</p>}
          </div>
          {!files ? <p role="status" className="px-4 pb-4 text-muted-foreground">File changes have not been loaded.</p> : files.length === 0 ? <p className="px-4 pb-4 text-muted-foreground">No file changes in this comparison.</p> : <FileDiffCard expanded itemCount={files.length} className="rounded-none border-0 bg-transparent shadow-none"><FileDiffList aria-label="Changed files" rowHeight={48} height={filesHeight} virtualize={virtualize} style={{ maxHeight: filesHeight }}>
            {files.map((file) => {
              const statusLabel = ({ A: "Added", M: "Modified", D: "Deleted", R: "Renamed", C: "Copied", T: "Type changed", U: "Unmerged" } as Record<string, string>)[file.status[0] ?? ""] ?? file.status
              const content = <><FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><span className="sr-only">{statusLabel} file. </span><span className="flex min-w-0 flex-1 flex-col items-start"><FileDiffPath path={file.path.slice(file.path.lastIndexOf("/") + 1)} className="max-w-full nessa-text-2" /><span className="max-w-full truncate nessa-text-1 font-normal text-muted-foreground">{file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "Repository root"}</span></span>{file.additions === null || file.deletions === null ? <span className="shrink-0 nessa-text-2 text-muted-foreground">Binary / n/a</span> : <DiffStat additions={file.additions} deletions={file.deletions} />}</>
              const title = file.previousPath ? `${file.previousPath} → ${file.path}` : file.path
              return <FileDiffListItem key={file.path} className="grid-cols-1 px-3 py-1">{onFileSelect ? <Button variant="ghost" className="h-full w-full min-w-0 justify-start px-1 py-0" title={`${statusLabel}: ${title}`} aria-label={`View changes: ${title}`} onClick={() => onFileSelect(file, commit)}>{content}</Button> : <div className="flex h-full min-w-0 items-center gap-2" title={`${statusLabel}: ${title}`}>{content}</div>}</FileDiffListItem>
            })}
          </FileDiffList></FileDiffCard>}
        </section>
        {!!commit.resources?.length && <section aria-label="Linked work" className="space-y-2 border-t border-border p-4"><h3 className="font-medium">Linked work</h3>{commit.resources.map((resource) => <div key={resource.id} className="min-w-0 space-y-1"><div className="nessa-text-2 text-muted-foreground">{resource.kind}</div>{onResourceSelect ? <Button variant="link" className="h-auto max-w-full justify-start whitespace-normal py-1 text-left break-words" onClick={() => onResourceSelect(resource, commit)}>{resource.title}</Button> : <div className="break-words">{resource.title}</div>}{resource.description && <p className="break-words nessa-text-2 text-muted-foreground">{resource.description}</p>}</div>)}</section>}
        {onOpenCommit && <footer className="border-t border-border p-4"><Button variant="outline" className="w-full" onClick={() => onOpenCommit(commit)}>View commit</Button></footer>}
      </>
    </aside>
  )
}
