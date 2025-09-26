'use client';

import { useState, useCallback } from 'react';

export interface DialogOptions {
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'confirm';
  showCancel?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface DialogState {
  isOpen: boolean;
  options: DialogOptions | null;
}

export const useCustomDialog = () => {
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    options: null
  });

  const showDialog = useCallback((options: DialogOptions) => {
    setDialogState({
      isOpen: true,
      options
    });
  }, []);

  const hideDialog = useCallback(() => {
    setDialogState({
      isOpen: false,
      options: null
    });
  }, []);

  // Convenience methods
  const showSuccess = useCallback((title: string, message: string, onConfirm?: () => void) => {
    showDialog({
      title,
      message,
      type: 'success',
      onConfirm
    });
  }, [showDialog]);

  const showError = useCallback((title: string, message: string, onConfirm?: () => void) => {
    showDialog({
      title,
      message,
      type: 'error',
      onConfirm
    });
  }, [showDialog]);

  const showWarning = useCallback((title: string, message: string, onConfirm?: () => void) => {
    showDialog({
      title,
      message,
      type: 'warning',
      onConfirm
    });
  }, [showDialog]);

  const showInfo = useCallback((title: string, message: string, onConfirm?: () => void) => {
    showDialog({
      title,
      message,
      type: 'info',
      onConfirm
    });
  }, [showDialog]);

  const showConfirm = useCallback((
    title: string, 
    message: string, 
    onConfirm: () => void, 
    onCancel?: () => void,
    confirmText = 'Confirm',
    cancelText = 'Cancel'
  ) => {
    showDialog({
      title,
      message,
      type: 'confirm',
      showCancel: true,
      confirmText,
      cancelText,
      onConfirm,
      onCancel
    });
  }, [showDialog]);

  return {
    dialogState,
    showDialog,
    hideDialog,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirm
  };
};
