ALTER TABLE users ADD COLUMN is_active integer NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE TRIGGER preserve_shift_timesheets_delete BEFORE DELETE ON shifts
WHEN EXISTS (SELECT 1 FROM time_entries WHERE shift_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'OHSHIFT_HISTORY_PROTECTED'); END;
--> statement-breakpoint
CREATE TRIGGER preserve_shift_timesheets_update BEFORE UPDATE OF employee_id, company_id, start_time, end_time ON shifts
WHEN (NEW.employee_id <> OLD.employee_id OR NEW.company_id <> OLD.company_id OR NEW.start_time <> OLD.start_time OR NEW.end_time <> OLD.end_time) AND EXISTS (SELECT 1 FROM time_entries WHERE shift_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'OHSHIFT_HISTORY_PROTECTED'); END;
--> statement-breakpoint
CREATE TRIGGER preserve_employee_history BEFORE DELETE ON users
WHEN EXISTS (SELECT 1 FROM shifts WHERE employee_id = OLD.id) OR EXISTS (SELECT 1 FROM time_entries WHERE employee_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'OHSHIFT_HISTORY_PROTECTED'); END;
--> statement-breakpoint
CREATE TRIGGER deactivate_no_open_clock BEFORE UPDATE OF is_active ON users
WHEN NEW.is_active = 0 AND EXISTS (SELECT 1 FROM time_entries WHERE employee_id = OLD.id AND status = 'open')
BEGIN SELECT RAISE(ABORT, 'OHSHIFT_HISTORY_PROTECTED'); END;
--> statement-breakpoint
CREATE TRIGGER active_employee_shifts BEFORE INSERT ON shifts
WHEN NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.employee_id AND company_id = NEW.company_id AND is_active = 1)
BEGIN SELECT RAISE(ABORT, 'OHSHIFT_INACTIVE_EMPLOYEE'); END;
--> statement-breakpoint
CREATE TRIGGER active_employee_clock BEFORE INSERT ON time_entries
WHEN NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.employee_id AND company_id = NEW.company_id AND is_active = 1)
BEGIN SELECT RAISE(ABORT, 'OHSHIFT_INACTIVE_EMPLOYEE'); END;
--> statement-breakpoint
CREATE TRIGGER active_employee_shift_updates BEFORE UPDATE OF employee_id, company_id, start_time, end_time ON shifts
WHEN (NEW.employee_id <> OLD.employee_id OR NEW.company_id <> OLD.company_id OR NEW.start_time <> OLD.start_time OR NEW.end_time <> OLD.end_time) AND NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.employee_id AND company_id = NEW.company_id AND is_active = 1)
BEGIN SELECT RAISE(ABORT, 'OHSHIFT_INACTIVE_EMPLOYEE'); END;
