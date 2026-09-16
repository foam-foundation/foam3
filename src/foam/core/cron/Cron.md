<flow name="Cron" category="DOC/DEV" spid="foam"/>
<title>Cron</title>
<h1>Cron</h1>

<h2>Cron, Cron Job, Cron Job Event</h2>
<ol>
  <li>Cron - cron detail</li>
  <li>Cron Job - active/running Cron</li>
  <li>Cron Job Event - 'print' output from Cron Job</li>
</ol>

<h1>Scheduling</h1>
Crons have two scheduling behaviours.
<ol>
  <li>Regular Scheduling</li>
  <li>Re-attempt Scheduling</li>
</ol>
<h2>Regular Scheduling</h2>
The schedule used for normal script execution.

<h2>Reattempt Scheduling</h2>
<p>A secondary schedule controlling frequency of retries or reattempts when the script determines that is has failed.</p>
<p>Defaults to IntervalSchedule set at 5 minutes.</p>
<p>
Reattempt scheduling is invoked from the script by calling:
<ul><li><b>currentScript.reattempt()</b></li></ul>
The number of reattempt attempts is control by <b>maxReattempts</b>
</p>
<p>
When reattempt attempts reaches <b>maxReattempts</b> the following willl occur:
<ul>
  <li>Alarm generated with name equal to the cron id</li>
  <li>Cron will disable itself</li>
</ul>
</p>
