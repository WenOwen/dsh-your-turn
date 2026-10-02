/** Field-local automatic writes, serialized so fast clicks cannot be lost by an in-flight save. */
import { SettingsFormModel, type SettingsFieldSpec } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { YourTurnConfig } from '../shared/settings.ts'
import type { SettingsFormView } from './SettingsPage.tsx'
import { Observable } from './observable.ts'

type Edit = { field: string; text?: string; version: number }
type Op = Parameters<ConfigForm<Partial<YourTurnConfig>>['mutate']>[0][number]
type Write = { edits: Edit[]; ops: Op[] }

export class ImmediateSettings {
  readonly view: Observable<SettingsFormView>
  readonly actions = {
    edit: (field: string, text: string): void => this.edit(field, text),
    resetField: (field: string): void => this.reset([field]),
    resetAll: (): void => this.reset(this.specs.map(spec => spec.field)),
  }
  private readonly model: SettingsFormModel<Partial<YourTurnConfig>>
  private readonly drafts = new Map<string, Edit>()
  private readonly pending = new Map<string, Write>()
  private readonly failed = new Set<string>()
  private readonly unsubscribe: () => void
  private version = 0
  private savedVersion = 0
  private writing = false
  private disposed = false
  constructor(private readonly scope: ConfigForm<Partial<YourTurnConfig>>, private readonly specs: readonly SettingsFieldSpec[]) {
    this.model = new SettingsFormModel(scope, [...specs])
    const bound = this.model.bind<SettingsFormView>(() => this.project())
    this.view = new Observable(bound.getSnapshot())
    this.unsubscribe = bound.subscribe(() => this.publish())
  }
  private project(): SettingsFormView {
    return {
      shell: { ...this.model.shell(), saving: this.writing, failed: this.failed.size > 0 },
      savedVersion: this.savedVersion,
      fields: Object.fromEntries(this.specs.map(spec => [spec.field, this.model.field(spec.field)])),
    }
  }
  private publish(): void { if (!this.disposed) this.view.set(this.project()) }
  private edit(field: string, text: string): void {
    if (this.disposed || !this.scope.getSnapshot().writable) return
    const spec = this.specs.find(spec => spec.field === field)
    if (spec === undefined) return
    const edit = { field, text, version: ++this.version }
    this.drafts.set(field, edit)
    this.failed.delete(field)
    this.model.actions().edit(field, text)
    // Invalid text belongs only to this control; it must not block other switches.
    const parsed = spec.parse(text)
    this.pending.delete(field)
    if (parsed !== undefined) {
      const op: Op = parsed.kind === 'clear' ? { op: 'unset', path: [field] } : { op: 'set', path: [field], value: parsed.value }
      this.pending.set(field, { edits: [edit], ops: [op] })
    }
    this.publish()
    void this.flush()
  }
  private reset(fields: readonly string[]): void {
    if (this.disposed || !this.scope.getSnapshot().writable) return
    const edits = fields.map(field => ({ field, version: ++this.version }))
    for (const edit of edits) {
      this.drafts.set(edit.field, edit)
      this.pending.delete(edit.field)
      this.failed.delete(edit.field)
      this.model.actions().resetField(edit.field)
    }
    this.pending.set(fields.length === 1 ? fields[0]! : '@resetAll', { edits, ops: fields.map(field => ({ op: 'unset', path: [field] })) })
    this.publish()
    void this.flush()
  }
  private rebase(): void {
    this.model.actions().discard()
    for (const edit of this.drafts.values()) {
      if (edit.text === undefined) this.model.actions().resetField(edit.field)
      else this.model.actions().edit(edit.field, edit.text)
    }
  }
  private async flush(): Promise<void> {
    if (this.writing || this.disposed || this.pending.size === 0) return
    this.writing = true
    this.publish()
    try {
      while (!this.disposed && this.pending.size > 0) {
        const [key, write] = this.pending.entries().next().value!
        this.pending.delete(key)
        let accepted = false
        try {
          const snapshot = this.scope.getSnapshot()
          if (snapshot.writable) accepted = await this.scope.mutate(write.ops, snapshot.revision)
        } catch (error) { console.warn('[dsh-your-turn] automatic settings write failed', error) }
        if (this.disposed) break
        if (accepted) this.savedVersion++
        for (const edit of write.edits) {
          if (this.drafts.get(edit.field)?.version !== edit.version) continue
          if (accepted) { this.drafts.delete(edit.field); this.failed.delete(edit.field) }
          else this.failed.add(edit.field)
        }
        this.rebase()
        this.publish()
      }
    } finally { this.writing = false; this.publish() }
  }
  dispose(): void {
    this.disposed = true
    this.pending.clear()
    this.unsubscribe()
    this.model.dispose()
  }
}
