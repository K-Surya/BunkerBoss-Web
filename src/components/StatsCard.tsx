interface StatsCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "blue" | "green" | "amber" | "red";
  icon: React.ReactNode;
}

const StatsCard = ({ label, value, sub, accent = "blue", icon }: StatsCardProps) => {
  return (
    <div className={`stats-card stats-card--${accent}`}>
      <div className="stats-card-icon">{icon}</div>
      <div className="stats-card-body">
        <p className="stats-card-label">{label}</p>
        <p className="stats-card-value">{value}</p>
        {sub && <p className="stats-card-sub">{sub}</p>}
      </div>
    </div>
  );
};

export default StatsCard;
