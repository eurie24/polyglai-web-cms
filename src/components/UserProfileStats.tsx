"use client";

import React from 'react';
import { useUserData } from '../hooks/useUserData';
import UserStatsCard from './UserStatsCard';

interface UserProfileStatsProps {
  userId: string;
}

const UserProfileStats: React.FC<UserProfileStatsProps> = ({ userId }) => {
  const { stats, isLoading, error, refreshData } = useUserData(userId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-lg p-6 animate-pulse h-24"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center justify-between">
        <span>Failed to load profile stats: {error}</span>
        <button className="text-sm text-red-700 underline" onClick={refreshData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <UserStatsCard
        icon="🔥"
        value={stats.streakDays}
        label="Day Streak"
        color="from-[#FF9800] to-[#F57C00]"
      />
      <UserStatsCard
        icon="📘"
        value={stats.lessonsCompleted}
        label="Lessons Passed"
        color="from-[#29B6F6] to-[#0288D1]"
      />
      <UserStatsCard
        icon="🎯"
        value={stats.assessmentCount}
        label="Assessments"
        color="from-[#9C27B0] to-[#6A1B9A]"
      />
      <UserStatsCard
        icon="⭐"
        value={stats.totalPoints}
        label="Points"
        color="from-[#4CAF50] to-[#2E7D32]"
      />
    </div>
  );
};

export default React.memo(UserProfileStats);


