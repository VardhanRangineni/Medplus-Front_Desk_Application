import { apiRequest } from './api';

export async function sendOtp(mobile) {
  const json = await apiRequest('POST', '/api/pre-register/public/otp/send', { mobile });
  if (!json.success) {
    throw new Error(json.message || 'Failed to send OTP.');
  }
  return json.data;
}

export async function verifyOtp(mobile, otp) {
  const json = await apiRequest('POST', '/api/pre-register/public/otp/verify', { mobile, otp });
  if (!json.success) {
    throw new Error(json.message || 'OTP verification failed.');
  }
  return json.data;
}

export async function verifyPersonToMeet(phone) {
  const json = await apiRequest(
    'GET',
    `/api/pre-register/public/hrms-verify-phone?phone=${encodeURIComponent(phone)}`,
  );
  if (!json.success || !json.data?.found) {
    return {
      found: false,
      message: json.message || json.data?.message || 'No employee found in HRMS for this mobile number.',
    };
  }
  return { found: true, data: json.data };
}

export async function verifyEmployee(id) {
  const json = await apiRequest(
    'GET',
    `/api/pre-register/public/hrms-verify?id=${encodeURIComponent(id)}`,
  );
  if (!json.success || !json.data?.found) {
    return {
      found: false,
      message: json.message || json.data?.message || 'No employee found in HRMS for this ID.',
    };
  }
  return { found: true, data: json.data };
}

export async function submitWalkIn(payload) {
  const json = await apiRequest('POST', '/api/pre-register/public/walk-in', payload);
  if (!json.success) {
    throw new Error(json.message || 'Submission failed.');
  }
  return json.data;
}
