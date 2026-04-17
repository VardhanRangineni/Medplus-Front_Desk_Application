/**
 * BookingContext.jsx
 *
 * Central state management for the multi-step appointment booking flow.
 * Uses React Context + useReducer so state transitions are explicit and testable.
 *
 * State shape:
 * {
 *   userType:         'visitor' | 'employee' | null,
 *   currentStep:      0 | 1 | 2 | 3 | 4,
 *   verifiedMobile:   string | null,     (visitor flow)
 *   verifiedEmployee: object | null,     (employee flow)
 *   bookingDetails:   object | null,     (filled by details step)
 *   confirmation:     object | null,     (returned by backend after booking)
 * }
 *
 * Steps:
 *   0 → Landing (select user type)
 *   1 → Auth   (OTP for visitor / EmpId+OTP for employee)
 *   2 → Details form
 *   3 → Schedule (date + time picker)
 *   4 → Confirmation
 */

import { createContext, useContext, useReducer, useCallback } from 'react';

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  userType:         null,
  currentStep:      0,
  verifiedMobile:   null,
  verifiedEmployee: null,
  bookingDetails:   null,
  confirmation:     null,
};

// ── Action types ──────────────────────────────────────────────────────────────

export const ACTIONS = {
  SELECT_USER_TYPE:    'SELECT_USER_TYPE',
  OTP_VERIFIED:        'OTP_VERIFIED',       // visitor: mobile verified
  EMPLOYEE_VERIFIED:   'EMPLOYEE_VERIFIED',  // employee: empId+OTP verified
  SUBMIT_DETAILS:      'SUBMIT_DETAILS',
  BOOKING_CONFIRMED:   'BOOKING_CONFIRMED',
  GO_BACK:             'GO_BACK',
  RESET:               'RESET',
};

// ── Reducer ───────────────────────────────────────────────────────────────────

function bookingReducer(state, action) {
  switch (action.type) {

    case ACTIONS.SELECT_USER_TYPE:
      return {
        ...INITIAL_STATE,
        userType:    action.payload,
        currentStep: 1,
      };

    case ACTIONS.OTP_VERIFIED:
      return {
        ...state,
        verifiedMobile: action.payload,
        currentStep:    2,
      };

    case ACTIONS.EMPLOYEE_VERIFIED:
      return {
        ...state,
        verifiedEmployee: action.payload,   // { id, name, department, maskedPhone }
        currentStep:      2,
      };

    case ACTIONS.SUBMIT_DETAILS:
      return {
        ...state,
        bookingDetails: action.payload,
        currentStep:    3,
      };

    case ACTIONS.BOOKING_CONFIRMED:
      return {
        ...state,
        confirmation: action.payload,
        currentStep:  4,
      };

    case ACTIONS.GO_BACK:
      return {
        ...state,
        currentStep: Math.max(0, state.currentStep - 1),
      };

    case ACTIONS.RESET:
      return INITIAL_STATE;

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const BookingContext = createContext(null);

export function BookingProvider({ children }) {
  const [state, dispatch] = useReducer(bookingReducer, INITIAL_STATE);

  const selectUserType    = useCallback((type)    => dispatch({ type: ACTIONS.SELECT_USER_TYPE,  payload: type }),    []);
  const otpVerified       = useCallback((mobile)  => dispatch({ type: ACTIONS.OTP_VERIFIED,       payload: mobile }),  []);
  const employeeVerified  = useCallback((emp)     => dispatch({ type: ACTIONS.EMPLOYEE_VERIFIED,  payload: emp }),     []);
  const submitDetails     = useCallback((details) => dispatch({ type: ACTIONS.SUBMIT_DETAILS,     payload: details }), []);
  const bookingConfirmed  = useCallback((data)    => dispatch({ type: ACTIONS.BOOKING_CONFIRMED,  payload: data }),    []);
  const goBack            = useCallback(()        => dispatch({ type: ACTIONS.GO_BACK }),                              []);
  const reset             = useCallback(()        => dispatch({ type: ACTIONS.RESET }),                                []);

  return (
    <BookingContext.Provider value={{
      ...state,
      selectUserType,
      otpVerified,
      employeeVerified,
      submitDetails,
      bookingConfirmed,
      goBack,
      reset,
    }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBooking must be used inside <BookingProvider>');
  return ctx;
}
