# Marketplace Order Invoice Lifecycle

Marketplace invoices are created when a shop accepts an order, in the same Firestore transaction that changes the order status. Each invoice is stored at `shops/{shopId}/marketplaceInvoices/{orderId}` and uses the order ID as its stable document ID and invoice-number suffix. Repeating the acceptance action therefore reuses the same invoice rather than issuing another one.

The shop's private GST registration snapshot is read when the invoice is issued. An admin-verified regular registration with a valid-format GSTIN selects a tax invoice for supported taxable lines; a verified composition registration selects a Bill of Supply; all other or unavailable registration states select a non-GST receipt. For a verified regular shop, zero-rate lines without an exempt/nil-rated/zero-rated classification block invoice creation and set an issue on the accepted order for review. This is not a determination of all transaction-specific GST applicability or a legal validation of the document.

Marketplace customer records are keyed by authenticated customer UID at `shops/{shopId}/marketplaceCustomers/{customerUid}`. They are updated atomically with the new order, and only the owning shop can list the shop's customer records. Customer order history queries both the shop ID and account UID and loads at most 25 orders per page.

## Corrections, cancellations, and failed invoice writes

- Do not edit or delete an issued marketplace invoice. The invoice remains traceable by its order ID.
- A failed acceptance transaction writes neither an accepted status nor a partial invoice. Retry accepting the order; an already-accepted order with a missing invoice can use **Retry Invoice**. The stable invoice document ID makes this retry idempotent.
- If an accepted order is later cancelled, refunded, or its contents need correction, keep the original invoice unchanged and follow the applicable accounting process to issue a separately numbered credit note or replacement that references the original invoice and order. Dukan Yantra does not yet provide a credit-note/replacement workflow, so do not treat order status changes as a tax-document correction.

## Firebase rollout

Review the Firebase project/database selected by the deployment environment before deployment. The Firestore rules and the order-history composite index are configured in `firestore.rules` and `firestore.indexes.json` (referenced by `firebase.json`). Deploy and emulator-test them before enabling this workflow for production users. No production deployment or data migration is performed by this change.

The order creation and invoice generation code currently runs in the authenticated client using Firestore transactions. Security Rules constrain who can create the shop invoice and tie it to an accepted order, but the project has no trusted Firebase Functions/Admin SDK invoice backend. Those rules do not independently verify every product price or determine transaction-specific GST applicability; production-grade enforcement requires a trusted backend and applicable accounting/legal review.
