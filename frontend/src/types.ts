export type UserRole = "CEO" | "HR" | "MANAGER" | "EMPLOYEE";
export interface CurrentUser {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  role: UserRole;
  departmentId: string | null;
  designation: string | null;
  workStartTime: string;
  workEndTime: string;
  dateOfBirth: string | null;
  managerId: string | null;
  passwordChangeRequired: boolean;
}
