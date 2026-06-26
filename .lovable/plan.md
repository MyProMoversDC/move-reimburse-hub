# Mobile UI Sweep — Approved Plan

## Hard constraints (do not violate in any phase)
- DO NOT modify `capacitor.config.ts`, native Capacitor plugins, Keyboard config, StatusBar config, or `<meta viewport>` settings. Native shell is production-stable.
- DO NOT auto-transform every shadcn `<Table>` globally. `ResponsiveCardTable` is a shared foundation; each major business table (Jobs, Fleet, Warehouse, Reviews, Payments, Reports, etc.) gets its own optimized mobile card layout to preserve usability and information hierarchy.
- Desktop layouts must remain byte-for-byte unchanged.
- Preserve all business logic, RLS, Capacitor config, push notifications.

## Phase A — Shell polish (this turn, DONE)
- `src/pages/Dashboard.tsx`: top header is now sticky, safe-area-padded (`pt-safe`), backdrop-blurred on mobile; desktop unchanged.
- Existing `pt-safe`/`pb-safe`/`pl-safe`/`pr-safe` utilities in `src/index.css` stay as the safe-area foundation.
- `MobileHeader`, `ResponsiveDialog`, `ResponsiveCardTable`, `PullToRefresh`, `StickySaveBar` primitives remain available for per-screen use.

## Phase B — Per-table mobile card migrations (hand-tuned, batched)
Each table gets its own card design (not a generic auto-stack). Priority order:

- B1 (operations-critical): `JobOrdersManager`, `AdminMoverShifts`, `MoversList`, `AssignMoversDialog` crew list, `FleetManager`
- B2 (finance): `AdminCustomerRefundList`, `ReimbursementHistory`, `ReimbursementReportingDashboard`, `DeductiblesReport`, `AdminMissingPaymentList`, `AdminPaymentQuestionList`
- B3 (reviews/HR): `AdminReviewBonusList`, `CustomerReviewReportingDashboard`, `MissingPaymentReportingDashboard`, `HRDashboard`, `AdminAlcoholTestList`, `AdminViolenceIncidentList`, `PerformanceReportsList`
- B4 (inventory): `WarehouseManager`, `PurchasesManager`, `ReportsDashboard`
- B5 (admin/utility): `AdminSignupApprovals`, `UserRoleManager`, `AdminReferralList`, `UserActivityLog`, `AdminEmailLogs`, `SignedConsentDocuments`, `ConsentDocumentManager`, `ReferFriendHistory`, `ViolenceIncidentHistory`, `AddressHistoryView`

## Phase C — ResponsiveDialog sweep (form + assignment dialogs)
Swap `Dialog` → `ResponsiveDialog` so mobile gets bottom-sheet / full-screen sheet, desktop stays modal:
`AssignMoversDialog`, `AssignCrewDialog`, `AddBonusDialog`, `ApplyDeductibleDialog`, `AppealForm`, `AlcoholTestReportForm`, `MoverLiveTrackDialog`, `AnnualAddressDisclaimer`, plus the remaining form dialogs across cabinets.

## Phase D — MobileHeader standardization
Add `MobileHeader` inside each role dashboard that owns its own scroll area (Admin, Mover use SidebarTrigger; tab-based cabinets get a title-only variant). Shared Dashboard.tsx top bar already covers brand + role switcher + logout.

## Phase E — Pull-to-Refresh polish (final pass)
Wrap each cabinet's main list/feed with `PullToRefresh` bound to its refetch.

## Out of scope for the agent
On-device native verification (Dynamic Island, gesture nav, keyboard avoidance, orientation, tablet split-view) must be done on your hardware via your Capacitor builds. After Phase B I will hand over a one-page on-device QA checklist.
