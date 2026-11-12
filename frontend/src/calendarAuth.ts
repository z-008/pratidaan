/** Microsoft Graph access is requested only from a button click. */

import { microsoftGraphToken } from './microsoftAuth';

export const CALENDAR_SCOPES = ['User.Read', 'Calendars.ReadWrite', 'Mail.Send'].join(' ');

export function requestCalendarAccess(clientId: string) {
  return microsoftGraphToken(clientId);
}
