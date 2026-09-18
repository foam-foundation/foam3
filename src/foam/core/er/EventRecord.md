<flow name="EventRecord" category="DOC/DEV" spid="foam" label="Event Record" description="EventRecord (ER): logs a logical operation and can generate Alarms and Notifications based on severity and rules." keywords="eventrecord,alarm,notification,logging"/>

# Event Record (ER)

# Overview

An EventRecord, as the name implies, notes a logical operation.  Generally a reoccuring operation such as a cronjob or EFT operation against a remote endpoint.

An EventRecord consolidates varius notifcations such as Logging, Alarms, Notifications, EmailMessages.

An EventRecord will always produce a Log Message, and depending upon Log Severity and Rule configuration, generate an Alarm and Notification.

The EventRecordDAO has Rule enabled, so any number of Rules can be crafted for many scenarios.  By default an EventRecord of severity WARN or ERROR will generate an Alarm and Notification.

# Intent

The EventRecordDAO is meant to be a single view for Operations to view the goings-on of an application.

# Use

As a minimum, an EventRecords requires an **event** string, and then optionally a **partner** and **code**.

## Example

### Error, Alarm event

```
DAO eventRecordDAO = (DAO) x.get("eventRecordDAO");
EventRecord er = new EventRecord(x, this, "event", "partner", "errorCode", "message", LogLevel.ERROR, new Exception("stacktrace"));
eventRecordDAO.put(er);
```

### General info event

```
DAO eventRecordDAO = (DAO) x.get("eventRecordDAO");
EventRecord er = new EventRecord(x, this, "event", "partner");
eventRecordDAO.put(er);
```

# Alarm Raise and Clear

Alarms are raised on WARN or ERROR level.  A raised Alarm will be cleared if an EventRecord of severity INFO is created with a matching **event**, **partner**, **code**.

# Event Record Response

An Event Record Response is a detailed description of an Event Record and what to do when one is encountered.
