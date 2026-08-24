import { useState } from 'react';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { resolveCreateStatus, resolveOpenStatus, type VaultStatus } from './vault-lifecycle-logic';

const NO_STATUS: VaultStatus = { message: '', isError: false };

/**
 * Vault open/create/close view (Feature 2, Task 1): the renderer surface for
 * `window.nayose.vault.create/open/close`, which were already implemented
 * and wired by Feature 1 (see ../../main/ipc/vault-handlers.ts). This view
 * owns no vault state of its own beyond "which path (if any) is currently
 * open" for display — the actual in-memory session lives in the main
 * process (../../main/vault/vault-session.ts).
 */
export function VaultLifecycleView(): JSX.Element {
  const [openPath, setOpenPath] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<VaultStatus>(NO_STATUS);
  const [isBusy, setIsBusy] = useState(false);

  const handleCreate = async (): Promise<void> => {
    setIsBusy(true);
    try {
      const result = await window.nayose.vault.create();
      setStatus(resolveCreateStatus(result));
      if (result.ok) {
        setOpenPath(result.path);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleOpen = async (): Promise<void> => {
    setIsBusy(true);
    try {
      const result = await window.nayose.vault.open();
      setStatus(resolveOpenStatus(result));
      if (result.ok) {
        setOpenPath(result.path);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleClose = async (): Promise<void> => {
    setIsBusy(true);
    try {
      await window.nayose.vault.close();
      setOpenPath(undefined);
      setStatus(NO_STATUS);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Card data-testid="vault-lifecycle-view">
      <CardHeader>
        <CardTitle>Vault</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void handleCreate()} disabled={isBusy}>
            {isBusy ? 'Working…' : 'New vault…'}
          </Button>
          <Button type="button" variant="outline" onClick={() => void handleOpen()} disabled={isBusy}>
            Open vault…
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleClose()}
            disabled={isBusy || !openPath}
          >
            Close vault
          </Button>
        </div>

        {openPath ? (
          <p className="mt-4 text-sm text-fg-tertiary" data-testid="vault-open-path">
            Open: {openPath}
          </p>
        ) : (
          <p className="mt-4 text-sm text-fg-tertiary" data-testid="vault-open-path">
            No vault open
          </p>
        )}

        {status.message ? (
          <p
            className={`mt-2 text-sm ${status.isError ? 'text-red-600' : 'text-fg-tertiary'}`}
            data-testid="vault-status"
            data-status={status.isError ? 'error' : 'ok'}
          >
            {status.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
