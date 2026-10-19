# Architecture rules

- Normalize the active company identity through `companyDetails` when loading company settings for documents; imported legacy records must not reintroduce the previous company.
- Employee livechat stores messages before requesting optional FAQ replies using the signed-in session; assistant outages must not turn successfully stored messages into failed deliveries.
- Applicant onboarding is authoritative in applicant_workflows and protected RPCs; preserve legacy employee access while new applicants require all admission steps, because existing staff must not be silently locked out.
- External-backend onboarding changes are delivered under selfhost with browser setup instructions; do not apply them to the unrelated managed Cloud instance.
- Accepted applicant contracts are immutable document instances with a contract-specific signing timestamp; never infer their signature from a previous profile signature.