# Journal Compaction

Each DAO operation on the same object generates a journal entry containing just the change on the object.  Over time there are many entries for the same object, slowing **replay** since replay time is propotional to the number of lines in a journal file.  **Compaction** writes out each object to a new journal file in it's entirety, thus reducing the multiple entries to just one, and in turn reducing replay time. 

Used in conjuction with a custom compaction sink, the compaction process can facilitate archiving with only recent or active objects written to the new journal.

## Considerations

- Compaction can be run concurrently with live traffic, but it is recommended to run compaction at a low traffic period.  Also, compaction can fail requiring system halt and manual intervention, so a Maintenance Window should be scheduled.
- Compaction filters out many archive or history operations. See `deployment/compaction/compactions.jrl`.
- The **select** for compaction is performed on the DAO returned from the context using CSpecname. If the DAO stack contains a FixedSizedDAO then only those records retained by the FixedSizedDAO will be compacted into the new journal.

## Invocation

Compaction is controlled by Script `DAOCompaction` and scriptParameter `DAOCompaction`.  The ScriptParameter lists the DAOs to compact.

Once script execution reports completion, check:

1. ScriptEvents for an 'OK' message.
1. EventRecords for a compaction summary.  Open the reponse message to see the statistics.

## Compaction, Major steps

1. Start blocking DAO operations.
1. Roll the journal.  journal becomes journal.1 on the first invocation. Next will rename journal to journal.2 
1. Unblock DAO operations. At this point live traffic is processed during compaction and written to the new journal file.
1. Start compacting.
1. End

## Rollback

Should compaction fail for any reason, a rollback is required.

When compaction fails the system should be considered invalid. Live traffic must be halted immediately.  Any operations which occured during compaction will be lost on rollback.

To rollback:

1. Halt the system.
1. Undo the rolled journal.  Discard the unnumbered journal file and remove the number postfix from the highest number journal.  journal.1 -> journal
1. Start the system


## Controlling Compaction via the Compaction model

Compaction model properties:
    `foam.dao.compaction.Compaction`,
- compactable :: By default a DAO is compactable, meaning it's entries will be reduced. If compaction is disabled (false), then the DAO's entries will be discarded - they will not be compacted into a new journal.
- reducible :: By default a DAO is reducible, meaning multiple CRUD operations are reduced to one. If *reducible* is false, then all entries are transfered the new ledger.
- compactLifecycleDeleted :: LifecycleAware objects which are deleted/removed are set to state DELETED, an r() journal entry is not created.  This option allows to compact DELETED entries.
- clearable :: Not used outside of [[https://github.com/kgrgreer/foam-medusa][Medusa]].
- **sink** :: Custom sinks can be registered for per entry control during compaction.
See localTicketCommentDAO for an example of inline sink Predicate controlling Ticket Comment compaction based on Ticket Status.
    see `deployment/compaction/compactions.jrl` ticketDAO for an example. 
