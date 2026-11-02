-- These guards run in the write statement, across all Worker isolates.
CREATE TRIGGER shifts_no_overlap_insert BEFORE INSERT ON shifts
WHEN EXISTS (SELECT 1 FROM shifts WHERE employee_id = NEW.employee_id AND company_id = NEW.company_id AND start_time < NEW.end_time AND end_time > NEW.start_time)
BEGIN SELECT RAISE(ABORT, 'OHSHIFT_SHIFT_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER shifts_no_overlap_update BEFORE UPDATE OF employee_id, company_id, start_time, end_time ON shifts
WHEN EXISTS (SELECT 1 FROM shifts WHERE id <> OLD.id AND employee_id = NEW.employee_id AND company_id = NEW.company_id AND start_time < NEW.end_time AND end_time > NEW.start_time)
BEGIN SELECT RAISE(ABORT, 'OHSHIFT_SHIFT_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER time_entries_one_open_insert BEFORE INSERT ON time_entries
WHEN NEW.status = 'open' AND EXISTS (SELECT 1 FROM time_entries WHERE employee_id = NEW.employee_id AND status = 'open')
BEGIN SELECT RAISE(ABORT, 'OHSHIFT_CLOCK_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER time_entries_one_open_update BEFORE UPDATE OF status, employee_id ON time_entries
WHEN NEW.status = 'open' AND EXISTS (SELECT 1 FROM time_entries WHERE id <> OLD.id AND employee_id = NEW.employee_id AND status = 'open')
BEGIN SELECT RAISE(ABORT, 'OHSHIFT_CLOCK_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER time_off_no_overlap_insert BEFORE INSERT ON time_off_requests
WHEN NEW.status IN ('pending','approved') AND EXISTS (SELECT 1 FROM time_off_requests WHERE employee_id = NEW.employee_id AND company_id = NEW.company_id AND status IN ('pending','approved') AND start_date <= NEW.end_date AND end_date >= NEW.start_date)
BEGIN SELECT RAISE(ABORT, 'OHSHIFT_TIME_OFF_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER time_off_no_overlap_update BEFORE UPDATE OF status, start_date, end_date, employee_id, company_id ON time_off_requests
WHEN NEW.status IN ('pending','approved') AND EXISTS (SELECT 1 FROM time_off_requests WHERE id <> OLD.id AND employee_id = NEW.employee_id AND company_id = NEW.company_id AND status IN ('pending','approved') AND start_date <= NEW.end_date AND end_date >= NEW.start_date)
BEGIN SELECT RAISE(ABORT, 'OHSHIFT_TIME_OFF_CONFLICT'); END;
