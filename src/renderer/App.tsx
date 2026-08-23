import { useState } from 'react';

export function App(): JSX.Element {
  const [pingResult, setPingResult] = useState<string>('');

  const handlePing = async (): Promise<void> => {
    const result = await window.nayose.ping('hello');
    setPingResult(result);
  };

  return (
    <div>
      <button type="button" onClick={() => void handlePing()}>
        Ping main process
      </button>
      <p data-testid="ping-result">{pingResult}</p>
    </div>
  );
}
