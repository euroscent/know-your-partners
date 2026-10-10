# Architecture rules

- Normalize the active company identity through `companyDetails` when loading company settings for documents; imported legacy records must not reintroduce the previous company.
- Employee livechat stores messages before requesting optional FAQ replies using the signed-in session; assistant outages must not turn successfully stored messages into failed deliveries.