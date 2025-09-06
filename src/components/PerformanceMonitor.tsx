import React, { useState, useEffect } from 'react';

declare global {
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
    };
  }
}

interface PerformanceMetrics {
  loadTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  renderCount: number;
}

const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    renderCount: 0
  });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Measure page load time
    const loadTime = performance.now();
    setMetrics(prev => ({ ...prev, loadTime }));

    // Monitor memory usage (if available)
    if (performance && performance.memory) {
      const memory = performance.memory;
      setMetrics(prev => ({
        ...prev,
        memoryUsage: Math.round(memory.usedJSHeapSize / 1024 / 1024)
      }));
    }

    // Simulate cache hit rate (in real app, this would come from actual cache metrics)
    setMetrics(prev => ({
      ...prev,
      cacheHitRate: Math.round(Math.random() * 100)
    }));

    // Track render count
    setMetrics(prev => ({
      ...prev,
      renderCount: prev.renderCount + 1
    }));
  }, []);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-[#1976D2] text-white p-2 rounded-full shadow-lg hover:bg-[#1565C0] transition-colors z-50"
        title="Show Performance Monitor"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 min-w-[200px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Performance</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600">Load Time:</span>
          <span className="font-medium">{metrics.loadTime.toFixed(0)}ms</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Memory:</span>
          <span className="font-medium">{metrics.memoryUsage}MB</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Cache Hit:</span>
          <span className="font-medium">{metrics.cacheHitRate}%</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Renders:</span>
          <span className="font-medium">{metrics.renderCount}</span>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitor;