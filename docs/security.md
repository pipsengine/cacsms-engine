# Security Foundation

CACSMS Engine supports email, Google, and Microsoft identities with MFA state recorded per user. Authorization combines RBAC role assignments with ABAC policy rules stored as JSON attributes.

Production services must enforce:

- AES-256 encryption for secrets and protected data at rest.
- TLS 1.3 for API, machine-agent, MT5 bridge, and broker-facing transport.
- Short-lived JWT access tokens with rotated signing keys and refresh-token revocation.
- MFA for privileged users.
- Machine certificates and terminal certificates for fleet identity.
- Signed, expiring, single-purpose execution tokens before any order command.
- Secrets-vault integration for encrypted credentials.
- Audit events for authentication, authorization, workflow overrides, execution actions, governance changes, and report access.
- Immutable audit-log storage enforced against update and delete operations.
