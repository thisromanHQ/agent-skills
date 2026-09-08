---
name: apple-calendar-jxa
description: Use when working with macOS Calendar.app or Apple Calendar events through inline `osascript -l JavaScript` (JXA), including listing calendars, reading, creating, updating, and deleting events.
license: MIT
metadata:
  author: roman-pinchuk
  version: "1.2.0"
  repository: https://github.com/roman-pinchuk/agent-skills
---

# Apple Calendar JXA

Use this skill to interact directly with the host's macOS Calendar.app through
native inline JXA. Do not search for or execute external wrapper scripts.

## Backend Selection

Use an explicit hybrid backend:

- Use Calendar.app JXA for calendar discovery, bounded event reads, recurring
  event inspection, all writes, and verification.
- Use the Calendar SQLite database only for bounded, read-only metadata search
  across calendars or for keyword search that would otherwise require a large
  JXA enumeration.
- Never use SQLite for writes. Treat every SQLite row as a search candidate and
  resolve it through Calendar.app JXA before reading additional fields or
  changing an event.
- Do not silently fall back between backends. If SQLite is unavailable, report
  that Full Disk Access may be required and ask before using a bounded JXA
  search instead.

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
- SQLite search requires Full Disk Access for the launching application. The
  database contains private calendar metadata; do not expose its path or dump
  its contents.

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

## SQLite Metadata Search

Use this backend for bounded keyword searches. The database location and schema
are private macOS implementation details and may change. Locate the current
database, verify the required tables and columns, and stop if the preflight does
not match. Do not accept SQL from the user or interpolate raw search text.

The query below searches event title, description, and location. It returns
stored event/series candidates, not a complete expansion of recurring events.
For a recurrence-aware date-range agenda, use EventKit's date-range predicate
with full calendar access. The JXA date filter in this skill does not explicitly
expand recurrence rules either. Do not infer occurrences from `start_date` alone.
Replace `CALENDAR_SCOPE_JSON` with an exact calendar name or `null` for global
search. A name matching multiple database calendars is rejected.
Results are ordered by stored start date, earliest first, and capped at `limit`.
If the cap is reached, report that more matches may exist; do not describe the
result as exhaustive. Narrow the keyword or calendar scope to refine the search.

```bash
osascript -l JavaScript <<'EOF'
ObjC.import("Foundation");

function emit(value) {
    const data = $(JSON.stringify(value) + "\n").dataUsingEncoding($.NSUTF8StringEncoding);
    $.NSFileHandle.fileHandleWithStandardOutput.writeData(data);
}

function sqlQuote(value) {
    return "'" + String(value).replaceAll("'", "''") + "'";
}

function sqlLikeLiteral(value) {
    return sqlQuote(String(value).replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_"));
}

function databasePath() {
    const home = ObjC.unwrap($.NSHomeDirectory());
    const path = `${home}/Library/Group Containers/group.com.apple.calendar/Calendar.sqlitedb`;
    if (!$.NSFileManager.defaultManager.fileExistsAtPath($(path))) {
        throw new Error("Calendar SQLite database not found");
    }
    return path;
}

function sqliteQuery(database, sql) {
    const task = $.NSTask.alloc.init;
    const input = $.NSPipe.pipe;
    const output = $.NSPipe.pipe;
    task.launchPath = $("/usr/bin/sqlite3");
    task.arguments = $(["-readonly", "-nofollow", "-safe", "-batch", "-json", database]);
    task.standardInput = input;
    task.standardOutput = output;
    task.standardError = output;
    task.launch;
    input.fileHandleForWriting.writeData($(sql).dataUsingEncoding($.NSUTF8StringEncoding));
    input.fileHandleForWriting.closeFile;
    // Drain while SQLite runs, so a full stdout pipe cannot block process exit.
    const text = ObjC.unwrap($.NSString.alloc.initWithDataEncoding(
        output.fileHandleForReading.readDataToEndOfFile,
        $.NSUTF8StringEncoding
    ));
    task.waitUntilExit;
    if (task.terminationStatus !== 0) throw new Error("Calendar SQLite query failed");
    return text.trim() ? JSON.parse(text) : [];
}

const term = SEARCH_TERM_JSON;
const limit = LIMIT_NUMBER;
const calendarScope = CALENDAR_SCOPE_JSON;
if (typeof term !== "string" || term.length === 0 || term.length > 500 || term.includes("\0")) throw new Error("search term must be 1-500 characters without NUL");
if (calendarScope !== null && (typeof calendarScope !== "string" || calendarScope.length === 0 || calendarScope.length > 500 || calendarScope.includes("\0"))) throw new Error("invalid calendar scope");
if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("limit must be between 1 and 100");

const database = databasePath();
const required = {
    Calendar: ["ROWID", "title"],
    CalendarItem: ["ROWID", "UUID", "unique_identifier", "summary", "description", "start_date", "end_date", "all_day", "has_recurrences", "orig_item_id", "hidden", "status", "calendar_id", "location_id"],
    Location: ["ROWID", "title"]
};
for (const [table, columns] of Object.entries(required)) {
    const rows = sqliteQuery(database, `PRAGMA query_only=ON; SELECT p.name FROM sqlite_schema s JOIN pragma_table_info(s.name) p WHERE s.type='table' AND s.name=${sqlQuote(table)};`);
    const names = new Set(rows.map(row => row.name.toLowerCase()));
    if (columns.some(column => !names.has(column.toLowerCase()))) throw new Error("Calendar SQLite schema is unsupported");
}
let calendarFilter = "";
if (calendarScope !== null) {
    const calendars = sqliteQuery(database, `PRAGMA query_only=ON; SELECT ROWID AS id FROM Calendar WHERE title=${sqlQuote(calendarScope)} LIMIT 2;`);
    if (calendars.length !== 1 || !Number.isSafeInteger(calendars[0].id)) throw new Error("calendar scope is missing or ambiguous");
    calendarFilter = ` AND ci.calendar_id=${calendars[0].id}`;
}

const value = sqlLikeLiteral(term);
const sql = `PRAGMA query_only=ON;
SELECT ci.ROWID AS sqlite_id,
       ci.UUID AS uuid,
       ci.unique_identifier AS unique_identifier,
       substr(ci.summary, 1, 500) AS title,
       length(ci.summary) > 500 AS title_truncated,
       ci.start_date AS stored_start_date,
       ci.end_date AS stored_end_date,
       ci.all_day AS all_day,
       ci.has_recurrences AS has_recurrences,
       ci.orig_item_id AS original_item_id,
       ci.status AS stored_status,
       ci.hidden AS hidden,
       c.title AS calendar,
       substr(l.title, 1, 500) AS location,
       length(l.title) > 500 AS location_truncated
FROM CalendarItem ci
JOIN Calendar c ON c.ROWID = ci.calendar_id
LEFT JOIN Location l ON l.ROWID = ci.location_id
WHERE ci.hidden = 0 ${calendarFilter}
  AND (ci.summary LIKE '%' || ${value} || '%' COLLATE NOCASE ESCAPE '\\'
       OR ci.description LIKE '%' || ${value} || '%' COLLATE NOCASE ESCAPE '\\'
       OR l.title LIKE '%' || ${value} || '%' COLLATE NOCASE ESCAPE '\\')
ORDER BY ci.start_date ASC, ci.ROWID ASC
LIMIT ${limit};`;
emit({backend: "calendar_sqlite", candidates: sqliteQuery(database, sql)});
EOF
```

The template treats `%`, `_`, and `\` in the search term literally. Do not
remove the escaping or accept SQL fragments from the user.
SQLite's default case folding is ASCII-only. Hidden rows are excluded, but
`stored_status` is deliberately not interpreted as active/cancelled: those
private enum values have not been validated. Results are not an active agenda.

SQLite date columns use private Calendar storage conventions. Do not present
`stored_start_date` or `stored_end_date` as user-facing timestamps until they
have been validated against a Calendar.app event. SQLite rows can also become
stale after synchronization.
On the tested host, one non-recurring timed event matched JXA using the Apple
2001 epoch (`(stored_date + 978307200) * 1000` milliseconds). This is a smoke
check, not a guarantee for other macOS versions, floating times, or all-day
events. Prefer the resolved JXA timestamps for display.

### Resolve A Search Candidate

Before reading full details or mutating an event, resolve the candidate through
Calendar.app. Calendar names are still matched exactly, and a candidate must
resolve to one event. Do not guess when `uuid`, `unique_identifier`, and
Calendar.app's `id()` do not match; report that the SQLite candidate could not
be resolved and ask for a bounded JXA search.

```bash
osascript -l JavaScript <<'EOF'
const app = Application("Calendar");
const candidate = CANDIDATE_OBJECT_JSON;

if (!candidate || typeof candidate.calendar !== "string") throw new Error("invalid SQLite candidate");
const ids = [...new Set([candidate.uuid, candidate.unique_identifier].filter(id => typeof id === "string" && id.length > 0 && id.length <= 1024))];
if (ids.length === 0) throw new Error("candidate has no usable identifier");
const calendars = app.calendars().filter(cal => cal.name() === candidate.calendar);
if (calendars.length !== 1) throw new Error("candidate calendar is missing or ambiguous");

const matches = [];
for (const id of ids) {
    const event = calendars[0].events.byId(id);
    if (event.exists() && String(event.id()) === id) matches.push(event);
}
if (matches.length !== 1) throw new Error("SQLite candidate could not be resolved uniquely through Calendar.app");

const event = matches[0];
const recurring = Number(candidate.has_recurrences) !== 0 || Number(candidate.original_item_id) > 0 || Boolean(event.recurrence());
JSON.stringify({
    backend: "calendar_jxa",
    id: event.id(),
    requires_recurrence_scope: recurring,
    all_day: Boolean(event.alldayEvent()),
    title: (event.summary() || "").slice(0, 500),
    start: event.startDate().toISOString(),
    end: event.endDate().toISOString(),
    location: (event.location() || "").slice(0, 500)
}, null, 2);
EOF
```

Resolution performs at most two targeted ID lookups, not a full-calendar scan.
Display dates from JXA, not the private SQLite date values. All-day dates must
be presented in the calendar's intended local date context, not inferred from
UTC dates alone. Fetch notes only when requested, with an explicit character cap.
Re-read current fields and recurrence immediately before any write. If
`requires_recurrence_scope` is true, stop before mutations and clarify whether
the user means an occurrence or the series. The generic JXA mutation snippets
below are not an occurrence-aware editing API; do not use them for recurring
events or exceptions. SQLite search never authorizes a mutation.

## Create, Update, And Delete

Use the same `calendarByExactName`, `utcDate`, and `eventJson` helpers above.
Replace every value placeholder with a JSON string literal.
The update/delete examples apply only to non-recurring events. For a SQLite
candidate, check its `requires_recurrence_scope` and original-item reference
first; detached exceptions may not expose their own JXA recurrence rule.

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
metadata, such as separate departure and arrival time zones or a best-effort
map-backed airport location. The stable Calendar.app JXA workflow remains the
default.

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
            if (!response) {
                let message = `Airport lookup failed: ${query}`;
                try { message = ObjC.unwrap(error.localizedDescription) || message; } catch (_) {}
                throw new Error(message);
            }
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
            if (!response) {
                let message = `Airport lookup failed: ${query}`;
                try { message = ObjC.unwrap(error.localizedDescription) || message; } catch (_) {}
                throw new Error(message);
            }
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
const identifier = ObjC.unwrap(event.eventIdentifier);
const saved = store.eventWithIdentifier(identifier);
if (!saved || !saved.structuredLocation) throw new Error("Saved event has no structured location");
JSON.stringify({status: "success", id: identifier, title, startISO, endISO, departureZoneName, arrivalZoneName, structuredLocation: true}, null, 2);
EOF
```

The example stores the departure airport as the event's structured location and
includes the complete route as an Apple Maps URL. Verify the saved event's
structured location after saving. If a calendar provider rejects the structured
location, report the save failure and do not claim that the map was created.
Retry only with explicit user approval, using the plain airport text, URL, and
local times in the notes. If the user wants the arrival airport embedded in
Calendar's location card too, create a second event or ask them to select the
arrival location manually; one event has one public structured location.
