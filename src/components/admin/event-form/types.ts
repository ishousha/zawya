export type EventType = "gathering" | "class" | "trip" | "retreat" | "meeting";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  gathering: "Gathering / Potluck",
  class: "Class / Halaqa",
  trip: "Trip or Picnic (Kids & Family)",
  retreat: "Retreat / Rihla",
  meeting: "Community Meeting",
};

export interface EventFormState {
  title: string;
  description: string;
  date_time: string;
  end_date_time: string;
  type: EventType;
  venue_id: string | null;
  location: string;
  address: string;
  virtual_link: string;
  cover_photo_url: string | null;
  capacity: string;
  waitlist_capacity: string;
  is_hybrid: boolean;
  has_potluck: boolean;
  ticket_fee: string;
  payment_instructions: string;
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
  description: "",
  date_time: "",
  end_date_time: "",
  type: "gathering",
  venue_id: null,
  location: "",
  address: "",
  virtual_link: "",
  cover_photo_url: null,
  capacity: "",
  waitlist_capacity: "0",
  is_hybrid: false,
  has_potluck: true,
  ticket_fee: "0",
  status: "active",
};
