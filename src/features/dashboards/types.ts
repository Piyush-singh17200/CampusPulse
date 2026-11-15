export type DashboardFieldErrors = Record<string, string[] | undefined>;

export type AttendanceQrActionData = {
  qrDataUrl: string;
  payload: string;
  expiresAt: string;
};

export type AttendanceScanActionData = {
  studentName: string;
  rollNumber: string | null;
  eventTitle: string;
  checkedInAt: string;
};

export type DashboardActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: DashboardFieldErrors;
  data?: {
    qr?: AttendanceQrActionData;
    scan?: AttendanceScanActionData;
  };
};

export const initialDashboardActionState: DashboardActionState = {
  status: "idle",
};
