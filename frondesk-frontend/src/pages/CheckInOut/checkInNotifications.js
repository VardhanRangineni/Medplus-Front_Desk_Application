/**
 * Bottom-right toast messages after a successful check-in.
 */
export function notifyCheckInSuccess(showToast, result) {
  if (!showToast || !result) return;

  const type = (result.type || result.entryType || '').toUpperCase();
  const isEmployee = type === 'EMPLOYEE';

  if (isEmployee) {
    showToast({
      variant: 'info',
      title: 'Employee checked in',
      message: 'Remind the employee to wear their official ID badge.',
    });
    return;
  }

  if (result.card != null) {
    showToast({
      variant: 'success',
      title: 'Card assigned',
      message: `Hand card #${result.card} to the visitor.`,
    });
  }

  if (result.visitPassSmsStatus === 'PENDING') {
    showToast({
      variant: 'info',
      title: 'Visit pass sent',
      message: result.visitPassMessage || 'Visit pass is being sent to the visitor\'s mobile.',
    });
  }
}
