import { useState } from 'react';

import { EntityCreateView } from './views/entity-create';

export function App(): JSX.Element {
  const [pingResult, setPingResult] = useState<string>('');

  const handlePing = async (): Promise<void> => {
    const result = await window.nayose.ping('hello');
    setPingResult(result);
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <button type="button" onClick={() => void handlePing()}>
        Ping main process
      </button>
      <p data-testid="ping-result">{pingResult}</p>

      <EntityCreateView />
    </div>
  );
}
