// Extras storage utilities - separate from hotel operational data

const NOTES_KEY = 'extras_notes';
const TODOS_KEY = 'extras_todos';
const REMINDERS_KEY = 'extras_reminders';

// Notes
export function getNotes(): string {
  return localStorage.getItem(NOTES_KEY) || '';
}

export function saveNotes(notes: string): void {
  localStorage.setItem(NOTES_KEY, notes);
}

// To-Do
export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

export function getTodos(): TodoItem[] {
  const stored = localStorage.getItem(TODOS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveTodos(todos: TodoItem[]): void {
  localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
}

// Calendar Reminders
export interface Reminder {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
}

export function getReminders(): Reminder[] {
  const stored = localStorage.getItem(REMINDERS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveReminders(reminders: Reminder[]): void {
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
}
