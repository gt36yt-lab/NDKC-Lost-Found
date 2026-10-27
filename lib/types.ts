export type ReportType = "lost" | "found";

export type PublicReport = {
  id: string;
  report_type: ReportType;
  item_name: string;
  category: string;
  description: string;
  image_url: string | null;
  event_date: string;
  building_area: string;
  specific_location: string | null;
  status: string;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  student_id: string;
};
