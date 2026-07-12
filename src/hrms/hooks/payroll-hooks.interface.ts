export interface SalaryStructure {
  employeeId: string;
  basicSalary: number;
  allowances: SalaryAllowance[];
  deductions: SalaryDeduction[];
  effectiveDate: Date;
}

export interface SalaryAllowance {
  name: string;
  amount: number;
  isTaxable: boolean;
}

export interface SalaryDeduction {
  name: string;
  amount: number;
  isPreTax: boolean;
}

export interface PayrollPeriod {
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
}

export interface PayrollInput {
  employeeId: string;
  organizationId: string;
  salaryStructure: SalaryStructure;
  period: PayrollPeriod;
  attendance: {
    presentDays: number;
    absentDays: number;
    leaveDays: number;
  };
}

export interface IPayrollHooksService {
  calculateSalary(input: PayrollInput): Promise<SalaryCalculationResult>;
  processPayroll(entries: PayrollInput[]): Promise<void>;
}

export interface SalaryCalculationResult {
  employeeId: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  breakdown: {
    earnings: { name: string; amount: number }[];
    deductions: { name: string; amount: number }[];
  };
}

export interface HolidayCalendar {
  id: string;
  organizationId: string;
  name: string;
  date: Date;
  isRecurring: boolean;
  type: 'PUBLIC' | 'COMPANY' | 'REGIONAL';
}

export interface IHolidayCalendarService {
  getHolidays(orgId: string, year: number): Promise<HolidayCalendar[]>;
  isHoliday(orgId: string, date: Date): Promise<boolean>;
}
