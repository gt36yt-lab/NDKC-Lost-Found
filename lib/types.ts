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
  email?: string;
  course_dept?: string;
  is_admin?: boolean;
  created_at?: string;
};

export type OwnedReport = PublicReport & {
  user_id: string;
  contact_number: string;
  email: string;
  course_dept: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  report_id: string | null;
  message: string;
  created_at: string;
  read_at: string | null;
};
