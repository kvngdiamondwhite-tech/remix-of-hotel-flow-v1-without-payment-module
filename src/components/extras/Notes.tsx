import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { getNotes, saveNotes } from '@/lib/extras';

export default function Notes() {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setNotes(getNotes());
  }, []);

  const handleChange = (value: string) => {
    setNotes(value);
    saveNotes(value);
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Notes
          <span className="text-xs font-normal text-muted-foreground">Auto-saved</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          value={notes}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Write your notes here..."
          className="min-h-[400px] resize-none"
        />
      </CardContent>
    </Card>
  );
}
