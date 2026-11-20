import { Chip, ChipRow } from '@/components/ui';
import type { Subject } from '@/lib/college';

/** Single-select subject chips with a "None" option. */
export function SubjectPicker({
  subjects,
  value,
  onChange,
}: {
  subjects: Subject[];
  value?: string;
  onChange: (id: string | undefined) => void;
}) {
  return (
    <ChipRow>
      <Chip label="None" selected={!value} onPress={() => onChange(undefined)} />
      {subjects.map((s) => (
        <Chip key={s.id} label={s.short || s.name} color={s.color} selected={value === s.id} onPress={() => onChange(s.id)} />
      ))}
    </ChipRow>
  );
}
