import { Settings } from "lucide-react";

export default function SettingsTab() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Settings className="h-12 w-12 text-muted-foreground/50 mb-3" />
      <h3 className="font-heading text-lg font-semibold text-foreground">
        Event Settings
      </h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        Configure capacity, waitlist, hybrid mode, and event status.
      </p>
      <p className="text-xs text-muted-foreground/70 mt-4 italic">
        Coming in the next step
      </p>
    </div>
  );
}
