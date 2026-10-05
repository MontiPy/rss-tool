import React, { useEffect, useState } from 'react';
import { TextField, TextFieldProps } from '@mui/material';

type NumericFieldProps = Omit<TextFieldProps, 'value' | 'onChange' | 'type'> & {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  /** When true, clearing the field reports `undefined`; otherwise it reports `emptyValue`. */
  allowEmpty?: boolean;
  emptyValue?: number;
  /** Only report the value on blur / Enter instead of on every keystroke. */
  commitOnBlur?: boolean;
};

const clamp = (n: number, min?: number, max?: number) =>
  Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));

/**
 * Number input that keeps the raw text while typing, so intermediate states such as
 * "-", "0." or "" don't get coerced to 0 mid-edit. Values are clamped to [min, max].
 */
const NumericField: React.FC<NumericFieldProps> = ({
  value,
  onChange,
  min,
  max,
  step,
  allowEmpty = false,
  emptyValue = 0,
  commitOnBlur = false,
  inputProps,
  onBlur,
  onKeyDown,
  error,
  helperText,
  ...rest
}) => {
  const [text, setText] = useState(value === undefined ? '' : String(value));

  // Sync when the value changes from outside (undo, load, symmetric mirroring...)
  useEffect(() => {
    const parsed = text.trim() === '' ? undefined : Number(text);
    if (parsed !== value && !(parsed === undefined && !allowEmpty && value === emptyValue)) {
      setText(value === undefined ? '' : String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const parse = (raw: string): number | undefined | null => {
    if (raw.trim() === '') return allowEmpty ? undefined : emptyValue;
    const n = Number(raw);
    return Number.isFinite(n) ? clamp(n, min, max) : null; // null = not (yet) a number
  };

  const commit = (raw: string) => {
    const parsed = parse(raw);
    if (parsed === null) {
      setText(value === undefined ? '' : String(value));
      return;
    }
    if (parsed !== value) onChange(parsed);
    setText(parsed === undefined ? '' : String(parsed));
  };

  const parsedNow = parse(text);
  const outOfRange =
    text.trim() !== '' && Number.isFinite(Number(text)) && clamp(Number(text), min, max) !== Number(text);

  return (
    <TextField
      {...rest}
      type="text"
      value={text}
      error={error || parsedNow === null || outOfRange}
      helperText={
        outOfRange
          ? min !== undefined && Number(text) < min
            ? `Must be ≥ ${min}`
            : `Must be ≤ ${max}`
          : helperText
      }
      inputProps={{ inputMode: 'decimal', step, min, max, ...inputProps }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (!commitOnBlur) {
          const parsed = parse(raw);
          if (parsed !== null && parsed !== value) onChange(parsed);
        }
      }}
      onBlur={(e) => {
        commit(text);
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit(text);
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const base = parsedNow ?? value ?? 0;
          const delta = (step ?? 1) * (e.key === 'ArrowUp' ? 1 : -1);
          const next = clamp(Number((base + delta).toPrecision(12)), min, max);
          setText(String(next));
          onChange(next);
        }
        onKeyDown?.(e);
      }}
    />
  );
};

export default NumericField;
