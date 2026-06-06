// Transitional shim — replaced by TaskSheet in Phase 10
// Plan 10-04 updates feed/page.tsx to import TaskSheet directly; this file will be deleted after.
import { TaskSheet } from './TaskSheet';

interface QuickCreateSheetProps {
  onSubmit: (title: string, startAt: string, duration: number) => Promise<void>;
  onCancel: () => void;
  defaultStartAt: string;
  defaultDuration?: number;
}

export function QuickCreateSheet({ onSubmit, onCancel, defaultStartAt, defaultDuration }: QuickCreateSheetProps) {
  return (
    <TaskSheet
      onSave={onSubmit}
      onCancel={onCancel}
      defaultStartAt={defaultStartAt}
      defaultDuration={defaultDuration}
    />
  );
}
