# Unified Experience DOM Knowledge Base

## Memory & State Graph for E2E Agents (PAUL Framework)

### 1. Resale Page (`/resale`)
- **Key Modules**: Marketplace for items.
- **Search Element**: Typically `[placeholder*="Search"]` (Rendered via `ModuleSearchFilter`).
- **Create Listing Trigger**: Button with text `Sell Item`.

### 2. Academics Page (`/academics`)
- **Key Modules**: Academic resources sharing.
- **Create Listing Trigger**: Button with text `Share a Resource`.

### 3. Create Listing Flow / Modal (`ResourceListingForm`)
The form is step-based (3 phases).

#### Phase 1: Details
- **Title Input**: `input[placeholder="What are you offering?"]`
- **Category Select**: `button:has-text("Select Category")` (shadcn setup). Inside list, select respective category.
- **Price Input**: `input[placeholder="0.00"]`
- **Description Input**: `textarea[placeholder*="Specify condition"]`
- **Next Button**: `button:has-text("NEXT PHASE")`

#### Phase 2: Media
- **File Input**: `input[type="file"]` (hidden, interacted via label)
- **Next Button**: `button:has-text("CONTINUE")`

#### Phase 3: Consent & Manifest
- **Consent Checkbox**: `button[role="checkbox"]` near text `I consent to sharing my internal institutional ID`
- **Submit Button**: `button:has-text("MANIFEST LISTING")`

### 4. Admin Page (`/admin`)
- **Tabs**: `Pending Approvals`, `Verified Entities`, `Dispute Protocols`, `Fraud Dashboard`, etc.
- **Pending Review Table Rows**: Classes starting with `row-...`. Contains a `Search` icon button to open `ENTITY INSPECTION` modal.
- **Approve Button**: `button:has-text("Confirm & Manifest")`
- **Reject Button**: `button:has-text("Reject Protocol")`
- **Confirmation Modal**: `button:has-text("Approve Listing")` or `button:has-text("Reject Listing")`