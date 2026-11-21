import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "positive" | "warning" | "negative" | "neutral";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Aktif", tone: "positive" },
  inactive: { label: "Nonaktif", tone: "neutral" },
  submitted: { label: "Menunggu", tone: "warning" },
  approved: { label: "Disetujui", tone: "positive" },
  rejected: { label: "Ditolak", tone: "negative" },
  sent: { label: "Dikirim", tone: "neutral" },
  partial: { label: "Sebagian", tone: "warning" },
  received: { label: "Diterima", tone: "positive" },
  cancelled: { label: "Dibatalkan", tone: "negative" },
  ordered: { label: "Sudah dipesan", tone: "neutral" },
  scheduled: { label: "Terjadwal", tone: "warning" },
  paid: { label: "Lunas", tone: "positive" },
  good: { label: "Baik", tone: "positive" },
  damaged: { label: "Rusak", tone: "negative" },
  short: { label: "Kurang", tone: "warning" },
  ok: { label: "Aman", tone: "positive" },
  low: { label: "Rendah", tone: "warning" },
  out: { label: "Habis", tone: "negative" },
};

const TONE_CLASS: Record<Tone, string> = {
  positive: "border-transparent bg-primary/10 text-primary",
  warning: "border-border bg-secondary text-secondary-foreground",
  negative: "border-transparent bg-destructive/10 text-destructive",
  neutral: "border-border bg-transparent text-muted-foreground",
};

export function statusLabel(status: string) {
  return STATUS[status]?.label ?? status;
}

export function StatusBadge({ status }: { status: string }) {
  const entry = STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return (
    <Badge variant="outline" className={cn("font-medium", TONE_CLASS[entry.tone])}>
      {entry.label}
    </Badge>
  );
}
