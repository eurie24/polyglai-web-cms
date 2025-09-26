'use client';

import React, { memo, useMemo, useState, useCallback } from 'react';

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

interface UserTableProps {
  users: User[];
  loading?: boolean;
  onUserProgressClick?: (userId: string) => void;
}

// Memoized user row component
const UserRow = memo(({ 
  user, 
  index,
  normalizeGender
}: { 
  user: User; 
  index: number;
  normalizeGender: (gender?: string) => string;
}) => {

  return (
    <tr className={index % 2 === 0 ? 'bg-gray-50' : ''}>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
        <div className="text-xs sm:text-sm font-medium text-gray-900">
          {user.name || 'Unknown'}
        </div>
        <div className="sm:hidden text-xs text-gray-500 mt-1">
          {user.email || 'No email'}
        </div>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
        <div className="text-xs sm:text-sm text-gray-800">
          {user.email || 'No email'}
        </div>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
        <div className="text-xs sm:text-sm text-gray-800">
          {user.preferredLanguage || 'Unknown'}
        </div>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
        <div className="text-xs sm:text-sm text-gray-800">
          {user.age || 'Unknown'}
        </div>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
        <div className="text-xs sm:text-sm text-gray-800">
          {user.profession || 'Unknown'}
        </div>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
        <div className="text-xs sm:text-sm text-gray-800">
          {user.location || 'Unknown'}
        </div>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
        <div className="text-xs sm:text-sm text-gray-800">
          {normalizeGender(user.gender)}
        </div>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
        <div className="text-xs sm:text-sm text-gray-800">
          {user.referralSource || 'Unknown'}
        </div>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
        <div className="text-xs sm:text-sm text-gray-800">
          {user.createdAt && typeof user.createdAt === 'string'
            ? new Date(user.createdAt).toLocaleDateString()
            : user.createdAt && typeof user.createdAt === 'object' && 'toLocaleDateString' in user.createdAt
              ? (user.createdAt as Date).toLocaleDateString()
              : 'Unknown'}
        </div>
      </td>
    </tr>
  );
});

UserRow.displayName = 'UserRow';

// Memoized user table component
const UserTable = memo<UserTableProps>(({ users, loading }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);
  const [showAllUsers, setShowAllUsers] = useState(false);

  // Helper function to normalize gender for display
  const normalizeGender = (gender?: string): string => {
    if (!gender) return 'Unknown';
    const normalized = gender.trim();
    
    // Handle various Non-binary formats
    if (normalized === 'Non - Binary' || normalized === 'Non Binary' || normalized === 'Non-Binary' || normalized === 'Non-binary') {
      return 'Non-binary';
    }
    
    return normalized;
  };

  // Memoized pagination calculations
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(users.length / usersPerPage);
    const startIndex = (currentPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    const paginatedUsers = showAllUsers ? users : users.slice(startIndex, endIndex);
    
    return {
      totalPages,
      paginatedUsers,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1
    };
  }, [users, currentPage, usersPerPage, showAllUsers]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleShowAll = useCallback(() => {
    setShowAllUsers(true);
  }, []);

  const handleShowPaged = useCallback(() => {
    setShowAllUsers(false);
    setCurrentPage(1);
  }, []);

  if (loading) {
    return (
      <div className="bg-white shadow overflow-hidden rounded-2xl">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200"></div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 border-b border-gray-200"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-[#0277BD]/10">
            <tr>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-[#0277BD] uppercase tracking-wider">
                Full name
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-[#0277BD] uppercase tracking-wider hidden sm:table-cell">
                Email
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-[#0277BD] uppercase tracking-wider hidden md:table-cell">
                Preferred Language
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-[#0277BD] uppercase tracking-wider hidden lg:table-cell">
                Age
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-[#0277BD] uppercase tracking-wider hidden lg:table-cell">
                Profession
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-[#0277BD] uppercase tracking-wider hidden xl:table-cell">
                Location
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-[#0277BD] uppercase tracking-wider hidden xl:table-cell">
                Gender
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-[#0277BD] uppercase tracking-wider hidden xl:table-cell">
                Referral
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-[#0277BD] uppercase tracking-wider hidden xl:table-cell">
                Created At
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginationData.paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 sm:px-6 py-4 text-center text-gray-800 text-sm sm:text-base">
                  No users found
                </td>
              </tr>
            ) : (
              paginationData.paginatedUsers.map((user, index) => (
                <UserRow
                  key={user.id}
                  user={user}
                  index={index}
                  normalizeGender={normalizeGender}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!showAllUsers && paginationData.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-6 py-3 bg-gray-50">
          <div className="flex items-center">
            <button 
              className={`px-2 py-1 ${!paginationData.hasPrevPage ? 'text-gray-400 cursor-not-allowed' : 'text-[#0277BD] hover:bg-[#29B6F6]/20'} rounded`}
              onClick={() => paginationData.hasPrevPage && handlePageChange(currentPage - 1)}
              disabled={!paginationData.hasPrevPage}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
              </svg>
            </button>
            
            {Array.from({ length: Math.min(5, paginationData.totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (paginationData.totalPages > 5) {
                if (currentPage > 3) {
                  if (currentPage > paginationData.totalPages - 2) {
                    pageNum = paginationData.totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                }
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`px-2 py-1 mx-1 ${
                    currentPage === pageNum
                      ? 'bg-[#29B6F6] text-white rounded-md'
                      : 'text-[#0277BD] hover:bg-[#29B6F6]/20 rounded-md'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button 
              className={`px-2 py-1 ${!paginationData.hasNextPage ? 'text-gray-400 cursor-not-allowed' : 'text-[#0277BD] hover:bg-[#29B6F6]/20'} rounded`}
              onClick={() => paginationData.hasNextPage && handlePageChange(currentPage + 1)}
              disabled={!paginationData.hasNextPage}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </button>
          </div>
          <button 
            className="text-[#0288D1] hover:underline"
            onClick={handleShowAll}
          >
            Show all
          </button>
        </div>
      )}
      
      {showAllUsers && users.length > 10 && (
        <div className="flex justify-end mt-4 px-6 py-3 bg-gray-50">
          <button 
            className="text-[#0288D1] hover:underline"
            onClick={handleShowPaged}
          >
            Show paged
          </button>
        </div>
      )}
    </div>
  );
});

UserTable.displayName = 'UserTable';

export default UserTable;
