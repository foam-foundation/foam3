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
