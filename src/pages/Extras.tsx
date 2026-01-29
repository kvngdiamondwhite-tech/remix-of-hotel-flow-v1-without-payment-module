import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator as CalculatorIcon, StickyNote, CheckSquare, CalendarDays } from 'lucide-react';
import Calculator from '@/components/calculator/Calculator';
import Notes from '@/components/extras/Notes';
import ToDo from '@/components/extras/ToDo';
import SimpleCalendar from '@/components/extras/SimpleCalendar';

export default function Extras() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Extras</h1>
        <p className="text-muted-foreground">Desk utilities for everyday tasks</p>
      </div>

      <Tabs defaultValue="calculator" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="calculator" className="flex items-center gap-2">
            <CalculatorIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Calculator</span>
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            <span className="hidden sm:inline">Notes</span>
          </TabsTrigger>
          <TabsTrigger value="todo" className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            <span className="hidden sm:inline">To-Do</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Calendar</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="max-w-sm">
          <Calculator />
        </TabsContent>

        <TabsContent value="notes">
          <Notes />
        </TabsContent>

        <TabsContent value="todo" className="max-w-lg">
          <ToDo />
        </TabsContent>

        <TabsContent value="calendar" className="max-w-md">
          <SimpleCalendar />
        </TabsContent>
      </Tabs>
    </div>
  );
}
