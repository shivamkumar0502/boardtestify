# MongoDB persistence

Mongoose collections: users, sessions, resets, academics, questions, tests, attempts, audits, payments. Domain fields are checked with shared Zod schemas before writes. This MongoDB project uses Mongoose rather than Prisma/SQL migrations.

Users have unique normalized emails, bcrypt password hashes, server-owned roles and an authentication version. Sessions/password-reset tokens are stored as SHA-256 digests with TTL indexes; expiry is also checked during reads because TTL deletion is asynchronous. Password reset increments the authentication version and removes refresh sessions.

Academic records carry session, class, stream, syllabus version, kind, parent, verification and display order. Subject/chapter relationships are checked against scope. Class 10 uses GENERAL; Class 12 uses ARTS/SCIENCE/COMMERCE. The sole board is BSEB, implicit in this deployment.

Question data has draft/publication state, content hash, version and creator/reviewer metadata. Tests have versioned configurations, section selection rules and publication state. Attempts embed immutable question snapshots and a mutable answer/evaluation map, keeping answer/submission updates atomic without requiring multi-document transactions. A partial unique `(userId,testId)` index applies only to ACTIVE attempts. Other indexes cover deadlines and evaluation leases.

Payment orders have unique provider order IDs. A verified captured payment changes CREATED to PAID once; its expiry is derived from the provider payment creation timestamp. A PAID, nonexpired order grants premium access directly. There is no separate entitlement write that can be lost between collections.

`connect()` initializes indexes before accepting traffic. `seed` performs idempotent upserts of explicitly illustrative content. For future schema changes, use versioned, reviewed migration scripts and database backups; immutable attempt snapshots must remain readable. Large question banks require paginated academic/test lists and database query/index tuning beyond the initial caps.
