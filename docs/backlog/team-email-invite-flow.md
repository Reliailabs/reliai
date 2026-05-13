# Backlog: Team Email Invite Flow (Option 3)

## Summary

Full email-based team invitation flow that lets admins invite people who do not yet have a
Reliai account. The current implementation (Option 1 + 2) requires the invitee to already
have a Reliai account — their email is looked up in the `User` / `OperatorUser` table and
added directly. This backlog item covers the case where the invitee does not yet have an
account.

## Motivation

- Today: admin enters email → if account exists, they are added immediately → otherwise the
  UI shows "No Reliai account found for that email address."
- Desired: admin enters email → system sends an invitation email with a sign-up link →
  invitee clicks the link, creates an account, and is automatically added to the org with the
  correct role.

## Required backend changes

### 1. `OrganizationInvitation` model + Alembic migration

```python
class OrganizationInvitation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organization_invitations"
    organization_id: Mapped[UUID]
    invited_email: Mapped[str]       # normalized lowercase
    role: Mapped[str]
    invited_by_user_id: Mapped[UUID]
    token: Mapped[str]               # secure random token, unique index
    accepted_at: Mapped[datetime | None]
    expires_at: Mapped[datetime]     # default: now + 7 days
```

### 2. New API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/organizations/{org_id}/invitations` | Create invitation, send email |
| `GET`  | `/api/v1/invitations/{token}` | Validate token (public) |
| `POST` | `/api/v1/invitations/{token}/accept` | Accept invite, auto-add to org |
| `DELETE` | `/api/v1/organizations/{org_id}/invitations/{id}` | Revoke pending invite |
| `GET`  | `/api/v1/organizations/{org_id}/invitations` | List pending invitations |

### 3. Email delivery

Wire into the existing notification/email layer (or add one). The invitation email needs:
- Org name
- Inviter name / email
- Role being granted
- Accept link: `https://app.reliai.dev/join?token={token}`
- Expiry notice (7 days)

### 4. Accept flow

`POST /invitations/{token}/accept` should:
1. Validate token is not expired and not already accepted
2. Check if a `User` with `invited_email` already exists; if not, create one
3. Add user to the organization with the stored role
4. Mark invitation as accepted (`accepted_at = now()`)
5. Return a session token so the user lands directly in the app

## Required frontend changes

### Pulse settings — Team section

- Show a **Pending Invitations** table below the member list with columns:
  email | role | invited by | sent | expires | Revoke button
- The "Add member" form error state for "No Reliai account found" should offer
  "Send an invitation instead" as a CTA that pre-fills the invite form.
- Accept page at `/join?token=...` (new Next.js route) that shows org name + role
  and a "Create account & join" button.

## Acceptance criteria

- [ ] Admin can invite an email address that has no existing Reliai account
- [ ] Invitee receives an email with a working accept link
- [ ] Accepting the link creates an account (if needed) and adds user to org
- [ ] Token expires after 7 days; expired tokens show a clear error
- [ ] Admin can revoke a pending invitation before it is accepted
- [ ] Pending invitations are visible in Team settings with status

## Dependencies

- Email delivery infrastructure (SMTP / SES / Resend)
- Decision on whether to use WorkOS for the invite flow or stay first-party

## Related

- PR #172 — interactive assignee dropdown (uses the member list built in Option 1+2)
- `apps/pulse/app/api/settings/team/route.ts` — current add-member route that returns
  `no_account` error when the email is not found (the CTA hook point for this flow)
