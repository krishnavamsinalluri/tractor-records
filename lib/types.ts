export type ChargeBasis = "hour" | "acre";

export type Customer = {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  created_at: string;
};

export type WorkType = {
  id: string;
  user_id: string;
  name: string;
  active: boolean;
  acre_rate?: number | null;
  hour_rate?: number | null;
  created_at: string;
};

export type Payment = {
  id: string;
  user_id: string;
  work_record_id: string;
  payment_date: string;
  amount: number;
  method: string;
  created_at: string;
};

export type WorkRecord = {
  id: string;
  user_id: string;
  customer_id: string;
  work_type_id: string | null;
  work_type_name: string;
  work_date: string;
  charge_basis: ChargeBasis;
  quantity: number;
  rate: number;
  total: number;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  payments?: Payment[];
};
