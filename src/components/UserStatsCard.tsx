import React from 'react';

interface UserStatsCardProps {
  icon: string;
  value: string | number;
  label: string;
  color?: string;
  gradient?: string;
}

const UserStatsCard: React.FC<UserStatsCardProps> = React.memo(({
  icon,
  value,
  label,
  color = 'from-[#4CAF50] to-[#2E7D32]'
}) => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center">
        <div className={`w-12 h-12 bg-gradient-to-br ${color} rounded-full flex items-center justify-center mr-4`}>
          <span className="text-white text-xl">{icon}</span>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-600">{label}</p>
        </div>
      </div>
    </div>
  );
});

UserStatsCard.displayName = 'UserStatsCard';

export default UserStatsCard;
