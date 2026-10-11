const styles: Record<string, string> = {
  AVAILABLE: 'status-green', SERVED: 'status-green', COMPLETED: 'status-green', READY_FOR_PICKUP: 'status-gold', QUALITY_CHECK: 'status-gold',
  IN_PREPARATION: 'status-blue', PREPARING: 'status-blue', IN_PROGRESS: 'status-blue', FOOD_SERVING: 'status-blue',
  BLOCKED: 'status-red', OFF_DUTY: 'status-gray', CANCELLED: 'status-gray', CLEANING: 'status-gold', PAYMENT_PENDING: 'status-gold',
};

export function StatusBadge({ value }: { value: string }) {
  return <span className={`status-badge ${styles[value] ?? 'status-neutral'}`}>{value.replaceAll('_', ' ').toLowerCase()}</span>;
}
