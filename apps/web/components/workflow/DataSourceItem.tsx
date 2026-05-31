export type DataSourceItemProps = { icon: string; name: string; subtitle: string };

export function DataSourceItem({ icon, name, subtitle }: DataSourceItemProps) {
  return <div className="workflow-data-source-item"><span>{icon}</span><div><strong>{name}</strong><small>{subtitle}</small></div></div>;
}
