import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { getReminders, saveReminders, Reminder } from '@/lib/extras';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

export default function SimpleCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [newReminder, setNewReminder] = useState('');

  useEffect(() => {
    setReminders(getReminders());
  }, []);

  const updateReminders = (updated: Reminder[]) => {
    setReminders(updated);
    saveReminders(updated);
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start of month
  const startDay = monthStart.getDay();
  const paddedDays = [...Array(startDay).fill(null), ...days];

  const getRemindersForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return reminders.filter(r => r.date === dateStr);
  };

  const addReminder = () => {
    if (!newReminder.trim() || !selectedDate) return;
    const updated = [...reminders, {
      id: Date.now().toString(),
      title: newReminder.trim(),
      date: format(selectedDate, 'yyyy-MM-dd')
    }];
    updateReminders(updated);
    setNewReminder('');
  };

  const deleteReminder = (id: string) => {
    const updated = reminders.filter(r => r.id !== id);
    updateReminders(updated);
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>{format(currentDate, 'MMMM yyyy')}</span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-xs font-medium text-muted-foreground p-2">{day}</div>
          ))}
          {paddedDays.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const dayReminders = getRemindersForDate(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`p-2 text-sm rounded-lg transition-colors relative ${
                  isSelected ? 'bg-primary text-primary-foreground' :
                  isToday ? 'bg-accent text-accent-foreground' :
                  'hover:bg-muted'
                }`}
              >
                {format(day, 'd')}
                {dayReminders.length > 0 && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-destructive rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Date Reminders */}
        {selectedDate && (
          <div className="border-t pt-4 space-y-3">
            <h4 className="font-medium">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h4>
            
            <div className="flex gap-2">
              <Input
                value={newReminder}
                onChange={(e) => setNewReminder(e.target.value)}
                placeholder="Add reminder..."
                onKeyDown={(e) => e.key === 'Enter' && addReminder()}
              />
              <Button onClick={addReminder} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 max-h-[150px] overflow-auto">
              {getRemindersForDate(selectedDate).map(reminder => (
                <div key={reminder.id} className="flex items-center justify-between p-2 bg-muted/50 rounded group">
                  <span className="text-sm">{reminder.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteReminder(reminder.id)}
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
              {getRemindersForDate(selectedDate).length === 0 && (
                <p className="text-sm text-muted-foreground">No reminders for this day</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
