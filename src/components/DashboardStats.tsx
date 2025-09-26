'use client';

import React, { memo, useMemo } from 'react';

type User = {
  id: string;
  name?: string;
  email?: string;
  location?: string;
  profession?: string;
  gender?: string;
  age?: number | string;
  createdAt?: string;
  lastLogin?: string;
  profileImage?: string;
  languages?: string[];
  progress?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  totalPoints?: number;
  featuresUsage?: {
    translator?: number;
    fileTranslator?: number;
    cameraTranslator?: number;
    wordAssessment?: number;
    [key: string]: number | undefined;
  };
  updatedAt?: string;
  preferredLanguage?: string;
  referralSource?: string;
};

interface DashboardStatsProps {
  users: User[];
}

// Memoized chart component
const ChartBar = memo(({ 
  label, 
  count, 
  percentage, 
  color 
}: { 
  label: string; 
  count: number; 
  percentage: number; 
  color: string;
}) => {
  const barWidth = `${Math.max(percentage, 1)}%`;
  
  return (
    <div className="flex items-center mb-1 lg:mb-2 xl:mb-3">
      <div className="w-20 lg:w-24 xl:w-32 text-xs lg:text-sm font-medium text-gray-700 truncate">
        {label}
      </div>
      <div className="flex-1 mx-1 lg:mx-2">
        <div className="h-3 lg:h-4 xl:h-6 bg-gray-100 rounded-lg overflow-hidden">
          <div 
            className={`h-full ${color}`} 
            style={{ width: barWidth }}
          ></div>
        </div>
      </div>
      <div className="w-10 lg:w-12 xl:w-16 text-right text-xs lg:text-sm font-semibold">
        {count} <span className="text-xs text-gray-500 hidden lg:inline">({percentage.toFixed(1)}%)</span>
      </div>
    </div>
  );
});

ChartBar.displayName = 'ChartBar';

// Memoized gender distribution component
const GenderDistribution = memo(({ users }: { users: User[] }) => {
  // Helper function to normalize gender values for consistent matching
  const normalizeGender = (gender?: string): string => {
    if (!gender) return '';
    const normalized = gender.trim();
    
    // Handle various Non-binary formats
    if (normalized === 'Non - Binary' || normalized === 'Non Binary' || normalized === 'Non-Binary' || normalized === 'Non-binary') {
      return 'Non-binary';
    }
    
    return normalized;
  };

  const genderData = useMemo(() => {
    const genders = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
    return genders.map(gender => {
      const count = users.filter(u => normalizeGender(u.gender) === gender).length;
      const percentage = users.length > 0 ? (count / users.length) * 100 : 0;
      const color = gender === 'Male' ? 'bg-[#29B6F6]' : 
                   gender === 'Female' ? 'bg-[#E91E63]' : 
                   gender === 'Non-binary' ? 'bg-[#9C27B0]' : 'bg-[#607D8B]';
      
      return { gender, count, percentage, color };
    });
  }, [users]);

  return (
    <div className="bg-white p-3 lg:p-4 xl:p-6 rounded-xl xl:rounded-2xl shadow-md">
      <h3 className="text-sm lg:text-base xl:text-lg font-medium mb-3 xl:mb-4 text-[#0277BD]">
        Gender Distribution
      </h3>
      <div className="h-40 lg:h-48 xl:h-64 flex flex-col justify-between">
        {genderData.map(({ gender, count, percentage, color }) => (
          <ChartBar
            key={gender}
            label={gender}
            count={count}
            percentage={percentage}
            color={color}
          />
        ))}
      </div>
    </div>
  );
});

GenderDistribution.displayName = 'GenderDistribution';

// Memoized age distribution component
const AgeDistribution = memo(({ users }: { users: User[] }) => {
  const ageData = useMemo(() => {
    const ageGroups = ['Under 18', '18-24', '25-34', '35-44', '45+'];
    return ageGroups.map(ageGroup => {
      const count = users.filter(u => {
        if (typeof u.age === 'string') {
          const ageStr = String(u.age);
          if (ageStr === ageGroup) return true;
          if (ageGroup === 'Under 18' && (ageStr.includes('Under 18') || ageStr.toLowerCase().includes('under 18'))) return true;
          if (ageGroup === '18-24' && (ageStr.includes('18 - 24') || ageStr.includes('18-24'))) return true;
          if (ageGroup === '25-34' && (ageStr.includes('25 - 34') || ageStr.includes('25-34'))) return true;
          if (ageGroup === '35-44' && (ageStr.includes('35 - 44') || ageStr.includes('35-44'))) return true;
          if (ageGroup === '45+' && (ageStr.includes('45+') || ageStr.includes('45 +') || ageStr.includes('45'))) return true;
          return false;
        } else if (typeof u.age === 'number') {
          if (ageGroup === 'Under 18') return u.age < 18;
          if (ageGroup === '18-24') return u.age >= 18 && u.age <= 24;
          if (ageGroup === '25-34') return u.age >= 25 && u.age <= 34;
          if (ageGroup === '35-44') return u.age >= 35 && u.age <= 44;
          if (ageGroup === '45+') return u.age >= 45;
        }
        return false;
      }).length;
      const percentage = users.length > 0 ? (count / users.length) * 100 : 0;
      
      return { ageGroup, count, percentage };
    });
  }, [users]);

  return (
    <div className="bg-white p-3 lg:p-4 xl:p-6 rounded-xl xl:rounded-2xl shadow-md">
      <h3 className="text-sm lg:text-base xl:text-lg font-medium mb-3 xl:mb-4 text-[#0277BD]">
        Age Distribution
      </h3>
      <div className="h-40 lg:h-48 xl:h-64 flex flex-col justify-between">
        {ageData.map(({ ageGroup, count, percentage }) => (
          <ChartBar
            key={ageGroup}
            label={ageGroup}
            count={count}
            percentage={percentage}
            color="bg-[#0288D1]"
          />
        ))}
      </div>
    </div>
  );
});

AgeDistribution.displayName = 'AgeDistribution';

// Memoized location distribution component
const LocationDistribution = memo(({ users }: { users: User[] }) => {
  const locationData = useMemo(() => {
    const locations = ['Asia - Pacific', 'Americas', 'Europe', 'Africa', 'Middle East'];
    return locations.map(location => {
      const count = users.filter(u => u.location === location).length;
      const percentage = users.length > 0 ? (count / users.length) * 100 : 0;
      
      return { location, count, percentage };
    });
  }, [users]);

  return (
    <div className="bg-white p-3 lg:p-4 xl:p-6 rounded-xl xl:rounded-2xl shadow-md overflow-hidden">
      <h3 className="text-sm lg:text-base xl:text-lg font-medium mb-3 xl:mb-4 text-[#0277BD]">
        Location Distribution
      </h3>
      <div className="max-h-32 lg:max-h-40 xl:max-h-48 overflow-y-auto pr-2">
        <div className="space-y-1 lg:space-y-2 xl:space-y-3">
          {locationData.map(({ location, count, percentage }) => (
            <div key={location} className="flex items-center">
              <div className="w-20 lg:w-24 xl:w-32 truncate text-xs lg:text-sm font-medium text-gray-700">
                {location}
              </div>
              <div className="flex-1 mx-1 lg:mx-2">
                <div className="h-3 lg:h-4 xl:h-5 bg-gray-100 rounded-lg overflow-hidden">
                  <div 
                    className="h-full bg-[#1A237E]" 
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
              <div className="w-12 lg:w-16 xl:w-20 text-right text-xs lg:text-sm font-semibold">
                {count} <span className="text-xs text-gray-500 hidden lg:inline">({percentage.toFixed(1)}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

LocationDistribution.displayName = 'LocationDistribution';

// Memoized profession distribution component
const ProfessionDistribution = memo(({ users }: { users: User[] }) => {
  const professionData = useMemo(() => {
    const professions = ['Student', 'Educator', 'Professional', 'Technology', 'Arts & Entertainment', 'Other'];
    return professions.map(profession => {
      const count = users.filter(u => u.profession === profession).length;
      const percentage = users.length > 0 ? (count / users.length) * 100 : 0;
      
      return { profession, count, percentage };
    });
  }, [users]);

  return (
    <div className="bg-white p-3 lg:p-4 xl:p-6 rounded-xl xl:rounded-2xl shadow-md overflow-hidden">
      <h3 className="text-sm lg:text-base xl:text-lg font-medium mb-3 xl:mb-4 text-[#0277BD]">
        Profession Distribution
      </h3>
      <div className="max-h-32 lg:max-h-40 xl:max-h-48 overflow-y-auto pr-2">
        <div className="space-y-1 lg:space-y-2 xl:space-y-3">
          {professionData.map(({ profession, count, percentage }) => (
            <div key={profession} className="flex items-center">
              <div className="w-20 lg:w-24 xl:w-32 truncate text-xs lg:text-sm font-medium text-gray-700">
                {profession}
              </div>
              <div className="flex-1 mx-1 lg:mx-2">
                <div className="h-3 lg:h-4 xl:h-5 bg-gray-100 rounded-lg overflow-hidden">
                  <div 
                    className="h-full bg-[#0277BD]" 
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
              <div className="w-12 lg:w-16 xl:w-20 text-right text-xs lg:text-sm font-semibold">
                {count} <span className="text-xs text-gray-500 hidden lg:inline">({percentage.toFixed(1)}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

ProfessionDistribution.displayName = 'ProfessionDistribution';

// Main dashboard stats component
const DashboardStats = memo<DashboardStatsProps>(({ users }) => {
  return (
    <div className="mb-6 xl:mb-8 grid grid-cols-1 xl:grid-cols-2 gap-3 lg:gap-4 xl:gap-6 max-w-none">
      <GenderDistribution users={users} />
      <AgeDistribution users={users} />
      <LocationDistribution users={users} />
      <ProfessionDistribution users={users} />
    </div>
  );
});

DashboardStats.displayName = 'DashboardStats';

export default DashboardStats;
