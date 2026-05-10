import Logo from './Logo.jsx';

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center">
      <div className="animate-in">
        <Logo size="lg" />
      </div>
    </div>
  );
}
