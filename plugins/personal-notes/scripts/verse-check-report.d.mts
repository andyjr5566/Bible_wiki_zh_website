export interface VerseReport {
  v?: number
  checkedAt?: string
  total: number
  problems: { slug: string; book: string; chapter: number; messages: string[] }[]
}
export interface OpenIssue {
  number: number
  body?: string
  title?: string
}
export type IssueDecision =
  | { action: "create"; title: string; body: string }
  | { action: "update"; number: number; body: string }
  | { action: "close"; number: number; comment: string }
  | { action: "none"; reason?: string }
export const ISSUE_TITLE: string
export const CLOSE_COMMENT: string
export const DEFAULT_REPORT: string
export function warningLines(report: VerseReport): string[]
export function summaryMarkdown(report: VerseReport): string
export function issueBody(report: VerseReport): string
export function decideAction(report: VerseReport, openIssue: OpenIssue | null): IssueDecision
export function applyAction(decision: IssueDecision, gh: (args: string[], input?: string) => string): void
export function findOpenIssue(issues: unknown): OpenIssue | null
