'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, orderBy, limit, where, getCountFromServer } from 'firebase/firestore';
import { auth, db } from '../../../src/lib/firebase';

type AnalyticsData = {
  totalUsers: number;
  activeUsers: number;
  totalLanguages: number;
  usersByRole: {
    admin: number;
    user: number;
  };
  recentSignups: {
    date: string;
    count: number;
  }[];
  recentActivity: {
    date: string;
    count: number;
  }[];
};

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    totalUsers: 0,
    activeUsers: 0,
    totalLanguages: 0,
    usersByRole: {
      admin: 0,
      user: 0
    },
    recentSignups: [],
    recentActivity: []
  });
  const router = useRouter();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
      } else {
        fetchAnalyticsData();
      }
    });
    
    return () => unsubscribe();
  }, [router]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Get total users count
      const usersSnapshot = await getCountFromServer(collection(db, 'users'));
      const totalUsers = usersSnapshot.data().count;
      
      // Get admin users count
      const adminsSnapshot = await getCountFromServer(
        query(collection(db, 'users'), where('role', '==', 'admin'))
      );
      const adminCount = adminsSnapshot.data().count;
      
      // Get languages count
      const languagesSnapshot = await getCountFromServer(collection(db, 'languages'));
      const totalLanguages = languagesSnapshot.data().count;
      
      // Get last 30 days active users approximation
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const activeUsersSnapshot = await getCountFromServer(
        query(
          collection(db, 'users'), 
          where('lastLogin', '>=', thirtyDaysAgo.toISOString())
        )
      );
      const activeUsers = activeUsersSnapshot.data().count;
      
      // Get recent signups (dummy data for now - would be replaced with actual data)
      const recentSignups = generateDummyTimeSeriesData(7);
      
      // Get recent activity (dummy data for now - would be replaced with actual data)
      const recentActivity = generateDummyTimeSeriesData(7);
      
      setAnalyticsData({
        totalUsers,
        activeUsers,
        totalLanguages,
        usersByRole: {
          admin: adminCount,
          user: totalUsers - adminCount
        },
        recentSignups,
        recentActivity
      });
      
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to generate dummy time series data
  const generateDummyTimeSeriesData = (days: number) => {
    const data = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      data.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 20) + 1
      });
    }
    
    return data;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/dashboard">
              <Image src="/logo_txt.png" alt="PolyglAI Logo" width={120} height={40} />
            </Link>
          </div>
          <div className="flex items-center">
            <Link href="/dashboard" className="text-gray-700 hover:text-blue-600">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">System Analytics</h1>
          <p className="text-gray-600">View system-wide metrics and performance data</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading analytics data...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Total Users */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Total Users</h3>
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    Users
                  </span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{analyticsData.totalUsers}</p>
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <span className="text-green-600 font-medium">+{Math.floor(Math.random() * 10)}%</span>
                  <span className="ml-1">from last month</span>
                </div>
              </div>

              {/* Active Users */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Active Users</h3>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                    Last 30 Days
                  </span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{analyticsData.activeUsers}</p>
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <span className="text-green-600 font-medium">
                    {Math.round((analyticsData.activeUsers / analyticsData.totalUsers) * 100)}%
                  </span>
                  <span className="ml-1">of total users</span>
                </div>
              </div>

              {/* Total Languages */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Languages</h3>
                  <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                    Content
                  </span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{analyticsData.totalLanguages}</p>
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <span>Available for learning</span>
                </div>
              </div>

              {/* User Types */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">User Types</h3>
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                    Roles
                  </span>
                </div>
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Admins</p>
                    <p className="text-xl font-bold text-gray-900">{analyticsData.usersByRole.admin}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Regular Users</p>
                    <p className="text-xl font-bold text-gray-900">{analyticsData.usersByRole.user}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Signups */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Signups</h3>
                <div className="h-80 flex flex-col justify-between">
                  <div className="relative h-64">
                    <div className="absolute inset-0 flex items-end">
                      {analyticsData.recentSignups.map((item, index) => (
                        <div key={index} className="flex-1 flex flex-col items-center justify-end h-full">
                          <div 
                            className="w-4/5 bg-blue-500 rounded-t-md"
                            style={{ height: `${(item.count / 20) * 100}%` }}
                          ></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    {analyticsData.recentSignups.map((item, index) => (
                      <div key={index} className="text-xs text-gray-500">
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">User Activity</h3>
                <div className="h-80 flex flex-col justify-between">
                  <div className="relative h-64">
                    <div className="absolute inset-0 flex items-end">
                      {analyticsData.recentActivity.map((item, index) => (
                        <div key={index} className="flex-1 flex flex-col items-center justify-end h-full">
                          <div 
                            className="w-4/5 bg-green-500 rounded-t-md"
                            style={{ height: `${(item.count / 20) * 100}%` }}
                          ></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    {analyticsData.recentActivity.map((item, index) => (
                      <div key={index} className="text-xs text-gray-500">
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
} 