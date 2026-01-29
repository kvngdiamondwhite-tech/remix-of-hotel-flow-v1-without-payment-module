import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CalculatorProps {
  showCard?: boolean; // If false, renders just the calculator UI without Card wrapper
  title?: string;
}

export default function Calculator({ showCard = true, title = 'Calculator' }: CalculatorProps) {
  const [display, setDisplay] = useState('0');
  const [firstOperand, setFirstOperand] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForSecond, setWaitingForSecond] = useState(false);

  const inputDigit = (digit: string) => {
    if (waitingForSecond) {
      setDisplay(digit);
      setWaitingForSecond(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (waitingForSecond) {
      setDisplay('0.');
      setWaitingForSecond(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const clear = () => {
    setDisplay('0');
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecond(false);
  };

  const handleOperator = (nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (firstOperand === null) {
      setFirstOperand(inputValue);
    } else if (operator) {
      const result = calculate(firstOperand, inputValue, operator);
      setDisplay(String(result));
      setFirstOperand(result);
    }

    setWaitingForSecond(true);
    setOperator(nextOperator);
  };

  const calculate = (first: number, second: number, op: string): number => {
    switch (op) {
      case '+': return first + second;
      case '-': return first - second;
      case '×': return first * second;
      case '÷': return second !== 0 ? first / second : 0;
      default: return second;
    }
  };

  const performCalculation = () => {
    if (firstOperand === null || operator === null) return;

    const inputValue = parseFloat(display);
    const result = calculate(firstOperand, inputValue, operator);
    
    setDisplay(String(result));
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecond(false);
  };

  const buttons = [
    ['7', '8', '9', '÷'],
    ['4', '5', '6', '×'],
    ['1', '2', '3', '-'],
    ['0', '.', '=', '+'],
  ];

  const calculatorUI = (
    <div className="space-y-4">
      <div className="bg-muted p-4 rounded-lg text-right text-2xl font-mono min-h-[60px] flex items-center justify-end overflow-hidden">
        {display}
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        <Button variant="destructive" onClick={clear} className="col-span-2">
          Clear
        </Button>
        <Button variant="secondary" onClick={() => setDisplay(display.slice(0, -1) || '0')} className="col-span-2">
          ← Delete
        </Button>
        
        {buttons.map((row, i) => (
          row.map((btn) => (
            <Button
              key={btn}
              variant={['+', '-', '×', '÷'].includes(btn) ? 'secondary' : btn === '=' ? 'default' : 'outline'}
              onClick={() => {
                if (btn === '=') performCalculation();
                else if (['+', '-', '×', '÷'].includes(btn)) handleOperator(btn);
                else if (btn === '.') inputDecimal();
                else inputDigit(btn);
              }}
              className="h-12 text-lg"
            >
              {btn}
            </Button>
          ))
        ))}
      </div>
    </div>
  );

  if (!showCard) {
    return calculatorUI;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {calculatorUI}
      </CardContent>
    </Card>
  );
}
