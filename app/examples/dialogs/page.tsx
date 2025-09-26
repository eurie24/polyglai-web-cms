'use client';

import React from 'react';
import CustomDialog from '../../../src/components/CustomDialog';
import { useCustomDialog } from '../../../src/hooks/useCustomDialog';

export default function DialogExamplesPage() {
  const { dialogState, hideDialog, showSuccess, showError, showConfirm, showInfo } = useCustomDialog();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-[#0277BD] mb-4">Dialog Examples</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
            onClick={() => showSuccess('Success', 'Your action completed successfully!')}
          >
            Open Success Dialog
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
            onClick={() => showError('Error', 'Something went wrong. Please try again.')}
          >
            Open Error Dialog
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => showInfo('Info', 'This is an informational message.')}
          >
            Open Info Dialog
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-yellow-600 text-white hover:bg-yellow-700"
            onClick={() =>
              showConfirm(
                'Confirm Action',
                'Are you sure you want to proceed?',
                () => alert('Confirmed'),
                () => alert('Cancelled'),
                'Yes, proceed',
                'No, cancel'
              )
            }
          >
            Open Confirm Dialog
          </button>
        </div>

        {dialogState.isOpen && dialogState.options && (
          <CustomDialog
            isOpen={dialogState.isOpen}
            onClose={hideDialog}
            title={dialogState.options.title}
            message={dialogState.options.message}
            type={dialogState.options.type}
            onConfirm={dialogState.options.onConfirm}
            onCancel={dialogState.options.onCancel}
            confirmText={dialogState.options.confirmText}
            cancelText={dialogState.options.cancelText}
            showCancel={dialogState.options.type === 'confirm'}
          />
        )}
      </div>
    </div>
  );
}


