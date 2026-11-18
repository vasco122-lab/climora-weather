# CLIMORA Security Specification (Phase 0)

## 1. Data Invariants
1. **User Profile Ownership**: A `users/{userId}` document can only be created or modified by the authenticated user whose `request.auth.uid == userId` (or an admin), and `uid` inside the payload must equal `userId`.
2. **PII Isolation**: Email addresses, full legal names, and phone numbers reside strictly in `users/{userId}/private/info` and are readable/writable ONLY by `userId` or a verified admin.
3. **Sub-resource Ownership**: `locations` and `alerts` subcollections require the parent `users/{userId}` document to exist (`Master Gate`), and `uid` inside every child document must match `request.auth.uid`.
4. **Immutable Creation Fields**: `uid`, `userId`, and `createdAt` cannot be modified after creation. All `createdAt` and `updatedAt` timestamps must match `request.time`.
5. **Admin Privilege Protection**: Admin access is granted ONLY via verified email (`vascotoru94@gmail.com` with `email_verified == true`) or membership in `/admins/{uid}`. Clients can never self-assign admin status.
6. **Monetization Integrity**: `ad_campaigns` and `app_config` can only be created/modified by admins. `revenue_events` can only be read/listed by admins, and user-created checkout/ad events must carry `userId == request.auth.uid` and bounded `amountUsd`.
7. **Terminal Subscription Lock**: Cancelled subscriptions (`status == 'cancelled'`) cannot be mutated back by non-admins.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on User Create**: `{ uid: "u1", ..., isAdmin: true }` -> `PERMISSION_DENIED` (blocked by `hasOnly`).
2. **Identity Spoofing on Location Create**: User `u2` creates `/users/u1/locations/loc1` with `{ uid: "u1", ... }` -> `PERMISSION_DENIED` (`isOwner(userId)`).
3. **PII Cross-Read Attack**: User `u2` reads `/users/u1/private/info` -> `PERMISSION_DENIED` (`isOwner(userId)`).
4. **Email Spoofing Admin Bypass**: Token `{ email: "vascotoru94@gmail.com", email_verified: false }` reading `/revenue_events` -> `PERMISSION_DENIED`.
5. **Orphaned Subcollection Write**: Creating `/users/u1/alerts/a1` when `/users/u1` does not exist -> `PERMISSION_DENIED` (Master Gate `exists()`).
6. **ID Poisoning**: Creating `/users/u1/locations/<200-char-invalid-id!@#>` -> `PERMISSION_DENIED` (`isValidId`).
7. **Value Poisoning on Update**: Updating `users/u1` with `{ displayName: "<500-char string>" }` -> `PERMISSION_DENIED` (`isValidUserAccount`).
8. **Immutable Field Mutation**: Updating `subscriptions/s1` to change `userId` or `createdAt` -> `PERMISSION_DENIED`.
9. **Terminal State Bypass**: Re-activating a `cancelled` subscription as non-admin -> `PERMISSION_DENIED`.
10. **Blanket User List Scraping**: Non-admin running `list` on `/users` -> `PERMISSION_DENIED`.
11. **Timestamp Forgery**: Creating a `revenue_events` doc with backdated `createdAt` != `request.time` -> `PERMISSION_DENIED`.
12. **Unauthorized Campaign Tampering**: Non-admin modifying `ad_campaigns/c1` `cpmUsd` -> `PERMISSION_DENIED`.
