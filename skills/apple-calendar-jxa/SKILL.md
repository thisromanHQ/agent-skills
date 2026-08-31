---
name: apple-calendar-jxa
description: Use when working with macOS Calendar.app or Apple Calendar events through inline `osascript -l JavaScript` (JXA), including listing calendars, reading, creating, updating, and deleting events.
license: MIT
metadata:
  author: roman-pinchuk
  version: "1.1.0"
  repository: https://github.com/roman-pinchuk/agent-skills
---

# Apple Calendar JXA

Use this skill to interact directly with the host's macOS Calendar.app through
native inline JXA. Do not search for or execute external wrapper scripts.

## Scope

- Use `/usr/bin/osascript -l JavaScript` with a single-quoted heredoc for every
  Calendar operation.
- Prefer read-only discovery before writes.
- Use exact calendar names discovered from Calendar.app. Names are case-sensitive
  and may contain leading or trailing whitespace.
- Do not use AppleScript, UI automation, keyboard events, mouse events, or a
  third-party calendar CLI for these operations.

## Safety

- Calendar data is private. Return only fields needed for the request and use
  bounded time windows when reading.
- macOS may ask the launching terminal or agent to control Calendar.app. Explain
  the Automation permission prompt and stop if access is denied.
- Ask for confirmation before deletion unless the user explicitly requested the
  exact deletion. Never delete an event based only on a title when an event ID
  is available.
- For writes, read the target calendar first, perform the requested operation,
  then verify the resulting event by ID.
- A non-zero `osascript` exit status means the operation was not confirmed. Do
  not infer success from partial output.
- The optional EventKit travel mode uses private selectors. Feature-detect them,
  disclose that they are unsupported by Apple, and fall back if unavailable.

## Dates And Values

- Require UTC ISO 8601 timestamps in the form
  `YYYY-MM-DDTHH:MM:SSZ` or `YYYY-MM-DDTHH:MM:SS.mmmZ`.
- Use `new Date(ISO_VALUE)` only after validating the original string and reject
  invalid dates or an end that is not later than the start.
- Replace placeholders with JSON string literals, not raw interpolated text.
  This safely handles quotes, backslashes, and newlines in titles and notes.
- Use a half-open time window: include an event when `eventStart < end` and
  `eventEnd > start`, so adjacent windows do not duplicate boundary events.

## Shared Helpers

Use these helpers at the beginning of an inline script. Replace
`CALENDAR_NAME_JSON` with a JSON-encoded string literal, for example
`"Private "`.

```bash
osascript -l JavaScript <<'EOF'
const app = Application("Calendar");

function calendarByExactName(name) {
    const matches = app.calendars().filter(c => c.name() === name);
    if (matches.length === 0) throw new Error(`Calendar not found: ${name}`);
    if (matches.length > 1) throw new Error(`Calendar name is not unique: ${name}`);
    return matches[0];
}

function utcDate(value, field) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
        throw new Error(`${field} must be a UTC ISO 8601 timestamp`);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`${field} is invalid`);
    return date;
}

function eventJson(event) {
    return {
        id: event.id(),
        title: event.summary() || "",
        start: event.startDate().toISOString(),
        end: event.endDate().toISOString(),
        location: event.location() || "",
        description: event.description() || ""
    };
}

const calendarName = CALENDAR_NAME_JSON;
const cal = calendarByExactName(calendarName);
JSON.stringify({name: cal.name(), writable: cal.writable()});
EOF
```

If the user does not specify a calendar, use `Calendar` or `Personal` only when
exactly one calendar with that name exists. Otherwise list calendars and ask the
user to choose one. Do not silently select the first calendar.

## List Calendars

Calendar scripting on some macOS versions exposes calendar names and
`writable()`, but `id()` can fail with AppleEvent error `-10000`. Do not request
calendar IDs. Use an index only for display; resolve the final operation by the
exact name and reject duplicate names.

```bash
osascript -l JavaScript <<'EOF'
const app = Application("Calendar");
const calendars = app.calendars().map((cal, index) => ({
    index,
    name: cal.name(),
    writable: cal.writable()
}));
JSON.stringify(calendars, null, 2);
EOF
```

## Read Events

Replace `CALENDAR_NAME_JSON`, `START_ISO_JSON`, and `END_ISO_JSON` with JSON
string literals. This returns events overlapping the requested interval.

```bash
osascript -l JavaScript <<'EOF'
const app = Application("Calendar");
function calendarByExactName(name) {
    const matches = app.calendars().filter(c => c.name() === name);
    if (matches.length === 0) throw new Error(`Calendar not found: ${name}`);
    if (matches.length > 1) throw new Error(`Calendar name is not unique: ${name}`);
    return matches[0];
}
function utcDate(value, field) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) throw new Error(`${field} must be UTC ISO 8601`);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`${field} is invalid`);
    return date;
}
function eventJson(event) {
    return {id: event.id(), title: event.summary() || "", start: event.startDate().toISOString(), end: event.endDate().toISOString(), location: event.location() || "", description: event.description() || ""};
}
const cal = calendarByExactName(CALENDAR_NAME_JSON);
const start = utcDate(START_ISO_JSON, "start");
const end = utcDate(END_ISO_JSON, "end");
if (end <= start) throw new Error("end must be later than start");
const events = cal.events().filter(event => event.startDate() < end && event.endDate() > start).map(eventJson);
JSON.stringify(events, null, 2);
EOF
```

## Create, Update, And Delete

Use the same `calendarByExactName`, `utcDate`, and `eventJson` helpers above.
Replace every value placeholder with a JSON string literal.

Create an event:

```javascript
const cal = calendarByExactName(CALENDAR_NAME_JSON);
if (!cal.writable()) throw new Error("Calendar is not writable");
const start = utcDate(START_ISO_JSON, "start");
const end = utcDate(END_ISO_JSON, "end");
if (end <= start) throw new Error("end must be later than start");
const event = app.Event({summary: TITLE_JSON, startDate: start, endDate: end, location: LOCATION_JSON, description: DESCRIPTION_JSON});
cal.events.push(event);
JSON.stringify({status: "success", event: eventJson(event)}, null, 2);
```

Update only the fields requested by the user. Resolve by ID and verify the
calendar is writable first:

```javascript
const cal = calendarByExactName(CALENDAR_NAME_JSON);
if (!cal.writable()) throw new Error("Calendar is not writable");
const event = cal.events.byId(EVENT_ID_JSON);
if (!event.exists()) throw new Error("Event not found");
event.summary = TITLE_JSON;
const newStart = utcDate(START_ISO_JSON, "start");
const newEnd = utcDate(END_ISO_JSON, "end");
if (newEnd <= newStart) throw new Error("end must be later than start");
// Calendar.app validates each assignment, so avoid a temporary invalid range.
if (newStart > event.endDate()) {
    event.endDate = newEnd;
    event.startDate = newStart;
} else {
    event.startDate = newStart;
    event.endDate = newEnd;
}
event.location = LOCATION_JSON;
JSON.stringify({status: "success", event: eventJson(event)}, null, 2);
```

Only include assignments for fields being changed. If changing one endpoint,
read the other endpoint first and preserve it; always re-check that end remains
later than start. When both endpoints change, assign them in an order that does
not create a temporary invalid range, as shown above.

Delete by ID and verify the object no longer exists:

```javascript
const cal = calendarByExactName(CALENDAR_NAME_JSON);
if (!cal.writable()) throw new Error("Calendar is not writable");
const event = cal.events.byId(EVENT_ID_JSON);
if (!event.exists()) throw new Error("Event not found");
const title = event.summary() || "";
app.delete(event);
if (cal.events.byId(EVENT_ID_JSON).exists()) throw new Error("Calendar did not confirm deletion");
JSON.stringify({status: "success", deleted: title}, null, 2);
```

These mutation snippets are JavaScript bodies and must be placed inside the
same `osascript -l JavaScript <<'EOF'` heredoc as the helper definitions.

## EventKit Travel Mode (Opt-In)

Use this mode only when the user explicitly wants Calendar-style travel event
metadata, such as separate departure and arrival time zones or a map-backed
airport location. The stable Calendar.app JXA workflow remains the default.

EventKit is a separate authorization boundary. A process may have write-only
access, full access, or no access. Write-only access can create an event only in
`defaultCalendarForNewEvents`; it cannot enumerate named calendars or re-fetch
the saved event. Full access is required to select `Private ` by name and to
read, update, delete, or verify an EventKit event. Do not assume Calendar.app
Automation permission grants EventKit access.

The public EventKit API supports `structuredLocation`, `URL`, and one public
`timeZone`. Calendar.app and EventKit also expose private selectors on some
macOS versions: `startTimeZone`, `endTimeZone`, `setStartTimeZone:`, and
`setEndTimeZone:`. These are the selectors Siri appears to use for cross-timezone
travel events. They are not an Apple-supported API and must be checked at
runtime before use.

Do not use private selectors to edit an existing event unless the user has
explicitly approved this experimental mode. If a private setter is unavailable,
preserve the correct UTC instants, use the public event timezone, and put both
airport-local times and IANA timezone names in the notes.

### Airport Map Lookup

Use MapKit to resolve an airport and require the user to confirm the selected
result before saving. Do not invent coordinates or silently accept the first
result when multiple results are returned. `MKLocalSearch` is asynchronous, so
keep the run loop alive while waiting and fail on timeout.

```bash
osascript -l JavaScript <<'EOF'
ObjC.import("Foundation");
ObjC.import("MapKit");

function mapItemForAirport(query) {
    const request = $.MKLocalSearchRequest.alloc.init;
    request.naturalLanguageQuery = query;
    const search = $.MKLocalSearch.alloc.initWithRequest(request);
    let done = false;
    let result = null;
    let failure = null;
    search.startWithCompletionHandler((response, error) => {
        try {
            if (error) throw new Error(ObjC.unwrap(error.localizedDescription));
            if (Number(response.mapItems.count) === 0) throw new Error(`Airport not found: ${query}`);
            result = response.mapItems.objectAtIndex(0);
        } catch (error) {
            failure = String(error);
        }
        done = true;
    });
    const deadline = Date.now() + 15000;
    while (!done && Date.now() < deadline) {
        $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.1));
    }
    if (!done) throw new Error("MapKit airport lookup timed out");
    if (failure) throw new Error(failure);
    return result;
}

const item = mapItemForAirport("Ben Gurion Airport, Israel");
JSON.stringify({name: ObjC.unwrap(item.name)}, null, 2);
EOF
```

### Create A Cross-Timezone Event

This template uses EventKit and MapKit in one inline script. Replace values with
JSON string literals. It requires full EventKit access when `CALENDAR_NAME_JSON`
is not the default calendar. The two UTC timestamps are the source of truth;
the local strings are explanatory notes for clients that display one timezone.

```bash
osascript -l JavaScript <<'EOF'
ObjC.import("Foundation");
ObjC.import("EventKit");
ObjC.import("MapKit");

const calendarName = CALENDAR_NAME_JSON;
const title = TITLE_JSON;
const startISO = START_ISO_JSON;
const endISO = END_ISO_JSON;
const departureZoneName = DEPARTURE_TIMEZONE_JSON;
const arrivalZoneName = ARRIVAL_TIMEZONE_JSON;
const departureLocal = DEPARTURE_LOCAL_JSON;
const arrivalLocal = ARRIVAL_LOCAL_JSON;
const departureAirport = DEPARTURE_AIRPORT_JSON;
const arrivalAirport = ARRIVAL_AIRPORT_JSON;
const store = $.EKEventStore.alloc.init;

function dateFromISO(value, field) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) throw new Error(`${field} must be UTC ISO 8601`);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`${field} is invalid`);
    return $.NSDate.dateWithTimeIntervalSince1970(date.getTime() / 1000);
}

function airportMapItem(query) {
    const request = $.MKLocalSearchRequest.alloc.init;
    request.naturalLanguageQuery = query;
    const search = $.MKLocalSearch.alloc.initWithRequest(request);
    let done = false;
    let result = null;
    let failure = null;
    search.startWithCompletionHandler((response, error) => {
        try {
            if (error) throw new Error(ObjC.unwrap(error.localizedDescription));
            if (Number(response.mapItems.count) === 0) throw new Error(`Airport not found: ${query}`);
            result = response.mapItems.objectAtIndex(0);
        } catch (error) { failure = String(error); }
        done = true;
    });
    const deadline = Date.now() + 15000;
    while (!done && Date.now() < deadline) $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.1));
    if (!done) throw new Error("MapKit airport lookup timed out");
    if (failure) throw new Error(failure);
    return result;
}

const calendars = store.calendarsForEntityType(0);
let cal = null;
for (let i = 0; i < Number(calendars.count); i++) {
    const candidate = calendars.objectAtIndex(i);
    if (ObjC.unwrap(candidate.title) === calendarName) {
        if (cal) throw new Error(`Calendar name is not unique: ${calendarName}`);
        cal = candidate;
    }
}
if (!cal) throw new Error(`Calendar not found through EventKit: ${calendarName}`);

const start = dateFromISO(startISO, "start");
const end = dateFromISO(endISO, "end");
if (end.timeIntervalSince1970 <= start.timeIntervalSince1970) throw new Error("end must be later than start");
const startZone = $.NSTimeZone.timeZoneWithName(departureZoneName);
const endZone = $.NSTimeZone.timeZoneWithName(arrivalZoneName);
if (!startZone || !endZone) throw new Error("Unknown IANA timezone");
if (!$.EKEvent.instancesRespondToSelector("setStartTimeZone:") || !$.EKEvent.instancesRespondToSelector("setEndTimeZone:")) throw new Error("Private EventKit timezone selectors are unavailable");

const event = $.EKEvent.eventWithEventStore(store);
event.title = title;
event.calendar = cal;
event.startDate = start;
event.endDate = end;
event.timeZone = startZone;
event.setStartTimeZone(startZone);
event.setEndTimeZone(endZone);
const departureItem = airportMapItem(departureAirport);
const arrivalItem = airportMapItem(arrivalAirport);
event.location = `${departureAirport} to ${arrivalAirport}`;
event.structuredLocation = $.EKStructuredLocation.locationWithMapItem(departureItem);
event.URL = $.NSURL.URLWithString(`http://maps.apple.com/?saddr=${encodeURIComponent(departureAirport)}&daddr=${encodeURIComponent(arrivalAirport)}`);
event.notes = `Departure: ${departureLocal} (${departureZoneName})\nArrival: ${arrivalLocal} (${arrivalZoneName})\nMap: ${ObjC.unwrap(event.URL.absoluteString)}`;
let error = null;
if (!store.saveEventSpanError(event, 0, error)) throw new Error("EventKit save returned false");
JSON.stringify({status: "success", id: ObjC.unwrap(event.eventIdentifier), title, startISO, endISO, departureZoneName, arrivalZoneName, structuredLocation: true}, null, 2);
EOF
```

The example intentionally stores the departure airport as the event's
structured location and includes the complete route as an Apple Maps URL. If
the user wants the arrival airport embedded in Calendar's location card too,
create a second event or ask them to select the arrival location manually; one
event has one public structured location.
