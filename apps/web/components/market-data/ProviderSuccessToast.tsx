"use client";

type Props = {
  notification: {
    title: string;
    providerName: string;
    providerCode?: string;
    status: string;
    workflowImpact: string;
  } | null;
  onClose: () => void;
};

export function ProviderSuccessToast({ notification, onClose }: Props) {
  if (!notification) return null;
  return (
    <aside className="mdoc-success-toast" role="status">
      <strong>{notification.title}</strong>
      <p><span>Provider:</span> {notification.providerName}{notification.providerCode ? ` (${notification.providerCode})` : ""}</p>
      <p><span>Status:</span> {notification.status}</p>
      <p><span>Workflow Impact:</span> {notification.workflowImpact}</p>
      <button type="button" className="mdoc-button secondary" onClick={onClose}>Dismiss</button>
    </aside>
  );
}
