import { Icon } from "../Icon";

interface DevShellWelcomeProps {
  onNewLocal: () => void;
  onOpenK8s: () => void;
  onOpenDocker: () => void;
  onDismiss: () => void;
}

export function DevShellWelcome({
  onNewLocal,
  onOpenK8s,
  onOpenDocker,
  onDismiss,
}: DevShellWelcomeProps) {
  return (
    <div className="devshell-welcome">
      <div className="devshell-welcome__inner">
        <div className="devshell-welcome__header">
          <Icon name="Terminal" className="w-6 h-6 text-[var(--color-primary)]" aria-hidden="true" />
          <div>
            <h2 className="devshell-welcome__title">DevShell</h2>
            <p className="devshell-welcome__subtitle">
              Tabbed shells for local, Kubernetes, and Docker — in one place.
            </p>
          </div>
        </div>

        <div className="devshell-welcome__grid">
          <button type="button" className="devshell-welcome__card devshell-welcome__card--local" onClick={onNewLocal}>
            <Icon name="Terminal" className="w-5 h-5" aria-hidden="true" />
            <span className="devshell-welcome__card-title">Local shell</span>
            <span className="devshell-welcome__card-desc">Start a new terminal tab</span>
          </button>

          <button type="button" className="devshell-welcome__card devshell-welcome__card--k8s" onClick={onOpenK8s}>
            <Icon name="Kubernetes" className="w-5 h-5" aria-hidden="true" />
            <span className="devshell-welcome__card-title">Kubernetes</span>
            <span className="devshell-welcome__card-desc">Exec into a pod from Kube Lens</span>
          </button>

          <button type="button" className="devshell-welcome__card devshell-welcome__card--docker" onClick={onOpenDocker}>
            <Icon name="Container" className="w-5 h-5" aria-hidden="true" />
            <span className="devshell-welcome__card-title">Docker</span>
            <span className="devshell-welcome__card-desc">Shell into a running container</span>
          </button>
        </div>

        <button type="button" onClick={onDismiss} className="devshell-welcome__skip">
          Continue with current tab
        </button>
      </div>
    </div>
  );
}
