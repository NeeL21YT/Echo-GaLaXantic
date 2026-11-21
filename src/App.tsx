import { DevAudio } from './ui/DevAudio';

const isDevAudio = import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === 'audio';

export function App() {
  if (isDevAudio) return <DevAudio />;
  return (
    <main className="app">
      <h1>Echo</h1>
      <button type="button">Start</button>
    </main>
  );
}
