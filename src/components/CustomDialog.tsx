'use client';

import React from 'react';
import Image from 'next/image';

export interface CustomDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'confirm';
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

const CustomDialog: React.FC<CustomDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type,
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
  showCancel = false
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          titleColor: 'text-green-800',
          messageColor: 'text-green-700',
          buttonColor: 'bg-green-600 hover:bg-green-700',
          borderColor: 'border-green-200'
        };
      case 'error':
        return {
          titleColor: 'text-red-800',
          messageColor: 'text-red-700',
          buttonColor: 'bg-red-600 hover:bg-red-700',
          borderColor: 'border-red-200'
        };
      case 'warning':
        return {
          titleColor: 'text-yellow-800',
          messageColor: 'text-yellow-700',
          buttonColor: 'bg-yellow-600 hover:bg-yellow-700',
          borderColor: 'border-yellow-200'
        };
      case 'confirm':
        return {
          titleColor: 'text-blue-800',
          messageColor: 'text-blue-700',
          buttonColor: 'bg-blue-600 hover:bg-blue-700',
          borderColor: 'border-blue-200'
        };
      default: // info
        return {
          titleColor: 'text-blue-800',
          messageColor: 'text-blue-700',
          buttonColor: 'bg-blue-600 hover:bg-blue-700',
          borderColor: 'border-blue-200'
        };
    }
  };

  const { titleColor, messageColor, buttonColor, borderColor } = getColors();

  return (
    <div 
      className="fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all">
        {/* Header with PolyglAI Logo */}
        <div className="flex items-center justify-center p-6 border-b border-gray-200 relative">
          <div className="flex items-center justify-center">
            <Image 
              src="/polyglai_logo.png" 
              alt="PolyglAI" 
              width={60} 
              height={60} 
              className="h-12 w-auto"
            />
          </div>
          <button
            onClick={onClose}
            className="absolute right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center">
            <h3 className={`text-lg font-semibold ${titleColor} mb-3`}>
              {title}
            </h3>
            <p className={`text-sm ${messageColor} whitespace-pre-line`}>
              {message}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 bg-gray-50 rounded-b-xl">
          {showCancel && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-sm font-medium text-white ${buttonColor} rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomDialog;
