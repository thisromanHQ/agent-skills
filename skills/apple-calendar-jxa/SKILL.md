---
name: apple-calendar-jxa
description: Use when working with macOS Calendar.app or Apple Calendar events through inline `osascript -l JavaScript` (JXA), including listing calendars, reading, creating, updating, and deleting events.
license: MIT
metadata:
  author: roman-pinchuk
  version: "1.0.0"
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
