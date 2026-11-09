export type AuthFieldErrors = Record<string, string[] | undefined>;

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: AuthFieldErrors;
  values?: {
    name?: string;
    email?: string;
    collegeId?: string;
  };
  devResetUrl?: string;
};

export const initialAuthState: AuthActionState = {
  status: "idle",
};
