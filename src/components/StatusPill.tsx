import { STATUS_CLASS, STATUS_LABEL, type Status } from "@/lib/library/constants";

export function StatusPill({
  status,
  className = "",
}: {
  status: Status;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_CLASS[status]} ${className}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
