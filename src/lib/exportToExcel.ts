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

export const exportToExcel = (data: ReimbursementData[], filename: string) => {
  // Create CSV content
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

  // Create and download file
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
