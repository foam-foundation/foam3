Two versions:

Fully Partitioned
ex. ProgramAware
Each delegate is completely independent and mutually exclusive.
The partition selector must be part of the query.
No id to partition mapping required because the partition is always present.
(What about find(), will need to be transformed to select() on client)


Merged Partitioning
ex. by date range for hot, warm, cold data
partition on date ranges, ex. weekly
add partition name to primary keys, then seqNo within one file
need discover list of available delegate DAOs/partitions
configure an "active window" on a per-DAO basis
if no date range specified then default to active window
if range specified then ???
maintain list of potential partitions w. load status
If a query spans multiple partitions?
  idea: create a custom MDAO which spans that exact range, and then GC quickly
  more efficient if only supports date ranges, not datetime

Requires fast journal loading
- batched async assembly line
- multi-threaded DAO bulk-loader
- zipped journals?
- memory mapped IO?
- optimized parsers
- faster inter()

Ideas:
- unloadable JDAO?
- support for on-disk scan select()'s?

Decorators:
outside: auth, PM
inside: seqNo

Questions:
Who calls CurrentProgramUtil.setCurrentProgram()?
What is AbstractProgramAware.getSkipRecord_() for?
How to handle build journals?
How to nest partition DAOs?
PartitionAwareDAO ?? for JDAO and PartitionedDAO?
  Partitionable?
  Copy data out of delegate into ne wpartitions, then clone as prototype

Options:
use serviceScript or a function?
need journal name


setup:
journalType: foam.dao.JournalType.NO_JOURNAL

setDecorator:
      .setDecorator(???)

OR make it decorate the EasyDAO
  - extract the journal name, set the decorator, fix seqNo

/*
Calendar cal = Calendar.getInstance();
cal.setTime(legacyDate);
int month = cal.get(Calendar.MONTH);
*/

For Date ranges:

getDelegates() - return more than 1,
if only one, then use as is,
if more than one then decorate the Sink and pass to all DAOs
  Like we do with Or?

put(id = '')
  1234-
  1234-2024/01
  1234-2024/01-1


put(id = '1')
  1234-1
  1234-2024/01-1
