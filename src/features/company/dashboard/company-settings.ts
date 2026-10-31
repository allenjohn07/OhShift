/** Company shift presets as returned by the dashboard API. */
export interface CompanySettings {
  id: string;
  name: string;
  morning_start: string;
  morning_end: string;
  evening_start: string;
  evening_end: string;
}
