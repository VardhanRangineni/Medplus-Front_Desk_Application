/**
 * App.jsx — Root component.
 *
 * Reads the booking context state and renders the correct step component.
 *
 * Step routing table:
 * ┌──────────────┬─────────────────────────────────────────────┐
 * │  currentStep │  userType = visitor   │  userType = employee │
 * ├──────────────┼───────────────────────┼─────────────────────┤
 * │  0           │  LandingPage          │  LandingPage         │
 * │  1           │  MobileOtpStep        │  EmployeeIdStep      │
 * │  2           │  VisitorDetailsStep   │  EmployeeDetailsStep │
 * │  3           │  ScheduleStep         │  ScheduleStep        │
 * │  4           │  ConfirmationStep     │  ConfirmationStep    │
 * └──────────────┴───────────────────────┴─────────────────────┘
 */

import { BookingProvider, useBooking } from './context/BookingContext';
import Layout         from './components/Layout';
import LandingPage    from './components/LandingPage';
import MobileOtpStep  from './components/steps/MobileOtpStep';
import EmployeeIdStep from './components/steps/EmployeeIdStep';
import VisitorDetailsStep  from './components/steps/VisitorDetailsStep';
import EmployeeDetailsStep from './components/steps/EmployeeDetailsStep';
import ScheduleStep        from './components/steps/ScheduleStep';
import ConfirmationStep    from './components/steps/ConfirmationStep';

function BookingRouter() {
  const { userType, currentStep } = useBooking();

  if (currentStep === 0 || !userType) return <LandingPage />;

  if (userType === 'visitor') {
    switch (currentStep) {
      case 1: return <MobileOtpStep />;
      case 2: return <VisitorDetailsStep />;
      case 3: return <ScheduleStep />;
      case 4: return <ConfirmationStep />;
      default: return <LandingPage />;
    }
  }

  if (userType === 'employee') {
    switch (currentStep) {
      case 1: return <EmployeeIdStep />;
      case 2: return <EmployeeDetailsStep />;
      case 3: return <ScheduleStep />;
      case 4: return <ConfirmationStep />;
      default: return <LandingPage />;
    }
  }

  return <LandingPage />;
}

export default function App() {
  return (
    <BookingProvider>
      <Layout>
        <BookingRouter />
      </Layout>
    </BookingProvider>
  );
}
