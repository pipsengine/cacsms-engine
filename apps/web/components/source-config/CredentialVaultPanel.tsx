import type { SourceConfigurationDashboard } from "../../lib/source-config/types";

export function CredentialVaultPanel({ credentials }: { credentials: SourceConfigurationDashboard["credentials"] }) {
  return (
    <section className="sc-panel sc-vault">
      <div className="sc-panel-head"><h2>Credential Vault Integration</h2><b>VAULT REFERENCES ONLY</b></div>
      <p className="sc-vault-note">Secrets are never exposed in the UI. Only vault references are displayed.</p>
      <div className="sc-vault-grid">
        {credentials.map((item) => (
          <article key={item.vaultRef}>
            <small>{item.sourceKey}</small>
            <strong>{item.vaultRef}</strong>
            <span>Stored Securely</span>
          </article>
        ))}
      </div>
    </section>
  );
}
