import { useState } from 'react';

import { Button } from './ui/button';
import { Input } from './ui/input';

/**
 * Reusable field-editing control (Task 10). Given an entity id, a field
 * name, and that field's current (projected) value, lets a user submit a
 * new value over `window.nayose.entities.editField`.
 *
 * Editing NEVER mutates or deletes the prior assertion — the IPC handler
 * behind this component (`entity:editField`, in
 * ../../main/ipc/entity-handlers.ts) only ever appends a new user-asserted
 * assertion via `appendAssertion`. This component does not fetch the
 * current value itself; whatever composes it (e.g. a future entity-detail
 * view) is responsible for reading the projected value (via
 * `projectField`/`getFieldHistory` on the main side) and passing it in.
 *
 * `TValue` is generic and defaults to `unknown` to match the assertion
 * log's `value` field, since fields can hold strings, numbers, Fraction
 * objects, arrays, etc. — not just strings. Because this component's input
 * control is a single text field, callers whose field values are not
 * already strings should supply `formatValue`/`parseValue` to
 * serialize/deserialize between the field's real type and the text the
 * user edits; both default to identity string pass-through for plain
 * string fields (the common case, e.g. a Work's title).
 */
export interface FieldEditorProps<TValue = unknown> {
  entityId: string;
  fieldName: string;
  currentValue: TValue;
  /** Render the current value into the text the user edits. Defaults to `String(currentValue ?? '')`. */
  formatValue?: (value: TValue) => string;
  /** Parse the user's submitted text back into the field's real value type. Defaults to identity (returns the raw string). */
  parseValue?: (raw: string) => TValue;
  /** Called after a successful edit, with the id of the newly appended assertion. */
  onSaved?: (assertionId: string) => void;
  /** Optional label override; defaults to the raw `fieldName`. */
  label?: string;
}

export function FieldEditor<TValue = unknown>({
  entityId,
  fieldName,
  currentValue,
  formatValue,
  parseValue,
  onSaved,
  label,
}: FieldEditorProps<TValue>): JSX.Element {
  const defaultFormat = (value: TValue): string => (value === undefined || value === null ? '' : String(value));
  const defaultParse = (raw: string): TValue => raw as unknown as TValue;

  const format = formatValue ?? defaultFormat;
  const parse = parseValue ?? defaultParse;

  const [draft, setDraft] = useState<string>(format(currentValue));
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputId = `field-editor-${entityId}-${fieldName}`;

  const handleSubmit = async (): Promise<void> => {
    setIsSubmitting(true);
    setStatus('');
    try {
      const result = await window.nayose.entities.editField({
        entityId,
        fieldName,
        value: parse(draft),
      });
      if (result.ok) {
        setStatus('Saved');
        onSaved?.(result.id);
      } else {
        setStatus(`Error: ${result.error.message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-2"
      data-testid="field-editor"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <label className="flex flex-col gap-2 text-sm text-fg-tertiary" htmlFor={inputId}>
        {label ?? fieldName}
        <Input id={inputId} value={draft} onChange={(event) => setDraft(event.target.value)} />
      </label>
      <Button type="submit" size="sm" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save'}
      </Button>
      {status ? (
        <p className="text-sm text-fg-tertiary" data-testid="field-editor-status">
          {status}
        </p>
      ) : null}
    </form>
  );
}
