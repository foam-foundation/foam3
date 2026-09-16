<flow name="EventRecord" category="DOC/DEV" spid="foam"/>
<title>Event Record</title>
<h1>Event Record (ER)</h1>
<h1>Overview</h1>
An EventRecord, as the name implies, notes a logical operation.  Generally a reoccuring operation such as a cronjob or EFT operation against a remote endpoint.

An EventRecord consolidates varius notifcations such as Logging, Alarms, Notifications, EmailMessages.

An EventRecord will always produce a Log Message, and depending upon Log Severity and Rule configuration, generate an Alarm and Notification.

The EventRecordDAO has Rule enabled, so any number of Rules can be crafted for many scenarios.  By default an EventRecord of severity WARN or ERROR will generate an Alarm and Notification.

<h1>Intent</h1>
The EventRecordDAO is meant to be a single view for Operations to view the goings-on of an application.

<h1>Use</h1>
As a minimum, an EventRecords requires an <b>event</b> string, and then optionally a <b>partner</b> and <b>code</b>.

<h2>Example</h2>
<h3>Error, Alarm event</h3>
<code>
DAO eventRecordDAO = (DAO) x.get("eventRecordDAO");
EventRecord er = new EventRecord(x, this, "event", "partner", "errorCode", "message", LogLevel.ERROR, new Exception("stacktrace"));
eventRecordDAO.put(er);
</code>

<h3>General info event</h3>
<code>
DAO eventRecordDAO = (DAO) x.get("eventRecordDAO");
EventRecord er = new EventRecord(x, this, "event", "partner");
eventRecordDAO.put(er);
</code>

<h1>Alarm Raise and Clear</h1>
Alarms are raised on WARN or ERROR level.  A raised Alarm will be cleared if an EventRecord of severity INFO is created with a matching <b>event</b>, <b>partner</b>, <b>code</b>.

<h1>Event Record Response</h1>
An Event Record Response is a detailed description of an Event Record and what to do when one is encountered.