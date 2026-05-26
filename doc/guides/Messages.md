# FOAM Messages
FOAM axiom **messages** provide support i18n language translation. 

FOAM supports language translation for model properties such as **label**, but free form text strings in Exception messages or Views must use the messages axiom for translation.

## Example

Replace occurances of 

```
throw new ValidationException("Record not found")
```

with

```
  messsages: [
    { name: 'RECORD_NOT_FOUND', 'Record not found' }
  ]

  ...

  throw new ValidationException(RECORD_NOT_FOUND);
```

Messages.message also supports formatting

```
  messages: [
    { name: 'SUCCESSFULLY_TRANSITIONED_TO', message: 'Successfully transitioned to ${newStatus}', template: true}
  ]

  ...

  X.notify('', X.data.SUCCESSFULLY_TRANSITIONED_TO({newState: self.status.label}), X.data.LogLevel.INFO, true);
```
