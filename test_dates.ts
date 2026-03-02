const shifts = [
  {
    "id": "5e2b58ea-cc05-441b-8e84-58c3644e3e89",
    "company_id": "2ce3cd0a-913f-4f85-852e-27dd81759bfa",
    "employee_id": "f4e92e6a-aa35-41a9-a4bf-dd9477368ec7",
    "title": "Morning",
    "start_time": "2026-03-03T05:00:00+00:00",
    "end_time": "2026-03-03T01:00:00+00:00",
    "created_at": "2026-03-02T01:38:15.46831+00:00"
  }
];

const nextShift = shifts[0];
const referenceDate = nextShift ? new Date(nextShift.start_time) : new Date();
referenceDate.setHours(0, 0, 0, 0);

const dayOfWeek = referenceDate.getDay();
const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

const startOfWeek = new Date(referenceDate);
startOfWeek.setDate(referenceDate.getDate() + diffToMonday);

for (let i = 0; i < 7; i++) {
  const currentDay = new Date(startOfWeek);
  currentDay.setDate(startOfWeek.getDate() + i);

  const dayShifts = shifts.filter(s => {
    const shiftDate = new Date(s.start_time);
    return shiftDate.getFullYear() === currentDay.getFullYear() &&
           shiftDate.getMonth() === currentDay.getMonth() &&
           shiftDate.getDate() === currentDay.getDate();
  });

  console.log(`Day ${i} (${currentDay.toDateString()}): found ${dayShifts.length} shifts`);
  if (dayShifts.length > 0) {
    console.log("  Shift:", dayShifts[0].title, new Date(dayShifts[0].start_time).toDateString());
  }
}
