import { useState } from 'react';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';

type EntityTab = 'party' | 'work' | 'recording' | 'release';

const TABS: Array<{ id: EntityTab; label: string }> = [
  { id: 'party', label: 'Party' },
  { id: 'work', label: 'Work' },
  { id: 'recording', label: 'Recording' },
  { id: 'release', label: 'Release' },
];

/**
 * Manual entity-creation view (Task 8): lets a user create a Party, Work,
 * Recording, or Release by hand against the currently-open vault, over
 * `window.nayose.entities`. This is create-only — no editing (Task 10), no
 * provenance display (Task 11), and no catalog browsing (Task 9); a minimal
 * "created, here's its id" confirmation is all that's required here.
 */
export function EntityCreateView(): JSX.Element {
  const [activeTab, setActiveTab] = useState<EntityTab>('party');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (): Promise<void> => {
    setIsSubmitting(true);
    setStatus('');
    try {
      switch (activeTab) {
        case 'party': {
          const result = await window.nayose.entities.createParty({ displayName: title || undefined });
          setStatus(result.ok ? `Created Party ${result.id}` : `Error: ${result.error.message}`);
          break;
        }
        case 'work': {
          const result = await window.nayose.entities.createWork({ title: title || undefined });
          setStatus(result.ok ? `Created Work ${result.id}` : `Error: ${result.error.message}`);
          break;
        }
        case 'recording': {
          const result = await window.nayose.entities.createRecording({ title: title || undefined });
          setStatus(result.ok ? `Created Recording ${result.id}` : `Error: ${result.error.message}`);
          break;
        }
        case 'release': {
          const result = await window.nayose.entities.createRelease({ title: title || undefined });
          setStatus(result.ok ? `Created Release ${result.id}` : `Error: ${result.error.message}`);
          break;
        }
      }
      setTitle('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldLabel = activeTab === 'party' ? 'Display name' : 'Title';

  return (
    <Card data-testid="entity-create-view">
      <CardHeader>
        <CardTitle>Create entity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-2">
          {TABS.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant={activeTab === tab.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setActiveTab(tab.id);
                setStatus('');
              }}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <label className="flex flex-col gap-2 text-sm text-fg-tertiary" htmlFor="entity-create-field">
            {fieldLabel}
            <Input
              id="entity-create-field"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={fieldLabel}
            />
          </label>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : `Create ${TABS.find((tab) => tab.id === activeTab)?.label}`}
          </Button>
        </form>

        {status ? (
          <p className="mt-4 text-sm text-fg-tertiary" data-testid="entity-create-status">
            {status}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
