export type DashboardFieldErrors = Record<string, string[] | undefined>;

export type DashboardActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: DashboardFieldErrors;
};

export const initialDashboardActionState: DashboardActionState = {
  status: "idle",
};
