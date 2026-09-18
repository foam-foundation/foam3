<flow name="Cron" category="DOC/DEV" spid="foam"/>

# Cron

## Cron, Cron Job, Cron Job Event

1. Cron - cron detail
2. Cron Job - active/running Cron
3. Cron Job Event - 'print' output from Cron Job

# Scheduling

Crons have two scheduling behaviours.

1. Regular Scheduling
2. Re-attempt Scheduling

## Regular Scheduling

The schedule used for normal script execution.

## Reattempt Scheduling

A secondary schedule controlling frequency of retries or reattempts when the script determines that is has failed.

Defaults to IntervalSchedule set at 5 minutes.

Reattempt scheduling is invoked from the script by calling:

- **currentScript.reattempt()**

The number of reattempt attempts is control by **maxReattempts**

When reattempt attempts reaches **maxReattempts** the following willl occur:

- Alarm generated with name equal to the cron id
- Cron will disable itself
