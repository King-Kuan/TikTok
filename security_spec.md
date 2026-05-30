# Security Specification: Automated TikTok Shorts Generator Database

## 1. Data Invariants
- **Jobs**:
  - A job must be owned by an authenticated user (`userId == request.auth.uid`).
  - Its creation timestamp must equal `request.time`.
  - Its status must transition strictly from `pending` -> `processing` -> `completed` or `failed`.
- **Clips**:
  - A clip belongs to a valid parent job.
  - Subtitles must be a well-bounded array of text segments with valid `start_ms` and `end_ms` fields.
  - Only rendering status updates are permissible once created.

## 2. The "Dirty Dozen" (Negative Security Payloads)
Here are twelve payloads designed to attack the rules and breach authorization, identity, and boundaries:

1. **Self-Elevated Privilege Job Request**: A user attempts to submit a job specifying someone else's `userId`.
2. **Empty Job Payload Injection**: Creating a job with missing `youtubeUrl` or empty fields.
3. **Impossibly Long ID**: Injecting a 50KB string as a jobId to exhaust storage/billing (Resource Poisoning).
4. **Invalid Timestamps**: Submitting a job with a client-side timestamp in the future instead of `request.time`.
5. **Direct Status Hijacking**: Creating a job directly with status `completed` without doing background processing.
6. **Orphaned Clip Insertion**: Injecting a clip document that does not reference a valid job ID.
7. **Clip Subtitle Type Spoofing**: Submitting subtitles where `word` is written as an object instead of a string.
8. **Foreign Clip Infiltration**: Adding clips to another user's job hierarchy.
9. **Blanket Query Reading**: Authenticated user attempts to list *everyone's* jobs from the root `/jobs` collection.
10. **Malicious Special Characters in ID**: Creating a job with standard slash patterns and special indicators (`../..`) to traverse structures.
11. **Improper Status Skipping**: Forcing a job status from `pending` directly to `completed` without active processing fields.
12. **Double Owner Update Attempt**: Trying to mutate the ownership (`userId`) of an existing job to a new user ID.

## 3. Test Cases Plan
- Every create/write of Jobs or Clips checks that `request.auth.uid != null` and matched `userId`.
- Every list query enforces `resource.data.userId == request.auth.uid` to reject query-grazing.
- String constraints (such as `youtubeUrl.size() <= 2083`) are strictly checked.
