import { useEffect, useState } from 'react';

interface DisconnectedPanelProps {
  onRetry: () => void;
  error: string | null;
}

function CommandBlock({ command, label }: { command: string; label: string }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyLabel =
    copyStatus === 'copied'
      ? `${label} copied`
      : copyStatus === 'failed'
        ? `Copy ${label.toLowerCase()} failed`
        : `Copy ${label.toLowerCase()}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
    window.setTimeout(() => setCopyStatus('idle'), 2_000);
  };

  return (
    <div className="overflow-hidden rounded border border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-3 py-2">
        <span className="text-xs text-[var(--color-dim)]">{label}</span>
        <button
          type="button"
          aria-label={copyLabel}
          onClick={() => void copy()}
          className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-xs text-[var(--color-cyan)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)]/50"
        >
          {copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs sm:text-sm">
        <code className="text-[var(--color-cyan)]">{command}</code>
      </pre>
      <span className="sr-only" aria-live="polite">
        {copyStatus === 'copied'
          ? `${label} copied to clipboard.`
          : copyStatus === 'failed'
            ? `${label} could not be copied. Select the command manually.`
            : ''}
      </span>
    </div>
  );
}

export function DisconnectedPanel({ onRetry, error }: DisconnectedPanelProps) {
  const [controllerOrigin, setControllerOrigin] = useState('https://performance.sassmaker.com');
  useEffect(() => setControllerOrigin(window.location.origin), []);
  const installCommand = `git clone --depth 1 https://github.com/sarthakagrawal927/psi-swarm.git
cd psi-swarm
corepack pnpm install --frozen-lockfile
corepack pnpm run build:cli`;
  const startCommand = `corepack pnpm run cli serve --origin ${controllerOrigin}`;

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]">
      <header className="border-b border-[var(--color-border)] px-5 py-5 sm:px-8 sm:py-6">
        <h2 className="text-xl font-semibold">Connect the local Lighthouse agent</h2>
        <p className="mt-2 max-w-[70ch] text-sm text-[var(--color-dim)]">
          The controller is ready, but Lighthouse runs on your machine. Setup usually takes a few
          minutes and keeps every audit and result local.
        </p>
      </header>

      <ol className="divide-y divide-[var(--color-border)]">
        <li className="grid gap-3 px-5 py-5 sm:grid-cols-[2rem_minmax(0,1fr)] sm:px-8">
          <span className="font-mono text-sm text-[var(--color-cyan)]" aria-hidden="true">
            1
          </span>
          <div>
            <h3 className="font-medium">Check prerequisites</h3>
            <p className="mt-1 text-sm text-[var(--color-dim)]">
              You need Node 22 LTS, Git, and Chrome. Node 24 and newer are not supported by the
              current Lighthouse version. Check the first two with{' '}
              <code className="font-mono">node --version</code> and{' '}
              <code className="font-mono">git --version</code>.
            </p>
          </div>
        </li>

        <li className="grid gap-3 px-5 py-5 sm:grid-cols-[2rem_minmax(0,1fr)] sm:px-8">
          <span className="font-mono text-sm text-[var(--color-cyan)]" aria-hidden="true">
            2
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-medium">Install and build the agent</h3>
              <a
                href="https://github.com/sarthakagrawal927/psi-swarm"
                target="_blank"
                rel="noreferrer"
                aria-label="View public source (opens in a new tab)"
                className="inline-flex min-h-11 items-center text-xs text-[var(--color-cyan)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)]/50"
              >
                View public source ↗
              </a>
            </div>
            <p className="mb-3 text-sm text-[var(--color-dim)]">
              Run once in the folder where you want to keep psi-swarm. Already installed? Skip to
              step 3.
            </p>
            <CommandBlock command={installCommand} label="Install commands" />
          </div>
        </li>

        <li className="grid gap-3 px-5 py-5 sm:grid-cols-[2rem_minmax(0,1fr)] sm:px-8">
          <span className="font-mono text-sm text-[var(--color-cyan)]" aria-hidden="true">
            3
          </span>
          <div className="min-w-0">
            <h3 className="font-medium">Start the agent</h3>
            <p className="mb-3 mt-1 text-sm text-[var(--color-dim)]">
              Run this from the cloned <code className="font-mono">psi-swarm</code> folder and leave
              the terminal open. The allowed origin below matches this page.
            </p>
            <CommandBlock command={startCommand} label="Start command" />
          </div>
        </li>

        <li className="grid gap-3 px-5 py-5 sm:grid-cols-[2rem_minmax(0,1fr)] sm:px-8">
          <span className="font-mono text-sm text-[var(--color-cyan)]" aria-hidden="true">
            4
          </span>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-medium">Connect this page</h3>
              <p className="mt-1 text-sm text-[var(--color-dim)]">
                Wait until the terminal says “psi-swarm agent running,” then connect.
              </p>
              {error && (
                <p role="alert" className="mt-2 text-xs text-[var(--color-poor)]">
                  Last connection error: {error}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="min-h-11 w-full shrink-0 rounded bg-[var(--color-cyan)] px-4 py-2 font-medium text-black transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)] sm:w-auto"
            >
              Connect to local agent
            </button>
          </div>
        </li>
      </ol>
    </section>
  );
}
