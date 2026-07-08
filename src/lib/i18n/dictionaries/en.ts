// English dictionary for the unified i18n layer.
// Additive: does NOT replace legacy *Translations.ts files.
// Scope for Phase 2: navigation + shell chrome only.

export const en = {
  common: {
    navigation: "Navigation",
    dashboard: "Dashboard",
    chat: "Chat",
    logout: "Log out",
    exit: "Exit",
    switch: "Switch",
    switchRole: "Switch Role",
    language: "Language",
    settings: "Settings",
    back: "Back",
    close: "Close",
    openNavigation: "Open navigation",
  },
  nav: {
    // Shared
    feed: "Feed",
    chat: "Chat",
    shiftSchedule: "Shift Schedule",
    knowledgeBase: "Knowledge Base",
    aiAssistant: "AI Assistant",

    // Mover
    todoList: "To-Do List",
    myJobs: "My Jobs",
    reimbursements: "Reimbursements",
    customerReviews: "Customer Reviews",
    missingPayments: "Missing Payments",
    incidentReports: "Incident Reports",
    myCases: "My Cases",
    feedback: "Feedback",
    anonymousFeedback: "Anonymous Feedback",
    paymentQuestions: "Payment Questions",
    referFriend: "Refer a Friend",
    shiftClock: "Shift Clock",
    applicationInstructions: "Application Instructions",

    // Office staff
    savedPosts: "Saved Feed Posts",
    customerRefund: "Customer Refund",

    // Accountant
    confirmedReimbursements: "Approved Reimbursements",
    moversDirectory: "Movers Directory",

    // Operations Manager
    performanceReports: "Performance Reports",
    violenceIncidents: "Violence Incidents",
    alcoholTesting: "Alcohol Testing",
    fleet: "Fleet",
    jobOrders: "Job Orders",
    planning: "Planning",
    crewTracking: "Crew Tracking",
    crews: "Crews",

    // Reviews Admin
    reviewSubmissions: "Review Submissions",
    reviewReports: "Review Reports",
    deductibles: "Deductibles",

    // Warehouse Keeper
    warehouse: "Warehouse",
    liveMap: "Live Map",
    purchases: "Purchases",
    reports: "Reports",

    // Admin sidebar items
    signupApprovals: "SignUp Approvals",
    userManagement: "User Management",
    moverDocuments: "Mover Documents",
    moverRatings: "Mover Ratings",
    userActivityLog: "User Activity Log",
    moverShiftsQR: "Mover Shifts (QR)",
    referralRequests: "Referral Requests",
    misconductPerformanceSubmissions: "Misconduct/Performance Submissions",
    misconductResponses: "Misconduct Responses",
    alcoholTestReports: "Alcohol Test Reports",
    consentDocuments: "Consent Documents",
    customerRefunds: "Customer Refunds",
    deductiblesReport: "Deductibles Report",
    reimbursementReports: "Reimbursement Reports",
    missingPaymentReports: "Missing Payment Reports",
    customerReviewReports: "Customer Review Reports",
    moverFormReports: "Mover Form Reports",
    feedManagement: "Feed Management",
    handbookManagement: "Handbook Management",
    aiAssistantKnowledge: "AI Assistant Knowledge",
    moverFeedback: "Mover Feedback",
    emailLogs: "Email Logs",

    // HR
    hrCabinet: "HR Cabinet",
  },
  navGroups: {
    // Operations Manager groups
    operations: "Operations",
    dispatch: "Dispatch",
    communication: "Communication",

    // Admin sidebar groups
    userManagement: "User Management",
    complianceSafety: "Compliance & Safety",
    financialManagement: "Financial Management",
    reports: "Reports",
    contentKnowledge: "Content & Knowledge",
    communicationLogs: "Communication & Logs",
    overview: "Overview",
  },
};

type Widen<T> = {
  [K in keyof T]: T[K] extends string ? string : Widen<T[K]>;
};

export type Dictionary = Widen<typeof en>;
