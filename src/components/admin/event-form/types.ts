export interface EventFormState {
  title: string;
  date_time: string;
  end_date_time: string;
  type: "physical" | "online" | "kids";
  location: string;
  virtual_link: string;
  cover_photo_url: string | null;
  capacity: string;
  waitlist_capacity: string;
  is_hybrid: boolean;
  status: "active" | "full" | "cancelled";
}

export interface SignUpItemState {
  id?: number;
  item_name: string;
  quantity_limit: number;
  order_index: number;
}

export const defaultEventForm: EventFormState = {
  title: "",
  date_time: "",
  end_date_time: "",
  type: "physical",
  location: "",
  virtual_link: "",
  cover_photo_url: null,
  capacity: "",
  waitlist_capacity: "0",
  is_hybrid: false,
  status: "active",
};
