<flow name="Alarm" category="DOC/DEV" spid="foam" description="Alarm documentation: high-level system event reporting for NOC monitoring, auto-generated alarms, and AlarmConfig suppression." keywords="alarm,noc,alarmconfig,monitoring,knowledge"/>

# Alarm Documentation

## Introduction

An Alarm is high level system event reporting an unusual or unexpected event.
For example, alarms are appropriate in scenarios such as:

- network timeouts when communicating with an integration endpoint
- missing configuration

## Audience

Alarms are intended to be monitored by a Network Operations Center (NOC). NOC operators are monitoring many systems, and generally do not have detailed knowledge of each system.  The Alarm is simply to bring attention to a problem that a System Engineer will address.

As such, the alarm should have a short simple name, and just enough details in the *note* for System Engineer to narrow their search of the system and logs.

## Notifications

Alarms with **severity** of *WARN* or *ERROR* automatically generated a **notification**

## Auto Generated Alarms

Alarms are automatically generated for **error PMs** *(pm.error)*

## Usage

The Alarm **name** is the alarm id or key. Alarms default to severity **Warning** and when created are **active**.

### Code Examples

#### Alarm

```
  Alarm alarm = new Alarm.Builder(x)
                    .setName("Payment Provider CP Onboarding")
                    .setReason(AlarmReason.TIMEOUT)
                    .build();
  DAO alarmDAO = (DAO) alarmDAO.put(alarm);
```

`((DAO) x.get("alarmDAO")).put(new Alarm("Payment Provider CP Onboarding", AlarmReason.TIMEOUT));`

## Programatically **stopping** an Alarm

To stop an alarm simply create a same **named** alarm with **active** false.

`((DAO) x.get("alarmDAO")).put(new Alarm("Payment Provider CP Onboarding", false));`

# Alarm Config

## Supressing/Silencing/Ignoring Alarms

AlarmConfig acts as a template which will change the behaviour of an Alarm.

### Example

If a network endpoint is flooding the system with *network outage* alarms, an AlarmConfig can be created for this **name** which can change the severity and/or status of the alarm.  The AlarmConfig status could be *not active*, and all subsequent alarms will be disabled or inactive.

# Alarming and Monitoring

`AlarmAndMonitoring` raises or clears an alarm by comparing a service's OM
counts against the thresholds in its `AlarmConfig`.

## 1. Counting

Code logs an OM (operational measure) by name through `OMLogger`, for example
`PaymentService:send:attempt`. The `omFoldManager` adds each log to a
`Candlestick` in `localOm1MinuteDAO`, keyed by the OM name and the end of the
current minute (`closeTime` = minute start + 59999 ms). So there is one
counter per OM name per minute. Old candlesticks are not removed: the latest
one for a name stays in the DAO until that name is logged again.

## 2. Configuring

An `AlarmConfig`, in `alarmConfigDAO`, names the alarm and up to three OMs:

- **preRequest**: logged before each request, the attempts.
- **postRequest**: logged after each successful response.
- **timeOutRequest**: logged after each failure of interest, usually a
  timeout.

`alarmValue` and `timeoutValue` are percentages, and `monitorType` picks how
they are applied (see Evaluating).

## 3. Triggering

The "Alarming and Monitoring" cron (disabled by default) puts a new
`MonitoringReport`, named after the config, into `monitoringReportDAO` for
each enabled config that is not `manual`. The "Alarming & Monitoring" rule on
that DAO runs `AlarmAndMonitoring`. A test can put the report itself to
evaluate a config at once.

## 4. Evaluating

For each of the three OMs, the latest candlestick is read from `om1MinuteDAO`
(`localCcom1MinuteDAO` when `useCCOMLogger` is set). Its count is added to the
report's `startCount`, `endCount` or `timeoutCount` only if it closed within
`cycleTime` (default 60 s) of the start of the current minute. That window
takes the current and the previous minute, so a failure stops counting about
two minutes after it happened. The decision uses the report's counts only,
never an older candlestick.

- **CREDENTIALS**: with `timeOutRequest` set, the alarm is on while
  `timeoutCount / startCount` is above `timeoutValue`, for example credential
  failures above 10% of attempts. Without it, the alarm is on while
  `endCount / startCount` is below `alarmValue`, so any failure counts.
  Reason CREDENTIALS.
- **CONGESTION** and **CONTROLCHECK**: on with reason TIMEOUT while
  `timeoutCount / startCount` is above `timeoutValue`. Otherwise on with
  reason CONGESTION or CONTROLCHECK while `endCount / startCount` is below
  `alarmValue`.
- **THRESHOLD**: on with reason THRESHOLD while `startCount` is above
  `alarmValue`, a count rather than a percentage.

When none of these holds, the alarm should be off. When no OM of the config
was logged in the window, nothing changes, so an alarm only clears once a
request succeeds.

## 5. Raising and clearing

The alarm is raised and cleared through an `EventRecord`, so the
`EventRecord` rules send the notifications. An `EventRecord` is put only when
the alarm changes state, not on every cycle:

- **Raise**: the alarm should be on and is not. The `EventRecord` has the
  config's name as its `event`, which is also the alarm's name, the reason
  and the window's counts as its `message` (for example `TIMEOUT, attempts:
  6, responses: 0, failures: 6`), and the config's `severity`. Its `code`
  stays empty, because the code is part of the alarm name and the clear must
  name the same alarm whatever the reason was.
- **Clear**: the alarm is on and should be off. The same `event`, severity
  INFO.

`EventRecordAlarmRuleAction` turns the alarm on for a record at or above its
`alarmSeverity`, set to ERROR on the rule's action, and off for INFO, writing
to `localAlarmDAO`. A WARN record neither raises nor clears an alarm.
`EventRecordNotificationRuleAction` sends a notification for every ERROR
record, for a record at or above its `notificationSeverity` (WARN by default)
only when that record raised its alarm, and for a record below it only when it
cleared its alarm. So an ERROR raise notifies, and so does every clear. A
config's `severity` defaults to WARN, which raises no alarm: a config that
should alarm needs `severity` ERROR.

While the alarm is on, a change of reason, such as CONGESTION to TIMEOUT, puts
no new `EventRecord`: the alarm keeps the reason it was raised with.
