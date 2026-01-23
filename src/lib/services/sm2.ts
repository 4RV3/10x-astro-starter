export interface SM2State {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
}

export interface SM2UpdateResult extends SM2State {
  due_at: string;
  last_reviewed_at: string | null;
}

export function applySM2(current: SM2State, grade: number, now: Date): SM2UpdateResult {
  const next: SM2State = { ...current };

  // EF update
  next.ease_factor = current.ease_factor - 0.8 + 0.28 * grade - 0.02 * grade * grade;
  if (next.ease_factor < 1.3) next.ease_factor = 1.3;
  if (next.ease_factor > 3.0) next.ease_factor = 3.0;

  if (grade < 3) {
    next.repetitions = 0;
    next.interval_days = 1;
  } else {
    next.repetitions = current.repetitions + 1;
    if (current.repetitions === 0) next.interval_days = 1;
    else if (current.repetitions === 1) next.interval_days = 6;
    else next.interval_days = Math.max(1, Math.round(current.interval_days * next.ease_factor));
  }

  const dueDate = new Date(now);
  dueDate.setUTCDate(dueDate.getUTCDate() + next.interval_days);

  return {
    ...next,
    due_at: dueDate.toISOString(),
    last_reviewed_at: now.toISOString(),
  };
}
