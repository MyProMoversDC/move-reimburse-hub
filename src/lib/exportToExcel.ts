interface ReimbursementData {
  reimbursement_number: number;
  mover_full_name: string;
  job_number: string;
  truck_number: string;
  customer_name: string;
  gas_expenses: number;
  road_expenses: number;
  hotel_expenses: number;
  other_expenses: number;
  total_expenses: number;
  zelle_info: string;
  status: string;
  created_at: string;
}

interface ReviewBonusData {
  submission_date: string;
  foreman_name: string;
  job_date: string;
  client_full_name: string;
  invoice_number: string;
  crew_member_1: string;
  crew_member_2: string;
  crew_member_3: string;
  crew_member_4: string | null;
  crew_member_5: string | null;
  crew_member_6: string | null;
  crew_member_7: string | null;
  crew_member_8: string | null;
  review_url: string | null;
  review_month: string;
  status: string;
}

const downloadCSV = (csvContent: string, filename: string) => {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}-${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToExcel = (data: ReimbursementData[], filename: string) => {
  const headers = [
    "Date",
    "Reimbursement #",
    "Mover Name",
    "Job #",
    "Truck #",
    "Customer Name",
    "Gas Expenses",
    "Road Expenses",
    "Hotel Expenses",
    "Other Expenses",
    "Total Expenses",
    "Zelle Info",
    "Status",
  ];

  const rows = data.map((item) => [
    new Date(item.created_at).toLocaleDateString(),
    String(item.reimbursement_number).padStart(5, "0"),
    item.mover_full_name,
    item.job_number,
    item.truck_number,
    item.customer_name,
    `$${item.gas_expenses.toFixed(2)}`,
    `$${item.road_expenses.toFixed(2)}`,
    `$${item.hotel_expenses.toFixed(2)}`,
    `$${item.other_expenses.toFixed(2)}`,
    `$${item.total_expenses.toFixed(2)}`,
    item.zelle_info,
    item.status.charAt(0).toUpperCase() + item.status.slice(1),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${cell}"`).join(",")
    ),
  ].join("\n");

  downloadCSV(csvContent, filename);
};

export const exportReviewBonusesToExcel = (data: ReviewBonusData[], filename: string) => {
  const headers = [
    "Submission Date",
    "Foreman Name",
    "Job Date",
    "Client Full Name",
    "Invoice Number",
    "Crew Member 1",
    "Crew Member 2",
    "Crew Member 3",
    "Crew Member 4",
    "Crew Member 5",
    "Crew Member 6",
    "Crew Member 7",
    "Crew Member 8",
    "Review URL",
    "Review Month",
    "Status",
  ];

  const rows = data.map((item) => [
    new Date(item.submission_date).toLocaleDateString(),
    item.foreman_name,
    new Date(item.job_date).toLocaleDateString(),
    item.client_full_name,
    item.invoice_number,
    item.crew_member_1,
    item.crew_member_2,
    item.crew_member_3,
    item.crew_member_4 || "",
    item.crew_member_5 || "",
    item.crew_member_6 || "",
    item.crew_member_7 || "",
    item.crew_member_8 || "",
    item.review_url || "",
    item.review_month,
    item.status.charAt(0).toUpperCase() + item.status.slice(1),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${cell}"`).join(",")
    ),
  ].join("\n");

  downloadCSV(csvContent, filename);
};

interface MissingPaymentData {
  mover_full_name: string;
  customer_name: string;
  job_number: string;
  discrepancy_date: string;
  discrepancy_types: string[];
  discrepancy_details: string;
  missing_amount: string;
  status: string;
  created_at: string;
  decline_reason: string | null;
  appeal_note: string | null;
}

const discrepancyTypeLabels: Record<string, string> = {
  missing_hours: "Missing Hours",
  incorrect_hourly_rate: "Incorrect Hourly Rate",
  missing_tip: "Missing Tip",
  missing_bonus: "Missing Bonus",
  other: "Other",
};

export const exportMissingPaymentsToExcel = (data: MissingPaymentData[], filename: string) => {
  const headers = [
    "Submitted At",
    "Mover Name",
    "Customer Name",
    "Job/Invoice #",
    "Discrepancy Date",
    "Discrepancy Types",
    "Missing Amount",
    "Details",
    "Status",
    "Decline Reason",
    "Appeal Note",
  ];

  const rows = data.map((item) => [
    new Date(item.created_at).toLocaleDateString(),
    item.mover_full_name,
    item.customer_name,
    item.job_number,
    new Date(item.discrepancy_date).toLocaleDateString(),
    item.discrepancy_types.map(t => discrepancyTypeLabels[t] || t).join("; "),
    item.missing_amount,
    item.discrepancy_details.replace(/"/g, '""'),
    item.status.charAt(0).toUpperCase() + item.status.slice(1),
    item.decline_reason?.replace(/"/g, '""') || "",
    item.appeal_note?.replace(/"/g, '""') || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${cell}"`).join(",")
    ),
  ].join("\n");

  downloadCSV(csvContent, filename);
};
