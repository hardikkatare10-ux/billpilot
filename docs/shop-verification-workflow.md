# Shop verification uploads

New NearBasket shop applications require three distinct shop photographs and at least one selected business document. Applicants can attach up to three additional documents. Files are uploaded to private Firebase Storage paths; Firestore stores only private references and metadata at `shops/{shopId}/private/verificationApplication`.

The application record moves through `pending_verification`, `additional_information_required`, `approved`, `rejected`, and `suspended`. A new record is submitted directly as pending; drafts remain in the registration form until the required files are complete. Applicants can read their own status and resubmit materials after an admin requests more information. Rejected applications are final in the current workflow.

Administrators review requests in the existing Marketplace Administration dashboard. They must open every submitted file through authenticated Storage reads before the approve action becomes available. Rejection, information requests, approval, suspension, and reactivation are recorded in the immutable `shops/{shopId}/verificationAudit` subcollection. Approval sets the legacy public shop status to `verified`; only that status is eligible for discovery, product publishing, and order placement. Existing verified shops are not changed by this workflow.

## Storage and access

Files are stored under `shop-verification/{ownerUid}/{shopId}/...` with content-digest-qualified object names. Storage Rules allow creation but not replacement or deletion, limit upload types and sizes, and restrict reads to the owner or an admin email/custom claim. Retries reuse an existing object only when its metadata matches the original upload. Do not replace these paths with `getDownloadURL` links; the admin UI uses authenticated reads and temporary object URLs.

The client rejects invalid signatures, attempts to decode supported images, checks the PDF header/trailer, enforces file limits, and rejects identical photo content using SHA-256 before submission. Firebase Storage Rules independently enforce authenticated ownership-by-UID path, MIME type, and size. Storage Rules cannot inspect file bytes or prove that three different images depict the requested subjects. This project has no trusted Cloud Function for content scanning, image deduplication, or OCR; those client-only checks are not a defense against a deliberately modified client. Admins must inspect each file, and approval records a human review rather than legal, identity, or ownership certification.

## Deployment

Deploy both rule files to the same Firebase project and Firestore database configured for the app:

```text
firebase deploy --only firestore:rules,storage
```

The project uses a named Firestore database in some deployments; select the correct Firebase project/database before deploying. Storage Rules admin checks support the configured admin emails and the `admin: true` custom claim. If administrators are provisioned only through the `admins/{uid}` Firestore collection, assign the corresponding Firebase Auth custom claim before they review Storage files. Never let a client set custom claims.

No production data migration is required. Existing shops retain their current status. Previously pending shops without a private application record can complete the upload flow while signed in; no shop is automatically approved or suspended.
