import DeviceMasterPanel from '../LocationMaster/DeviceMasterPanel';
import { getAssignedLocationIds, hasRole } from '../../services/locationScope';

/** Standalone Device Master screen (sidebar). */
export default function DeviceMaster({ session }) {
  const isPrimaryAdmin = hasRole(session, 'PRIMARY_ADMIN');
  // Supervisors may manage devices only at their assigned location(s).
  const locationLocked = !isPrimaryAdmin && hasRole(session, 'REGIONAL_ADMIN');
  const allowedLocationIds = locationLocked ? getAssignedLocationIds(session) : null;
  const lockedLocationId = locationLocked
    ? (allowedLocationIds[0] ?? session?.locationId ?? '')
    : null;
  const lockedLocationName = locationLocked
    ? (session?.locationName || lockedLocationId || 'Your location')
    : null;

  return (
    <DeviceMasterPanel
      locationLocked={locationLocked}
      lockedLocationId={lockedLocationId}
      lockedLocationName={lockedLocationName}
      allowedLocationIds={allowedLocationIds}
    />
  );
}
